import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import standingUrl from '@/assets/standing.glb?url';
import soldierWalkUrl from '@/assets/soldierwalking.glb?url';
import runUrl from '@/assets/run.glb?url';
import gethitUrl from '@/assets/gethit.glb?url';
import fightUrl from '@/assets/fight.glb?url';

interface Props {
  moveSpeed: number;
  isRunning: boolean;
  attackAnim: number;
  health: number;
  emote: string | null;
}

const ROOT_RE = /(hips|pelvis|root|armature)/i;

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

type RemoteState = 'idle' | 'walk' | 'run' | 'fight' | 'hit' | 'dead';

export function RemoteSoldierModel({ moveSpeed, isRunning, attackAnim, health, emote }: Props) {
  const idleGltf = useGLTF(standingUrl);
  const walkGltf = useGLTF(soldierWalkUrl);
  const runGltf = useGLTF(runUrl);
  const hitGltf = useGLTF(gethitUrl);
  const fightGltf = useGLTF(fightUrl);

  const idleRef = useRef<THREE.Group>(null);
  const walkRef = useRef<THREE.Group>(null);
  const runRef = useRef<THREE.Group>(null);
  const hitRef = useRef<THREE.Group>(null);
  const fightRef = useRef<THREE.Group>(null);
  const deadRef = useRef<THREE.Group>(null);

  const stateRef = useRef<RemoteState>('idle');
  const prevAttackRef = useRef(0);
  const fightTimerRef = useRef(0);

  const idleClips = useMemo(() => sanitizeClips(idleGltf.animations), [idleGltf.animations]);
  const walkClips = useMemo(() => sanitizeClips(walkGltf.animations), [walkGltf.animations]);
  const runClips = useMemo(() => sanitizeClips(runGltf.animations), [runGltf.animations]);
  const hitClips = useMemo(() => sanitizeClips(hitGltf.animations), [hitGltf.animations]);
  const fightClips = useMemo(() => sanitizeClips(fightGltf.animations), [fightGltf.animations]);

  const { actions: idleActions } = useAnimations(idleClips, idleGltf.scene);
  const { actions: walkActions } = useAnimations(walkClips, walkGltf.scene);
  const { actions: runActions } = useAnimations(runClips, runGltf.scene);
  const { actions: hitActions } = useAnimations(hitClips, hitGltf.scene);
  const { actions: fightActions } = useAnimations(fightClips, fightGltf.scene);

  // Enable shadows
  useEffect(() => {
    [idleGltf.scene, walkGltf.scene, runGltf.scene, hitGltf.scene, fightGltf.scene].forEach(s => {
      s.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    });
  }, [idleGltf.scene, walkGltf.scene, runGltf.scene, hitGltf.scene, fightGltf.scene]);

  // Start looping animations
  useEffect(() => {
    const playLoop = (actions: Record<string, THREE.AnimationAction | null>) => {
      const name = Object.keys(actions)[0];
      if (!name || !actions[name]) return;
      const a = actions[name]!;
      a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.enabled = true; a.play();
      return () => { a.stop(); };
    };
    const cleanups = [playLoop(idleActions), playLoop(walkActions), playLoop(runActions)];
    return () => cleanups.forEach(c => c?.());
  }, [idleActions, walkActions, runActions]);

  const setVisible = (state: RemoteState) => {
    if (idleRef.current) idleRef.current.visible = state === 'idle';
    if (walkRef.current) walkRef.current.visible = state === 'walk';
    if (runRef.current) runRef.current.visible = state === 'run';
    if (hitRef.current) hitRef.current.visible = state === 'hit';
    if (fightRef.current) fightRef.current.visible = state === 'fight';
    if (deadRef.current) deadRef.current.visible = state === 'dead';
  };

  useEffect(() => { setVisible('idle'); }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const isDead = health <= 0;

    // Death — just show a fallen box for soldier (no dedicated death GLB yet)
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

    // Locomotion
    let target: RemoteState = 'idle';
    if (moveSpeed > 0.07) {
      target = isRunning || moveSpeed > 0.7 ? 'run' : 'walk';
    }

    if (target !== stateRef.current) {
      stateRef.current = target;
      setVisible(target);
    }
  });

  const scale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(idleGltf.scene);
    const h = box.getSize(new THREE.Vector3()).y;
    return h > 0.01 ? 1.8 / h : 1;
  }, [idleGltf.scene]);

  return (
    <group scale={[scale, scale, scale]} position={[0, 0, 0]}>
      <group ref={idleRef}><primitive object={idleGltf.scene} /></group>
      <group ref={walkRef} visible={false}><primitive object={walkGltf.scene} /></group>
      <group ref={runRef} visible={false}><primitive object={runGltf.scene} /></group>
      <group ref={hitRef} visible={false}><primitive object={hitGltf.scene} /></group>
      <group ref={fightRef} visible={false}><primitive object={fightGltf.scene} /></group>
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
