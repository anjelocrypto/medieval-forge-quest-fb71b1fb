/**
 * HorseGLBModel — GLB-based horse with standing/walking animations.
 * Used by both the free-roaming Horse component and mounted horse in Player.
 */
import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

import horseStandingUrl from '@/assets/horsestanding.glb';
import horseWalkingUrl from '@/assets/horsewalk.glb';

interface Props {
  moveSpeed: number;
  /** Scale override (default 1) */
  scale?: number;
}

export function HorseGLBModel({ moveSpeed, scale = 1 }: Props) {
  const standingGltf = useGLTF(horseStandingUrl);
  const walkingGltf = useGLTF(horseWalkingUrl);

  const clonedScene = useMemo(() => SkeletonUtils.clone(standingGltf.scene), [standingGltf.scene]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const standActionRef = useRef<THREE.AnimationAction | null>(null);
  const walkActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentStateRef = useRef<'standing' | 'walking'>('standing');

  // Calculate Y offset to place feet on ground
  const yOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    return -box.min.y; // lift model so lowest point is at Y=0
  }, [clonedScene]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;

    if (standingGltf.animations.length > 0) {
      const action = mixer.clipAction(standingGltf.animations[0], clonedScene);
      action.play();
      action.setEffectiveWeight(1);
      standActionRef.current = action;
    }

    if (walkingGltf.animations.length > 0) {
      const action = mixer.clipAction(walkingGltf.animations[0], clonedScene);
      action.play();
      action.setEffectiveWeight(0);
      walkActionRef.current = action;
    }

    currentStateRef.current = 'standing';

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
    };
  }, [clonedScene, standingGltf.animations, walkingGltf.animations]);

  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    const dt = Math.min(delta, 0.05);
    mixer.update(dt);

    const isMoving = moveSpeed > 0.5;
    const wantState = isMoving ? 'walking' : 'standing';

    if (wantState !== currentStateRef.current) {
      currentStateRef.current = wantState;
      const fadeTime = 0.3;
      if (wantState === 'walking') {
        walkActionRef.current?.reset().setEffectiveWeight(1).fadeIn(fadeTime).play();
        standActionRef.current?.fadeOut(fadeTime);
      } else {
        standActionRef.current?.reset().setEffectiveWeight(1).fadeIn(fadeTime).play();
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
