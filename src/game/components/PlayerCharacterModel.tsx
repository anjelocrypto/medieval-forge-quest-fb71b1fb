import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import soldierWalkUrl from '@/assets/soldierwalking.glb?url';
import soldierIdleUrl from '@/assets/soldier.glb?url';

interface PlayerGLBModelProps {
  moveSpeedRef: React.MutableRefObject<number>;
}

interface ModelInspection {
  label: 'idle' | 'walk';
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
}

interface ModelNormalization {
  anchorOffset: [number, number, number];
  scale: number;
  yawCorrection: number;
}

const MOVE_START_THRESHOLD = 0.07;
const MOVE_STOP_THRESHOLD = 0.04;
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
const _tmpCenter = new THREE.Vector3();
const _tmpSize = new THREE.Vector3();

export function PlayerGLBModel({ moveSpeedRef }: PlayerGLBModelProps) {
  const walkGltf = useGLTF(soldierWalkUrl);
  const idleGltf = useGLTF(soldierIdleUrl);

  const idleVisibleRef = useRef<THREE.Group>(null);
  const walkVisibleRef = useRef<THREE.Group>(null);
  const movingRef = useRef(false);
  const auditLoggedRef = useRef(false);

  const sanitizedWalkClips = useMemo(() => {
    return walkGltf.animations.map((clip) => {
      const clonedClip = clip.clone();
      clonedClip.tracks = clonedClip.tracks.filter((track) => {
        if (!track.name.endsWith('.position')) return true;
        const target = track.name.slice(0, track.name.lastIndexOf('.'));
        return !ROOT_TRANSLATION_NAME_RE.test(target);
      });
      return clonedClip;
    });
  }, [walkGltf.animations]);

  const walkInspection = useMemo(() => inspectModel('walk', walkGltf.scene), [walkGltf.scene]);
  const idleInspection = useMemo(() => inspectModel('idle', idleGltf.scene), [idleGltf.scene]);

  const canonicalHeight = useMemo(() => {
    if (idleInspection.height > 0.01) return idleInspection.height;
    if (walkInspection.height > 0.01) return walkInspection.height;
    return 1.8;
  }, [idleInspection.height, walkInspection.height]);

  const canonicalYawCorrection = useMemo(() => {
    return walkInspection.facingYaw !== null ? -walkInspection.facingYaw : 0;
  }, [walkInspection.facingYaw]);

  const idleNormalization = useMemo(() => {
    return buildNormalization(idleInspection, canonicalHeight, canonicalYawCorrection);
  }, [idleInspection, canonicalHeight, canonicalYawCorrection]);

  const walkNormalization = useMemo(() => {
    return buildNormalization(walkInspection, canonicalHeight, canonicalYawCorrection);
  }, [walkInspection, canonicalHeight, canonicalYawCorrection]);

  const { actions, clips } = useAnimations(sanitizedWalkClips, walkGltf.scene);

  const walkClipName = useMemo(() => {
    if (clips.length === 0) return null;
    const namedWalk = clips.find((clip) => /walk/i.test(clip.name));
    return namedWalk?.name ?? clips[0].name;
  }, [clips]);

  useEffect(() => {
    enableMeshShadows(idleGltf.scene);
    enableMeshShadows(walkGltf.scene);
  }, [idleGltf.scene, walkGltf.scene]);

  useEffect(() => {
    if (!walkClipName) return;
    const action = actions[walkClipName];
    if (!action) return;

    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.enabled = true;
    action.play();
    action.paused = true;

    return () => {
      action.stop();
    };
  }, [actions, walkClipName]);

  useEffect(() => {
    if (auditLoggedRef.current) return;
    auditLoggedRef.current = true;

    const rawDrift = summarizeRootMotionDrift(walkGltf.animations);
    const sanitizedDrift = summarizeRootMotionDrift(sanitizedWalkClips);

    console.groupCollapsed('[Character Audit] GLB integration deep audit');
    console.log('Canonical rule: gameplay forward == visual forward (+Z local basis)');
    console.log('Idle inspection:', serializeInspection(idleInspection));
    console.log('Walk inspection:', serializeInspection(walkInspection));
    console.log('Idle normalization:', idleNormalization);
    console.log('Walk normalization:', walkNormalization);
    console.log('Walk clip selected:', walkClipName);
    console.log('Raw walk root translation drift:', rawDrift);
    console.log('Sanitized walk root translation drift:', sanitizedDrift);
    console.groupEnd();
  }, [
    idleInspection,
    walkInspection,
    idleNormalization,
    walkNormalization,
    walkClipName,
    walkGltf.animations,
    sanitizedWalkClips,
  ]);

  useEffect(() => {
    if (idleVisibleRef.current) idleVisibleRef.current.visible = true;
    if (walkVisibleRef.current) walkVisibleRef.current.visible = false;
  }, []);

  useFrame(() => {
    const speed = moveSpeedRef.current;
    const shouldMove = movingRef.current
      ? speed > MOVE_STOP_THRESHOLD
      : speed > MOVE_START_THRESHOLD;

    if (shouldMove !== movingRef.current) {
      movingRef.current = shouldMove;
      if (idleVisibleRef.current) idleVisibleRef.current.visible = !shouldMove;
      if (walkVisibleRef.current) walkVisibleRef.current.visible = shouldMove;
    }

    if (!walkClipName) return;
    const action = actions[walkClipName];
    if (!action) return;

    if (shouldMove) {
      action.paused = false;
      const normalizedSpeed = THREE.MathUtils.clamp(speed, 0, 1.4);
      action.setEffectiveTimeScale(Math.max(0.55, normalizedSpeed * 1.35));
      return;
    }

    action.paused = true;
  });

  return (
    <group>
      {/* Stable visual root: gameplay root (parent) -> orientation layer -> scale layer -> ground anchor layer */}
      <group ref={idleVisibleRef}>
        <group rotation={[0, idleNormalization.yawCorrection, 0]}>
          <group scale={[idleNormalization.scale, idleNormalization.scale, idleNormalization.scale]}>
            <group position={idleNormalization.anchorOffset}>
              <primitive object={idleGltf.scene} />
            </group>
          </group>
        </group>
      </group>

      <group ref={walkVisibleRef}>
        <group rotation={[0, walkNormalization.yawCorrection, 0]}>
          <group scale={[walkNormalization.scale, walkNormalization.scale, walkNormalization.scale]}>
            <group position={walkNormalization.anchorOffset}>
              <primitive object={walkGltf.scene} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function buildNormalization(
  inspection: ModelInspection,
  canonicalHeight: number,
  fallbackYawCorrection: number,
): ModelNormalization {
  const scale = inspection.height > 0.01
    ? canonicalHeight / inspection.height
    : 1;

  const yawCorrection = inspection.facingYaw !== null
    ? -inspection.facingYaw
    : fallbackYawCorrection;

  return {
    anchorOffset: [
      -inspection.anchor.x,
      -inspection.footY,
      -inspection.anchor.z,
    ],
    scale,
    yawCorrection,
  };
}

function inspectModel(label: 'idle' | 'walk', scene: THREE.Object3D): ModelInspection {
  scene.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(_tmpSize.clone());
  const center = bounds.getCenter(_tmpCenter.clone());

  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  scene.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      skinnedMeshes.push(child as THREE.SkinnedMesh);
    }
  });

  const primarySkinnedMesh = skinnedMeshes[0] ?? null;
  const skeleton = primarySkinnedMesh?.skeleton ?? null;
  const hipsBone = skeleton?.bones.find((bone) => BONE_HIPS_RE.test(bone.name)) ?? skeleton?.bones[0] ?? null;

  const armature = scene.getObjectByName('Armature') ?? findArmatureNode(scene);
  const facingYaw = inferFacingYawFromSkeleton(skeleton);

  let anchorX = center.x;
  let anchorZ = center.z;

  if (hipsBone) {
    hipsBone.getWorldPosition(_tmpVecA);
    anchorX = _tmpVecA.x;
    anchorZ = _tmpVecA.z;
  }

  return {
    label,
    sceneRoot: scene,
    armature,
    skinnedMesh: primarySkinnedMesh,
    hipsBone,
    bounds,
    size: size.clone(),
    center: center.clone(),
    anchor: new THREE.Vector3(anchorX, 0, anchorZ),
    footY: bounds.min.y,
    height: size.y,
    facingYaw,
  };
}

function inferFacingYawFromSkeleton(skeleton: THREE.Skeleton | null): number | null {
  if (!skeleton || skeleton.bones.length === 0) return null;

  const hips = skeleton.bones.find((bone) => BONE_HIPS_RE.test(bone.name)) ?? null;
  const head = skeleton.bones.find((bone) => BONE_HEAD_RE.test(bone.name)) ?? null;
  const left = skeleton.bones.find((bone) => BONE_LEFT_RE.test(bone.name)) ?? null;
  const right = skeleton.bones.find((bone) => BONE_RIGHT_RE.test(bone.name)) ?? null;

  if (!hips || !head || !left || !right) return null;

  hips.getWorldPosition(_tmpVecA);
  head.getWorldPosition(_tmpVecB);
  left.getWorldPosition(_tmpVecC);
  right.getWorldPosition(_tmpVecD);

  _tmpUp.subVectors(_tmpVecB, _tmpVecA).normalize();
  _tmpRight.subVectors(_tmpVecD, _tmpVecC).normalize();
  _tmpForward.crossVectors(_tmpRight, _tmpUp).normalize();

  if (!Number.isFinite(_tmpForward.x) || !Number.isFinite(_tmpForward.z) || _tmpForward.lengthSq() < 1e-6) {
    return null;
  }

  return Math.atan2(_tmpForward.x, _tmpForward.z);
}

function summarizeRootMotionDrift(clips: THREE.AnimationClip[]) {
  return clips.map((clip) => {
    const rootTracks = clip.tracks.filter((track) => {
      if (!track.name.endsWith('.position')) return false;
      const target = track.name.slice(0, track.name.lastIndexOf('.'));
      return ROOT_TRANSLATION_NAME_RE.test(target);
    });

    const driftByTrack = rootTracks.map((track) => {
      const values = track.values;
      const firstX = values[0] ?? 0;
      const firstY = values[1] ?? 0;
      const firstZ = values[2] ?? 0;
      const lastX = values[values.length - 3] ?? 0;
      const lastY = values[values.length - 2] ?? 0;
      const lastZ = values[values.length - 1] ?? 0;
      const drift = Math.hypot(lastX - firstX, lastY - firstY, lastZ - firstZ);
      return {
        track: track.name,
        drift: Number(drift.toFixed(5)),
      };
    });

    return {
      clip: clip.name,
      rootPositionTrackCount: rootTracks.length,
      driftByTrack,
    };
  });
}

function serializeInspection(inspection: ModelInspection) {
  const root = inspection.sceneRoot;
  const rootRotation = new THREE.Euler().setFromQuaternion(root.quaternion, 'YXZ');

  return {
    model: inspection.label,
    sceneRoot: {
      position: toFixedVec3(root.position),
      rotation: toFixedVec3(rootRotation),
      scale: toFixedVec3(root.scale),
    },
    armature: inspection.armature
      ? {
          name: inspection.armature.name,
          position: toFixedVec3(inspection.armature.position),
          rotation: toFixedVec3(inspection.armature.rotation),
          scale: toFixedVec3(inspection.armature.scale),
        }
      : null,
    skinnedMesh: inspection.skinnedMesh
      ? {
          name: inspection.skinnedMesh.name,
          position: toFixedVec3(inspection.skinnedMesh.position),
          rotation: toFixedVec3(inspection.skinnedMesh.rotation),
          scale: toFixedVec3(inspection.skinnedMesh.scale),
        }
      : null,
    hipsBone: inspection.hipsBone
      ? {
          name: inspection.hipsBone.name,
          position: toFixedVec3(inspection.hipsBone.position),
          rotation: toFixedVec3(inspection.hipsBone.rotation),
        }
      : null,
    bounds: {
      min: toFixedVec3(inspection.bounds.min),
      max: toFixedVec3(inspection.bounds.max),
      size: toFixedVec3(inspection.size),
      center: toFixedVec3(inspection.center),
    },
    anchor: {
      x: Number(inspection.anchor.x.toFixed(4)),
      z: Number(inspection.anchor.z.toFixed(4)),
      footY: Number(inspection.footY.toFixed(4)),
      inferredFacingYaw: inspection.facingYaw !== null
        ? Number(inspection.facingYaw.toFixed(4))
        : null,
    },
  };
}

function toFixedVec3(v: THREE.Vector3 | THREE.Euler) {
  return {
    x: Number(v.x.toFixed(4)),
    y: Number(v.y.toFixed(4)),
    z: Number(v.z.toFixed(4)),
  };
}

function enableMeshShadows(scene: THREE.Object3D) {
  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function findArmatureNode(scene: THREE.Object3D): THREE.Object3D | null {
  let armature: THREE.Object3D | null = null;
  scene.traverse((child) => {
    if (armature) return;
    if (/armature/i.test(child.name)) {
      armature = child;
    }
  });
  return armature;
}

useGLTF.preload(soldierIdleUrl);
useGLTF.preload(soldierWalkUrl);
