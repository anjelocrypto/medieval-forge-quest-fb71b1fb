import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import standingUrl from '@/assets/standing.glb?url';
import soldierWalkUrl from '@/assets/soldierwalking.glb?url';
import runUrl from '@/assets/run.glb?url';
import gethitUrl from '@/assets/gethit.glb?url';
import fightUrl from '@/assets/fight.glb?url';
import jumpUrl from '@/assets/jump.glb?url';

interface Props {
  moveSpeed: number;
  isRunning: boolean;
  isGrounded: boolean;
  attackAnim: number;
  health: number;
  emote: string | null;
}

const ROOT_RE = /(hips|pelvis|root|armature)/i;
const TARGET_HEIGHT = 1.8; // soldier normalized height

function sanitizeClips(animations: THREE.AnimationClip[]): THREE.AnimationClip[] {
  return animations.map((clip) => {
    const c = clip.clone();
    c.tracks = c.tracks.filter((t) => {
      if (!t.name.endsWith('.position')) return true;
      return !ROOT_RE.test(t.name.slice(0, t.name.lastIndexOf('.')));
    });
    return c;
  });
}

/** Clone a GLTF scene deeply so each instance has its own skeleton */
function cloneScene(scene: THREE.Group): THREE.Group {
  const cloned = scene.clone(true);
  
  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  const origSkinnedMeshes: THREE.SkinnedMesh[] = [];
  
  scene.traverse((node) => {
    if ((node as THREE.SkinnedMesh).isSkinnedMesh) {
      origSkinnedMeshes.push(node as THREE.SkinnedMesh);
    }
  });
  
  cloned.traverse((node) => {
    if ((node as THREE.SkinnedMesh).isSkinnedMesh) {
      skinnedMeshes.push(node as THREE.SkinnedMesh);
    }
  });
  
  for (let i = 0; i < skinnedMeshes.length && i < origSkinnedMeshes.length; i++) {
    const clonedMesh = skinnedMeshes[i];
    const origSkeleton = origSkinnedMeshes[i].skeleton;
    
    const clonedBones: THREE.Bone[] = [];
    for (const origBone of origSkeleton.bones) {
      const found = cloned.getObjectByName(origBone.name) as THREE.Bone;
      if (found) clonedBones.push(found);
    }
    
    if (clonedBones.length === origSkeleton.bones.length) {
      clonedMesh.skeleton = new THREE.Skeleton(clonedBones, origSkeleton.boneInverses.map(m => m.clone()));
      clonedMesh.bind(clonedMesh.skeleton, clonedMesh.matrixWorld);
    }
  }
  
  return cloned;
}

type RemoteState = 'idle' | 'walk' | 'run' | 'jump' | 'fight' | 'hit' | 'dead';

export function RemoteSoldierModel({ moveSpeed, isRunning, isGrounded, attackAnim, health, emote }: Props) {
  const idleGltf = useGLTF(standingUrl);
  const walkGltf = useGLTF(soldierWalkUrl);
  const runGltf = useGLTF(runUrl);
  const hitGltf = useGLTF(gethitUrl);
  const fightGltf = useGLTF(fightUrl);
  const jumpGltf = useGLTF(jumpUrl);

  // Clone scenes per instance
  const idleScene = useMemo(() => cloneScene(idleGltf.scene), [idleGltf.scene]);
  const walkScene = useMemo(() => cloneScene(walkGltf.scene), [walkGltf.scene]);
  const runScene = useMemo(() => cloneScene(runGltf.scene), [runGltf.scene]);
  const hitScene = useMemo(() => cloneScene(hitGltf.scene), [hitGltf.scene]);
  const fightScene = useMemo(() => cloneScene(fightGltf.scene), [fightGltf.scene]);
  const jumpScene = useMemo(() => cloneScene(jumpGltf.scene), [jumpGltf.scene]);

  const idleRef = useRef<THREE.Group>(null);
  const walkRef = useRef<THREE.Group>(null);
  const runRef = useRef<THREE.Group>(null);
  const hitRef = useRef<THREE.Group>(null);
  const fightRef = useRef<THREE.Group>(null);
  const deadRef = useRef<THREE.Group>(null);
  const jumpRef = useRef<THREE.Group>(null);

  const stateRef = useRef<RemoteState>('idle');
  const prevAttackRef = useRef(0);
  const fightTimerRef = useRef(0);

  const idleClips = useMemo(() => sanitizeClips(idleGltf.animations), [idleGltf.animations]);
  const walkClips = useMemo(() => sanitizeClips(walkGltf.animations), [walkGltf.animations]);
  const runClips = useMemo(() => sanitizeClips(runGltf.animations), [runGltf.animations]);
  const hitClips = useMemo(() => sanitizeClips(hitGltf.animations), [hitGltf.animations]);
  const fightClips = useMemo(() => sanitizeClips(fightGltf.animations), [fightGltf.animations]);
  const jumpClips = useMemo(() => sanitizeClips(jumpGltf.animations), [jumpGltf.animations]);

  const { actions: idleActions } = useAnimations(idleClips, idleScene);
  const { actions: walkActions } = useAnimations(walkClips, walkScene);
  const { actions: runActions } = useAnimations(runClips, runScene);
  const { actions: hitActions } = useAnimations(hitClips, hitScene);
  const { actions: fightActions } = useAnimations(fightClips, fightScene);
  const { actions: jumpActions } = useAnimations(jumpClips, jumpScene);

  // Enable shadows
  useEffect(() => {
    [idleScene, walkScene, runScene, hitScene, fightScene, jumpScene].forEach(s => {
      s.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    });
  }, [idleScene, walkScene, runScene, hitScene, fightScene, jumpScene]);

  // Start looping animations
  useEffect(() => {
    const playLoop = (actions: Record<string, THREE.AnimationAction | null>) => {
      const name = Object.keys(actions)[0];
      if (!name || !actions[name]) return;
      const a = actions[name]!;
      a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.enabled = true; a.play();
      return () => { a.stop(); };
    };
    const cleanups = [playLoop(idleActions), playLoop(walkActions), playLoop(runActions), playLoop(jumpActions)];
    return () => cleanups.forEach(c => c?.());
  }, [idleActions, walkActions, runActions, jumpActions]);

  const setVisible = (state: RemoteState) => {
    if (idleRef.current) idleRef.current.visible = state === 'idle';
    if (walkRef.current) walkRef.current.visible = state === 'walk';
    if (runRef.current) runRef.current.visible = state === 'run';
    if (hitRef.current) hitRef.current.visible = state === 'hit';
    if (fightRef.current) fightRef.current.visible = state === 'fight';
    if (deadRef.current) deadRef.current.visible = state === 'dead';
    if (jumpRef.current) jumpRef.current.visible = state === 'jump';
  };

  useEffect(() => { setVisible('idle'); }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const isDead = health <= 0;

    // Death — show a fallen box for soldier (no dedicated death GLB yet)
    if (isDead && stateRef.current !== 'dead') {
      stateRef.current = 'dead';
      setVisible('dead');
      return;
    }
    if (isDead) return;

    // Fight
    if (attackAnim > 0 && prevAttackRef.current === 0 && stateRef.current !== 'fight') {
      stateRef.current = 'fight';
      fightTimerRef.current = 0;
      setVisible('fight');
      const name = Object.keys(fightActions)[0];
      if (name && fightActions[name]) { fightActions[name]!.reset(); fightActions[name]!.play(); }
    }
    prevAttackRef.current = attackAnim;

    if (stateRef.current === 'fight') {
      fightTimerRef.current += dt;
      if (fightTimerRef.current > 0.6) {
        stateRef.current = 'idle';
        setVisible('idle');
      }
      return;
    }

    // Jump
    if (!isGrounded && stateRef.current !== 'jump') {
      stateRef.current = 'jump';
      setVisible('jump');
      return;
    }

    // Locomotion
    if (isGrounded || stateRef.current === 'jump') {
      let target: RemoteState = 'idle';
      if (!isGrounded) {
        target = 'jump';
      } else if (moveSpeed > 0.07) {
        target = isRunning || moveSpeed > 0.7 ? 'run' : 'walk';
      }

      if (target !== stateRef.current) {
        stateRef.current = target;
        setVisible(target);
      }
    }
  });

  // Compute scale and feet offset
  const { scale, feetOffset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(idleGltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const h = size.y;
    const s = h > 0.01 ? TARGET_HEIGHT / h : 1;
    const feetY = box.min.y * s;
    return { scale: s, feetOffset: -feetY };
  }, [idleGltf.scene]);

  return (
    <group scale={[scale, scale, scale]} position={[0, feetOffset, 0]}>
      <group ref={idleRef}><primitive object={idleScene} /></group>
      <group ref={walkRef} visible={false}><primitive object={walkScene} /></group>
      <group ref={runRef} visible={false}><primitive object={runScene} /></group>
      <group ref={hitRef} visible={false}><primitive object={hitScene} /></group>
      <group ref={fightRef} visible={false}><primitive object={fightScene} /></group>
      <group ref={jumpRef} visible={false}><primitive object={jumpScene} /></group>
      {/* Dead fallback */}
      <group ref={deadRef} visible={false}>
        <mesh position={[0, 0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.5, 1.6, 0.3]} />
          <meshLambertMaterial color="#3a5a8a" />
        </mesh>
      </group>
    </group>
  );
}

useGLTF.preload(standingUrl);
useGLTF.preload(soldierWalkUrl);
useGLTF.preload(runUrl);
useGLTF.preload(gethitUrl);
useGLTF.preload(fightUrl);
useGLTF.preload(jumpUrl);
