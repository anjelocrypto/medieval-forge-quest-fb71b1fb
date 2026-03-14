/**
 * HorseGLBModel — GLB-based horse with standing/walking animations.
 * Uses TWO separate cloned scenes (one per animation) and swaps visibility,
 * since the standing and walking GLBs may have different skeletons.
 */
import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

import horseStandingUrl from '@/assets/horsestanding.glb';
import horseWalkingUrl from '@/assets/horsewalk.glb';

interface Props {
  moveSpeed: number | React.RefObject<number>;
  scale?: number;
}

export function HorseGLBModel({ moveSpeed, scale = 1 }: Props) {
  const standingGltf = useGLTF(horseStandingUrl);
  const walkingGltf = useGLTF(horseWalkingUrl);

  const standScene = useMemo(() => SkeletonUtils.clone(standingGltf.scene), [standingGltf.scene]);
  const walkScene = useMemo(() => SkeletonUtils.clone(walkingGltf.scene), [walkingGltf.scene]);

  const standMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const walkMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentStateRef = useRef<'standing' | 'walking'>('standing');

  // Calculate Y offset to place feet on ground (use standing as reference)
  const yOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(standScene);
    return -box.min.y;
  }, [standScene]);

  const walkYOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(walkScene);
    return -box.min.y;
  }, [walkScene]);

  useEffect(() => {
    // Standing mixer
    const sMixer = new THREE.AnimationMixer(standScene);
    standMixerRef.current = sMixer;
    if (standingGltf.animations.length > 0) {
      const action = sMixer.clipAction(standingGltf.animations[0]);
      action.play();
    }

    // Walking mixer
    const wMixer = new THREE.AnimationMixer(walkScene);
    walkMixerRef.current = wMixer;
    if (walkingGltf.animations.length > 0) {
      const action = wMixer.clipAction(walkingGltf.animations[0]);
      action.play();
    }

    // Initial visibility
    standScene.visible = true;
    walkScene.visible = false;
    currentStateRef.current = 'standing';

    console.log(`[HorseAudit] INIT standAnims=${standingGltf.animations.length} walkAnims=${walkingGltf.animations.length}`);

    return () => {
      sMixer.stopAllAction();
      sMixer.uncacheRoot(standScene);
      wMixer.stopAllAction();
      wMixer.uncacheRoot(walkScene);
    };
  }, [standScene, walkScene, standingGltf.animations, walkingGltf.animations]);

  const auditCountRef = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    standMixerRef.current?.update(dt);
    walkMixerRef.current?.update(dt);

    // Read speed from ref or direct value
    const speed = typeof moveSpeed === 'number' ? moveSpeed : (moveSpeed.current ?? 0);
    const isMoving = speed > 0.3;
    const wantState = isMoving ? 'walking' : 'standing';

    // Debug audit logging (first 10 frames)
    if (auditCountRef.current < 10) {
      auditCountRef.current++;
      console.log(`[HorseAudit] speed=${speed.toFixed(2)} anim=${wantState} refType=${typeof moveSpeed === 'number' ? 'number' : 'ref'}`);
    }

    if (wantState !== currentStateRef.current) {
      currentStateRef.current = wantState;
      console.log(`[HorseAudit] TRANSITION → ${wantState} speed=${speed.toFixed(2)}`);
      if (wantState === 'walking') {
        standScene.visible = false;
        walkScene.visible = true;
      } else {
        standScene.visible = true;
        walkScene.visible = false;
      }
    }
  });

  return (
    <group>
      <group position={[0, yOffset * scale, 0]}>
        <primitive
          object={standScene}
          scale={[scale, scale, scale]}
          castShadow
          receiveShadow
        />
      </group>
      <group position={[0, walkYOffset * scale, 0]}>
        <primitive
          object={walkScene}
          scale={[scale, scale, scale]}
          castShadow
          receiveShadow
        />
      </group>
    </group>
  );
}
