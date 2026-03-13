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
import waveUrl from '@/assets/wave.glb?url';
import agreeUrl from '@/assets/agreegesture.glb?url';

interface Props {
  moveSpeed: number;
  isRunning: boolean;
  isGrounded: boolean;
  attackAnim: number;
  health: number;
  emote: string | null;
}

const ROOT_RE = /(hips|pelvis|root|armature)/i;
const TARGET_HEIGHT = 1.8;

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

function normalizeMaterial(mat: THREE.Material): THREE.Material {
  const cloned = mat.clone();
  if (cloned instanceof THREE.MeshStandardMaterial || cloned instanceof THREE.MeshPhysicalMaterial) {
    cloned.emissive.set(0x000000);
    cloned.emissiveIntensity = 0;
    if (cloned.metalness > 0.3) cloned.metalness = 0.1;
    if (cloned.roughness < 0.3) cloned.roughness = 0.5;
    cloned.transparent = false;
    cloned.opacity = 1;
    cloned.depthWrite = true;
    cloned.side = THREE.FrontSide;
  }
  return cloned;
}

function cloneScene(scene: THREE.Group): THREE.Group {
  const cloned = scene.clone(true);
  cloned.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (mesh.isMesh && mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(normalizeMaterial);
      } else {
        mesh.material = normalizeMaterial(mesh.material);
      }
    }
  });
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

type RemoteState = 'idle' | 'walk' | 'run' | 'jump' | 'fight' | 'hit' | 'dead' | 'emote_wave' | 'emote_agree';

export function RemoteSoldierModel({ moveSpeed, isRunning, isGrounded, attackAnim, health, emote }: Props) {
  const idleGltf = useGLTF(standingUrl);
  const walkGltf = useGLTF(soldierWalkUrl);
  const runGltf = useGLTF(runUrl);
  const hitGltf = useGLTF(gethitUrl);
  const fightGltf = useGLTF(fightUrl);
  const jumpGltf = useGLTF(jumpUrl);
  const waveGltf = useGLTF(waveUrl);
  const agreeGltf = useGLTF(agreeUrl);

  // Clone scenes per instance
  const idleScene = useMemo(() => cloneScene(idleGltf.scene), [idleGltf.scene]);
  const walkScene = useMemo(() => cloneScene(walkGltf.scene), [walkGltf.scene]);
  const runScene = useMemo(() => cloneScene(runGltf.scene), [runGltf.scene]);
  const hitScene = useMemo(() => cloneScene(hitGltf.scene), [hitGltf.scene]);
  const fightScene = useMemo(() => cloneScene(fightGltf.scene), [fightGltf.scene]);
  const jumpScene = useMemo(() => cloneScene(jumpGltf.scene), [jumpGltf.scene]);
  const waveScene = useMemo(() => cloneScene(waveGltf.scene), [waveGltf.scene]);
  const agreeScene = useMemo(() => cloneScene(agreeGltf.scene), [agreeGltf.scene]);

  const idleRef = useRef<THREE.Group>(null);
  const walkRef = useRef<THREE.Group>(null);
  const runRef = useRef<THREE.Group>(null);
  const hitRef = useRef<THREE.Group>(null);
  const fightRef = useRef<THREE.Group>(null);
  const deadRef = useRef<THREE.Group>(null);
  const jumpRef = useRef<THREE.Group>(null);
  const waveRef = useRef<THREE.Group>(null);
  const agreeRef = useRef<THREE.Group>(null);

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
  const jumpClips = useMemo(() => sanitizeClips(jumpGltf.animations), [jumpGltf.animations]);
  const waveClips = useMemo(() => sanitizeClips(waveGltf.animations), [waveGltf.animations]);
  const agreeClips = useMemo(() => sanitizeClips(agreeGltf.animations), [agreeGltf.animations]);

  const { actions: idleActions } = useAnimations(idleClips, idleScene);
  const { actions: walkActions } = useAnimations(walkClips, walkScene);
  const { actions: runActions } = useAnimations(runClips, runScene);
  const { actions: hitActions } = useAnimations(hitClips, hitScene);
  const { actions: fightActions } = useAnimations(fightClips, fightScene);
  const { actions: jumpActions } = useAnimations(jumpClips, jumpScene);
  const { actions: waveActions } = useAnimations(waveClips, waveScene);
  const { actions: agreeActions } = useAnimations(agreeClips, agreeScene);

  // Enable shadows
  useEffect(() => {
    [idleScene, walkScene, runScene, hitScene, fightScene, jumpScene, waveScene, agreeScene].forEach(s => {
      s.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    });
  }, [idleScene, walkScene, runScene, hitScene, fightScene, jumpScene, waveScene, agreeScene]);

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
    if (waveRef.current) waveRef.current.visible = state === 'emote_wave';
    if (agreeRef.current) agreeRef.current.visible = state === 'emote_agree';
  };

  useEffect(() => { setVisible('idle'); }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const isDead = health <= 0;

    // === DEATH ===
    if (isDead && stateRef.current !== 'dead') {
      stateRef.current = 'dead';
      setVisible('dead');
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
      if (hitTimerRef.current > 0.6) {
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
      if (emote === 'wave') {
        stateRef.current = 'emote_wave';
        emoteTimerRef.current = 0;
        setVisible('emote_wave');
        const name = Object.keys(waveActions)[0];
        if (name && waveActions[name]) { waveActions[name]!.reset(); waveActions[name]!.setLoop(THREE.LoopOnce, 1); waveActions[name]!.clampWhenFinished = true; waveActions[name]!.play(); }
      } else if (emote === 'agree') {
        stateRef.current = 'emote_agree';
        emoteTimerRef.current = 0;
        setVisible('emote_agree');
        const name = Object.keys(agreeActions)[0];
        if (name && agreeActions[name]) { agreeActions[name]!.reset(); agreeActions[name]!.setLoop(THREE.LoopOnce, 1); agreeActions[name]!.clampWhenFinished = true; agreeActions[name]!.play(); }
      }
    }
    prevEmoteRef.current = emote;

    if (stateRef.current === 'emote_wave' || stateRef.current === 'emote_agree') {
      emoteTimerRef.current += dt;
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
      <group ref={waveRef} visible={false}><primitive object={waveScene} /></group>
      <group ref={agreeRef} visible={false}><primitive object={agreeScene} /></group>
      {/* Dead fallback — no soldier death GLB available */}
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
useGLTF.preload(waveUrl);
useGLTF.preload(agreeUrl);
