/**
 * HorseGLBModel — single bundled GLB with multiple animation clips.
 * horse.glb contains the mesh + all animations (standing, walking, etc.)
 * We pick clips by index or name and crossfade based on moveSpeed.
 */
import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

import horseUrl from '@/assets/horse.glb';

interface Props {
  moveSpeed: number | React.RefObject<number>;
  scale?: number;
  renderPath?: string;
}

const HORSE_MOVE_THRESHOLD = 0.3;

export function HorseGLBModel({ moveSpeed, scale = 1, renderPath = 'unknown' }: Props) {
  const gltf = useGLTF(horseUrl);

  const clonedScene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const idleActionRef = useRef<THREE.AnimationAction | null>(null);
  const walkActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentStateRef = useRef<'idle' | 'walking'>('idle');
  const auditLoggedRef = useRef(false);

  const yOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    return -box.min.y;
  }, [clonedScene]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;

    const clips = gltf.animations;

    // Log all available clips for debugging
    console.log(`[HorseAudit] render path = ${renderPath}`);
    console.log(`[HorseAudit] total animation clips = ${clips.length}`);
    clips.forEach((clip, i) => {
      console.log(`[HorseAudit] clip[${i}] name="${clip.name}" duration=${clip.duration.toFixed(2)}s tracks=${clip.tracks.length}`);
    });

    // Heuristic: find idle/standing clip and walking clip by name
    // Common naming: "idle", "standing", "walk", "walking", or just index-based
    const findClip = (keywords: string[]): THREE.AnimationClip | null => {
      for (const kw of keywords) {
        const found = clips.find(c => c.name.toLowerCase().includes(kw));
        if (found) return found;
      }
      return null;
    };

    const idleClip = findClip(['idle', 'stand']) ?? clips[0] ?? null;
    const walkClip = findClip(['walk', 'run', 'trot']) ?? clips[1] ?? null;

    console.log(`[HorseAudit] idle clip = ${idleClip?.name ?? 'NONE'}`);
    console.log(`[HorseAudit] walk clip = ${walkClip?.name ?? 'NONE'}`);

    if (idleClip) {
      const action = mixer.clipAction(idleClip);
      action.play();
      action.setEffectiveWeight(1);
      idleActionRef.current = action;
    }

    if (walkClip && walkClip !== idleClip) {
      const action = mixer.clipAction(walkClip);
      action.play();
      action.setEffectiveWeight(0);
      walkActionRef.current = action;
    }

    currentStateRef.current = 'idle';
    auditLoggedRef.current = false;

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
    };
  }, [clonedScene, gltf.animations, renderPath]);

  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    if (!mixer) return;

    mixer.update(Math.min(delta, 0.05));

    const speed = typeof moveSpeed === 'number' ? moveSpeed : (moveSpeed.current ?? 0);
    const wantWalk = speed > HORSE_MOVE_THRESHOLD;
    const wantState: 'idle' | 'walking' = wantWalk ? 'walking' : 'idle';

    if (!auditLoggedRef.current) {
      auditLoggedRef.current = true;
      console.log(`[HorseAudit] mixer running = yes, speed=${speed.toFixed(2)}, state=${wantState}`);
    }

    if (wantState !== currentStateRef.current) {
      currentStateRef.current = wantState;
      const fadeTime = 0.25;

      if (wantState === 'walking') {
        walkActionRef.current?.reset().setEffectiveWeight(1).fadeIn(fadeTime).play();
        idleActionRef.current?.fadeOut(fadeTime);
      } else {
        idleActionRef.current?.reset().setEffectiveWeight(1).fadeIn(fadeTime).play();
        walkActionRef.current?.fadeOut(fadeTime);
      }
    }
  });

  return (
    <group position={[0, yOffset * scale, 0]}>
      <primitive
        object={clonedScene}
        scale={[scale, scale, scale]}
        castShadow
        receiveShadow
      />
    </group>
  );
}
