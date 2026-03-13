import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import goblinStandingUrl from '@/assets/goblinstanding.glb?url';
import goblinWalkingUrl from '@/assets/goblinwalking.glb?url';
import goblinRunningUrl from '@/assets/goblinrunning.glb?url';
import goblinJumpUrl from '@/assets/goblinjump.glb?url';

interface GoblinGLBModelProps {
  moveSpeedRef: React.MutableRefObject<number>;
  controllerHalfHeight: number;
  isGroundedRef: React.MutableRefObject<boolean>;
  activeEmote: string | null;
  activeEmoteId?: number;
  onEmoteComplete: () => void;
  damageFlash?: number;
  attackAnimRef?: React.MutableRefObject<number>;
  isFightingRef?: React.MutableRefObject<boolean>;
}

type GoblinState = 'idle' | 'walk' | 'run' | 'jump';

const MOVE_START_THRESHOLD = 0.07;
const MOVE_STOP_THRESHOLD = 0.04;
const RUN_THRESHOLD = 0.7;
const ROOT_TRANSLATION_NAME_RE = /(hips|pelvis|root|armature)/i;
const BONE_HIPS_RE = /(hips|pelvis)/i;
const BONE_HEAD_RE = /(head|neck)/i;
const BONE_LEFT_RE = /(leftshoulder|left_shoulder|shoulder_l|leftarm|left_arm)/i;
const BONE_RIGHT_RE = /(rightshoulder|right_shoulder|shoulder_r|rightarm|right_arm)/i;

const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _tmpVecC = new THREE.Vector3();
const _tmpVecD = new THREE.Vector3();
const _tmpUp = new THREE.Vector3();
const _tmpRight = new THREE.Vector3();
const _tmpForward = new THREE.Vector3();
const _tmpForwardAlt = new THREE.Vector3();
const _tmpCenter = new THREE.Vector3();
const _tmpSize = new THREE.Vector3();

function sanitizeClips(animations: THREE.AnimationClip[]): THREE.AnimationClip[] {
  return animations.map((clip) => {
    const clonedClip = clip.clone();
    clonedClip.tracks = clonedClip.tracks.filter((track) => {
      if (!track.name.endsWith('.position')) return true;
      const target = track.name.slice(0, track.name.lastIndexOf('.'));
      return !ROOT_TRANSLATION_NAME_RE.test(target);
    });
    return clonedClip;
  });
}

function getFirstClipName(clips: THREE.AnimationClip[], hint?: RegExp): string | null {
  if (clips.length === 0) return null;
  if (hint) {
    const found = clips.find(c => hint.test(c.name));
    if (found) return found.name;
  }
  return clips[0].name;
}

interface ModelInspection {
  label: string;
  sceneRoot: THREE.Object3D;
  armature: THREE.Object3D | null;
  skinnedMesh: THREE.SkinnedMesh | null;
  hipsBone: THREE.Bone | null;
  bounds: THREE.Box3;
  size: THREE.Vector3;
  center: THREE.Vector3;
  anchor: THREE.Vector3;
  footY: number;
  height: number;
  facingYaw: number | null;
  facingYawCandidates: number[];
}

interface ModelNormalization {
  modelAnchorOffset: [number, number, number];
  scale: number;
  yawCorrection: number;
  controllerGroundOffset: number;
}

function inspectModel(label: string, scene: THREE.Object3D): ModelInspection {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(_tmpSize.clone());
  const center = bounds.getCenter(_tmpCenter.clone());

  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  scene.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes.push(child as THREE.SkinnedMesh);
  });

  const primarySkinnedMesh = skinnedMeshes[0] ?? null;
  const skeleton = primarySkinnedMesh?.skeleton ?? null;
  const hipsBone = skeleton?.bones.find((bone) => BONE_HIPS_RE.test(bone.name)) ?? skeleton?.bones[0] ?? null;
  const armature = scene.getObjectByName('Armature') ?? findArmatureNode(scene);
  const facing = inferFacingYawFromSkeleton(skeleton);

  let anchorX = center.x, anchorZ = center.z;
  if (hipsBone) {
    hipsBone.getWorldPosition(_tmpVecA);
    anchorX = _tmpVecA.x;
    anchorZ = _tmpVecA.z;
  }

  return {
    label, sceneRoot: scene, armature, skinnedMesh: primarySkinnedMesh, hipsBone,
    bounds, size: size.clone(), center: center.clone(),
    anchor: new THREE.Vector3(anchorX, 0, anchorZ),
    footY: bounds.min.y, height: size.y,
    facingYaw: facing.yaw, facingYawCandidates: facing.candidates,
  };
}

function inferFacingYawFromSkeleton(skeleton: THREE.Skeleton | null): { yaw: number | null; candidates: number[] } {
  if (!skeleton || skeleton.bones.length === 0) return { yaw: null, candidates: [] };
  const hips = skeleton.bones.find((b) => BONE_HIPS_RE.test(b.name)) ?? null;
  const head = skeleton.bones.find((b) => BONE_HEAD_RE.test(b.name)) ?? null;
  const left = skeleton.bones.find((b) => BONE_LEFT_RE.test(b.name)) ?? null;
  const right = skeleton.bones.find((b) => BONE_RIGHT_RE.test(b.name)) ?? null;
  if (!hips || !head || !left || !right) return { yaw: null, candidates: [] };

  hips.getWorldPosition(_tmpVecA); head.getWorldPosition(_tmpVecB);
  left.getWorldPosition(_tmpVecC); right.getWorldPosition(_tmpVecD);
  _tmpUp.subVectors(_tmpVecB, _tmpVecA).normalize();
  _tmpRight.subVectors(_tmpVecD, _tmpVecC).normalize();
  _tmpForward.crossVectors(_tmpRight, _tmpUp).normalize();
  _tmpForwardAlt.crossVectors(_tmpUp, _tmpRight).normalize();
  if (_tmpForward.lengthSq() < 1e-6 || _tmpForwardAlt.lengthSq() < 1e-6) return { yaw: null, candidates: [] };

  const yawA = Math.atan2(_tmpForward.x, _tmpForward.z);
  const yawB = Math.atan2(_tmpForwardAlt.x, _tmpForwardAlt.z);
  const nA = normalizeAngle(yawA), nB = normalizeAngle(yawB);
  const preferred = Math.abs(nA) <= Math.abs(nB) ? nA : nB;
  return { yaw: preferred, candidates: [nA, nB] };
}

function normalizeAngle(v: number): number {
  let out = v;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

function enableMeshShadows(scene: THREE.Object3D) {
  scene.traverse((child) => { if ((child as THREE.Mesh).isMesh) { child.castShadow = true; child.receiveShadow = true; } });
}

function findArmatureNode(scene: THREE.Object3D): THREE.Object3D | null {
  let armature: THREE.Object3D | null = null;
  scene.traverse((child) => { if (armature) return; if (/armature/i.test(child.name)) armature = child; });
  return armature;
}

function buildNormalization(
  inspection: ModelInspection,
  canonicalHeight: number,
  fallbackYawCorrection: number,
  controllerHalfHeight: number,
): ModelNormalization {
  const scale = inspection.height > 0.01 ? canonicalHeight / inspection.height : 1;
  const yawCorrection = inspection.facingYaw !== null ? -inspection.facingYaw : fallbackYawCorrection;
  return {
    modelAnchorOffset: [-inspection.anchor.x, -inspection.footY, -inspection.anchor.z],
    scale,
    yawCorrection,
    controllerGroundOffset: -controllerHalfHeight,
  };
}

export function GoblinGLBModel({ moveSpeedRef, controllerHalfHeight, isGroundedRef, activeEmote, activeEmoteId, onEmoteComplete, damageFlash, attackAnimRef, isFightingRef }: GoblinGLBModelProps) {
  const idleGltf = useGLTF(goblinStandingUrl);
  const walkGltf = useGLTF(goblinWalkingUrl);
  const runGltf = useGLTF(goblinRunningUrl);
  const jumpGltf = useGLTF(goblinJumpUrl);

  const idleVisibleRef = useRef<THREE.Group>(null);
  const walkVisibleRef = useRef<THREE.Group>(null);
  const runVisibleRef = useRef<THREE.Group>(null);
  const jumpVisibleRef = useRef<THREE.Group>(null);

  const stateRef = useRef<GoblinState>('idle');

  // Sanitize clips
  const sanitizedIdleClips = useMemo(() => sanitizeClips(idleGltf.animations), [idleGltf.animations]);
  const sanitizedWalkClips = useMemo(() => sanitizeClips(walkGltf.animations), [walkGltf.animations]);
  const sanitizedRunClips = useMemo(() => sanitizeClips(runGltf.animations), [runGltf.animations]);
  const sanitizedJumpClips = useMemo(() => sanitizeClips(jumpGltf.animations), [jumpGltf.animations]);

  // Inspections
  const idleInspection = useMemo(() => inspectModel('goblin_idle', idleGltf.scene), [idleGltf.scene]);
  const walkInspection = useMemo(() => inspectModel('goblin_walk', walkGltf.scene), [walkGltf.scene]);
  const runInspection = useMemo(() => inspectModel('goblin_run', runGltf.scene), [runGltf.scene]);
  const jumpInspection = useMemo(() => inspectModel('goblin_jump', jumpGltf.scene), [jumpGltf.scene]);

  // Use a shorter canonical height for the goblin (about 1.2m)
  const canonicalHeight = useMemo(() => {
    if (idleInspection.height > 0.01) return idleInspection.height;
    if (walkInspection.height > 0.01) return walkInspection.height;
    return 1.2;
  }, [idleInspection.height, walkInspection.height]);

  const canonicalYawCorrection = useMemo(() => {
    return walkInspection.facingYaw !== null ? -walkInspection.facingYaw : 0;
  }, [walkInspection.facingYaw]);

  // Normalizations
  const idleNorm = useMemo(() => buildNormalization(idleInspection, canonicalHeight, canonicalYawCorrection, controllerHalfHeight), [idleInspection, canonicalHeight, canonicalYawCorrection, controllerHalfHeight]);
  const walkNorm = useMemo(() => buildNormalization(walkInspection, canonicalHeight, canonicalYawCorrection, controllerHalfHeight), [walkInspection, canonicalHeight, canonicalYawCorrection, controllerHalfHeight]);
  const runNorm = useMemo(() => buildNormalization(runInspection, canonicalHeight, canonicalYawCorrection, controllerHalfHeight), [runInspection, canonicalHeight, canonicalYawCorrection, controllerHalfHeight]);
  const jumpNorm = useMemo(() => buildNormalization(jumpInspection, canonicalHeight, canonicalYawCorrection, controllerHalfHeight), [jumpInspection, canonicalHeight, canonicalYawCorrection, controllerHalfHeight]);

  // Animation setups
  const { actions: idleActions, clips: idleClips } = useAnimations(sanitizedIdleClips, idleGltf.scene);
  const idleClipName = useMemo(() => getFirstClipName(idleClips, /idle|stand/i), [idleClips]);

  const { actions: walkActions, clips: walkClips } = useAnimations(sanitizedWalkClips, walkGltf.scene);
  const walkClipName = useMemo(() => getFirstClipName(walkClips, /walk/i), [walkClips]);

  const { actions: runActions, clips: runClips } = useAnimations(sanitizedRunClips, runGltf.scene);
  const runClipName = useMemo(() => getFirstClipName(runClips, /run/i), [runClips]);

  const { actions: jumpActions, clips: jumpClips } = useAnimations(sanitizedJumpClips, jumpGltf.scene);
  const jumpClipName = useMemo(() => getFirstClipName(jumpClips, /jump/i), [jumpClips]);

  // Enable shadows + debug
  useEffect(() => {
    [idleGltf.scene, walkGltf.scene, runGltf.scene, jumpGltf.scene].forEach(enableMeshShadows);
    console.log('[Goblin] Clip names — idle:', idleClipName, 'walk:', walkClipName, 'run:', runClipName, 'jump:', jumpClipName);
  }, [idleGltf.scene, walkGltf.scene, runGltf.scene, jumpGltf.scene, idleClipName, walkClipName, runClipName, jumpClipName]);

  // Initialize idle (looping)
  useEffect(() => {
    if (!idleClipName) return;
    const a = idleActions[idleClipName]; if (!a) return;
    a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; a.enabled = true; a.play();
    return () => { a.stop(); };
  }, [idleActions, idleClipName]);

  // Initialize walk (paused looping)
  useEffect(() => {
    if (!walkClipName) return;
    const a = walkActions[walkClipName]; if (!a) return;
    a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; a.enabled = true; a.play(); a.paused = true;
    return () => { a.stop(); };
  }, [walkActions, walkClipName]);

  // Initialize run (paused looping)
  useEffect(() => {
    if (!runClipName) return;
    const a = runActions[runClipName]; if (!a) return;
    a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; a.enabled = true; a.play(); a.paused = true;
    return () => { a.stop(); };
  }, [runActions, runClipName]);

  // Initial visibility
  useEffect(() => {
    if (idleVisibleRef.current) idleVisibleRef.current.visible = true;
    if (walkVisibleRef.current) walkVisibleRef.current.visible = false;
    if (runVisibleRef.current) runVisibleRef.current.visible = false;
  }, []);

  const setVisibleState = useCallback((state: GoblinState) => {
    const showIdle = state === 'idle' || state === 'jump';
    const showWalk = state === 'walk';
    const showRun = state === 'run';
    if (idleVisibleRef.current) idleVisibleRef.current.visible = showIdle;
    if (walkVisibleRef.current) walkVisibleRef.current.visible = showWalk;
    if (runVisibleRef.current) runVisibleRef.current.visible = showRun;
  }, []);

  useFrame(() => {
    const state = stateRef.current;
    const speed = moveSpeedRef.current;
    const grounded = isGroundedRef.current;

    let newState: GoblinState;
    if (!grounded) {
      newState = 'jump';
    } else if (state === 'idle' ? speed > MOVE_START_THRESHOLD : speed > MOVE_STOP_THRESHOLD) {
      newState = speed > RUN_THRESHOLD ? 'run' : 'walk';
    } else {
      newState = 'idle';
    }

    if (newState !== state) {
      stateRef.current = newState;
      setVisibleState(newState);
    }

    // Idle animation
    if (idleClipName) {
      const ia = idleActions[idleClipName];
      if (ia) ia.paused = newState !== 'idle' && newState !== 'jump';
    }

    // Walk animation speed
    if (walkClipName) {
      const wa = walkActions[walkClipName];
      if (wa) {
        if (newState === 'walk') {
          wa.paused = false;
          wa.setEffectiveTimeScale(Math.max(0.55, THREE.MathUtils.clamp(speed, 0, 1.4) * 1.35));
        } else {
          wa.paused = true;
        }
      }
    }

    // Run animation speed
    if (runClipName) {
      const ra = runActions[runClipName];
      if (ra) {
        if (newState === 'run') {
          ra.paused = false;
          ra.setEffectiveTimeScale(1.0);
        } else {
          ra.paused = true;
        }
      }
    }
  });

  const renderModel = (ref: React.RefObject<THREE.Group | null>, norm: ModelNormalization, scene: THREE.Object3D) => (
    <group ref={ref}>
      <group rotation={[0, norm.yawCorrection, 0]}>
        <group position={[0, norm.controllerGroundOffset, 0]}>
          <group scale={[norm.scale, norm.scale, norm.scale]}>
            <group position={norm.modelAnchorOffset}>
              <primitive object={scene} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );

  return (
    <group>
      {renderModel(idleVisibleRef, idleNorm, idleGltf.scene)}
      {renderModel(walkVisibleRef, walkNorm, walkGltf.scene)}
      {renderModel(runVisibleRef, runNorm, runGltf.scene)}
    </group>
  );
}

useGLTF.preload(goblinStandingUrl);
useGLTF.preload(goblinWalkingUrl);
useGLTF.preload(goblinRunningUrl);
