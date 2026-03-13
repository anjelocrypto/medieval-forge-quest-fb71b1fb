import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import goblinStandingUrl from '@/assets/goblinstanding.glb?url';
import goblinWalkingUrl from '@/assets/goblinwalking.glb?url';
import goblinRunningUrl from '@/assets/goblinrunning.glb?url';
import goblinGetHitUrl from '@/assets/goblingethit.glb?url';
import goblinFightUrl from '@/assets/goblinfight.glb?url';
import goblinDeadUrl from '@/assets/goblindead.glb?url';
import goblinJumpUrl from '@/assets/goblinjump.glb?url';
import hiphopUrl from '@/assets/hiphop.glb?url';
import gangnamUrl from '@/assets/gangnam.glb?url';

interface Props {
  moveSpeed: number;
  isRunning: boolean;
  isGrounded: boolean;
  attackAnim: number;
  health: number;
  emote: string | null;
}

const ROOT_RE = /(hips|pelvis|root|armature)/i;
const TARGET_HEIGHT = 1.2;

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

function cloneScene(scene: THREE.Group): THREE.Group {
  const cloned = scene.clone(true);
  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  const origSkinnedMeshes: THREE.SkinnedMesh[] = [];
  scene.traverse((n) => { if ((n as THREE.SkinnedMesh).isSkinnedMesh) origSkinnedMeshes.push(n as THREE.SkinnedMesh); });
  cloned.traverse((n) => { if ((n as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes.push(n as THREE.SkinnedMesh); });
  for (let i = 0; i < skinnedMeshes.length && i < origSkinnedMeshes.length; i++) {
    const cm = skinnedMeshes[i];
    const os = origSkinnedMeshes[i].skeleton;
    const bones: THREE.Bone[] = [];
    for (const ob of os.bones) { const f = cloned.getObjectByName(ob.name) as THREE.Bone; if (f) bones.push(f); }
    if (bones.length === os.bones.length) {
      cm.skeleton = new THREE.Skeleton(bones, os.boneInverses.map(m => m.clone()));
      cm.bind(cm.skeleton, cm.matrixWorld);
    }
  }
  return cloned;
}

type RemoteState = 'idle' | 'walk' | 'run' | 'jump' | 'fight' | 'hit' | 'dead' | 'emote_hiphop' | 'emote_gangnam';

export function RemoteGoblinModel({ moveSpeed, isRunning, isGrounded, attackAnim, health, emote }: Props) {
  const idleGltf = useGLTF(goblinStandingUrl);
  const walkGltf = useGLTF(goblinWalkingUrl);
  const runGltf = useGLTF(goblinRunningUrl);
  const hitGltf = useGLTF(goblinGetHitUrl);
  const fightGltf = useGLTF(goblinFightUrl);
  const deadGltf = useGLTF(goblinDeadUrl);
  const jumpGltf = useGLTF(goblinJumpUrl);
  const hiphopGltf = useGLTF(hiphopUrl);
  const gangnamGltf = useGLTF(gangnamUrl);

  // Clone scenes per instance
  const idleScene = useMemo(() => cloneScene(idleGltf.scene), [idleGltf.scene]);
  const walkScene = useMemo(() => cloneScene(walkGltf.scene), [walkGltf.scene]);
  const runScene = useMemo(() => cloneScene(runGltf.scene), [runGltf.scene]);
  const hitScene = useMemo(() => cloneScene(hitGltf.scene), [hitGltf.scene]);
  const fightScene = useMemo(() => cloneScene(fightGltf.scene), [fightGltf.scene]);
  const deadScene = useMemo(() => cloneScene(deadGltf.scene), [deadGltf.scene]);
  const jumpScene = useMemo(() => cloneScene(jumpGltf.scene), [jumpGltf.scene]);
  const hiphopScene = useMemo(() => cloneScene(hiphopGltf.scene), [hiphopGltf.scene]);
  const gangnamScene = useMemo(() => cloneScene(gangnamGltf.scene), [gangnamGltf.scene]);

  const idleRef = useRef<THREE.Group>(null);
  const walkRef = useRef<THREE.Group>(null);
  const runRef = useRef<THREE.Group>(null);
  const hitRef = useRef<THREE.Group>(null);
  const fightRef = useRef<THREE.Group>(null);
  const deadRef = useRef<THREE.Group>(null);
  const jumpRef = useRef<THREE.Group>(null);
  const hiphopRef = useRef<THREE.Group>(null);
  const gangnamRef = useRef<THREE.Group>(null);

  const stateRef = useRef<RemoteState>('idle');
  const prevAttackRef = useRef(0);
  const prevHealthRef = useRef(health);
  const hitTimerRef = useRef(0);
  const fightTimerRef = useRef(0);
  const emoteTimerRef = useRef(0);
  const prevEmoteRef = useRef<string | null>(null);

  const idleClips = useMemo(() => sanitizeClips(idleGltf.animations), [idleGltf.animations]);
  const walkClips = useMemo(() => sanitizeClips(walkGltf.animations), [walkGltf.animations]);
  const runClips = useMemo(() => sanitizeClips(runGltf.animations), [runGltf.animations]);
  const hitClips = useMemo(() => sanitizeClips(hitGltf.animations), [hitGltf.animations]);
  const fightClips = useMemo(() => sanitizeClips(fightGltf.animations), [fightGltf.animations]);
  const deadClips = useMemo(() => sanitizeClips(deadGltf.animations), [deadGltf.animations]);
  const jumpClips = useMemo(() => sanitizeClips(jumpGltf.animations), [jumpGltf.animations]);
  const hiphopClips = useMemo(() => sanitizeClips(hiphopGltf.animations), [hiphopGltf.animations]);
  const gangnamClips = useMemo(() => sanitizeClips(gangnamGltf.animations), [gangnamGltf.animations]);

  const { actions: idleActions } = useAnimations(idleClips, idleScene);
  const { actions: walkActions } = useAnimations(walkClips, walkScene);
  const { actions: runActions } = useAnimations(runClips, runScene);
  const { actions: hitActions } = useAnimations(hitClips, hitScene);
  const { actions: fightActions } = useAnimations(fightClips, fightScene);
  const { actions: deadActions } = useAnimations(deadClips, deadScene);
  const { actions: jumpActions } = useAnimations(jumpClips, jumpScene);
  const { actions: hiphopActions } = useAnimations(hiphopClips, hiphopScene);
  const { actions: gangnamActions } = useAnimations(gangnamClips, gangnamScene);

  // Enable shadows
  useEffect(() => {
    [idleScene, walkScene, runScene, hitScene, fightScene, deadScene, jumpScene, hiphopScene, gangnamScene].forEach(s => {
      s.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    });
  }, [idleScene, walkScene, runScene, hitScene, fightScene, deadScene, jumpScene, hiphopScene, gangnamScene]);

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

  // Dead animation setup (play once, paused)
  useEffect(() => {
    const name = Object.keys(deadActions)[0];
    if (!name || !deadActions[name]) return;
    const a = deadActions[name]!;
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.enabled = true; a.play(); a.paused = true;
    return () => { a.stop(); };
  }, [deadActions]);

  const setVisible = (state: RemoteState) => {
    if (idleRef.current) idleRef.current.visible = state === 'idle';
    if (walkRef.current) walkRef.current.visible = state === 'walk';
    if (runRef.current) runRef.current.visible = state === 'run';
    if (hitRef.current) hitRef.current.visible = state === 'hit';
    if (fightRef.current) fightRef.current.visible = state === 'fight';
    if (deadRef.current) deadRef.current.visible = state === 'dead';
    if (jumpRef.current) jumpRef.current.visible = state === 'jump';
    if (hiphopRef.current) hiphopRef.current.visible = state === 'emote_hiphop';
    if (gangnamRef.current) gangnamRef.current.visible = state === 'emote_gangnam';
  };

  useEffect(() => { setVisible('idle'); }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const isDead = health <= 0;

    // === DEATH ===
    if (isDead && stateRef.current !== 'dead') {
      stateRef.current = 'dead';
      setVisible('dead');
      const name = Object.keys(deadActions)[0];
      if (name && deadActions[name]) { deadActions[name]!.reset(); deadActions[name]!.paused = false; deadActions[name]!.play(); }
      prevHealthRef.current = health;
      return;
    }
    if (isDead) return;

    // === HIT DETECTION (health decreased) ===
    if (health < prevHealthRef.current && stateRef.current !== 'hit' && stateRef.current !== 'fight' && stateRef.current !== 'dead') {
      stateRef.current = 'hit';
      hitTimerRef.current = 0;
      setVisible('hit');
      const name = Object.keys(hitActions)[0];
      if (name && hitActions[name]) { hitActions[name]!.reset(); hitActions[name]!.play(); }
    }
    prevHealthRef.current = health;

    // === HIT TIMER ===
    if (stateRef.current === 'hit') {
      hitTimerRef.current += dt;
      if (hitTimerRef.current > 0.8) {
        stateRef.current = 'idle';
        setVisible('idle');
      }
      return;
    }

    // === FIGHT ===
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

    // === EMOTE ANIMATIONS ===
    if (emote && emote !== prevEmoteRef.current) {
      if (emote === 'hiphop') {
        stateRef.current = 'emote_hiphop';
        emoteTimerRef.current = 0;
        setVisible('emote_hiphop');
        const name = Object.keys(hiphopActions)[0];
        if (name && hiphopActions[name]) { hiphopActions[name]!.reset(); hiphopActions[name]!.setLoop(THREE.LoopOnce, 1); hiphopActions[name]!.clampWhenFinished = true; hiphopActions[name]!.play(); }
      } else if (emote === 'gangnam') {
        stateRef.current = 'emote_gangnam';
        emoteTimerRef.current = 0;
        setVisible('emote_gangnam');
        const name = Object.keys(gangnamActions)[0];
        if (name && gangnamActions[name]) { gangnamActions[name]!.reset(); gangnamActions[name]!.setLoop(THREE.LoopOnce, 1); gangnamActions[name]!.clampWhenFinished = true; gangnamActions[name]!.play(); }
      }
    }
    prevEmoteRef.current = emote;

    // Emote state: wait for completion or emote cleared
    if (stateRef.current === 'emote_hiphop' || stateRef.current === 'emote_gangnam') {
      emoteTimerRef.current += dt;
      // Return to idle if emote cleared or timed out (safety)
      if (!emote || emoteTimerRef.current > 8) {
        stateRef.current = 'idle';
        setVisible('idle');
      }
      return;
    }

    // === JUMP ===
    if (!isGrounded && stateRef.current !== 'jump') {
      stateRef.current = 'jump';
      setVisible('jump');
      return;
    }

    // === LOCOMOTION ===
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
  });

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
      <group ref={deadRef} visible={false}><primitive object={deadScene} /></group>
      <group ref={jumpRef} visible={false}><primitive object={jumpScene} /></group>
      <group ref={hiphopRef} visible={false}><primitive object={hiphopScene} /></group>
      <group ref={gangnamRef} visible={false}><primitive object={gangnamScene} /></group>
    </group>
  );
}

useGLTF.preload(goblinStandingUrl);
useGLTF.preload(goblinWalkingUrl);
useGLTF.preload(goblinRunningUrl);
useGLTF.preload(goblinGetHitUrl);
useGLTF.preload(goblinFightUrl);
useGLTF.preload(goblinDeadUrl);
useGLTF.preload(goblinJumpUrl);
useGLTF.preload(hiphopUrl);
useGLTF.preload(gangnamUrl);
