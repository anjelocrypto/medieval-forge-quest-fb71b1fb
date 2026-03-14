/**
 * HorseGLBModel — dual-scene visibility swap.
 * horsestands.glb = idle pose (full scene)
 * horsewalks.glb  = walking animation (full scene)
 * We show one and hide the other based on moveSpeed.
 * Both are cloned so multiple horses work independently.
 */
import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

import horseStandsUrl from '@/assets/horsestands.glb';
import horseWalksUrl from '@/assets/horsewalks.glb';

interface Props {
  moveSpeed: number | React.RefObject<number>;
  scale?: number;
  renderPath?: string;
}

const HORSE_MOVE_THRESHOLD = 0.3;

export function HorseGLBModel({ moveSpeed, scale = 1, renderPath = 'unknown' }: Props) {
  const standGltf = useGLTF(horseStandsUrl);
  const walkGltf = useGLTF(horseWalksUrl);

  const standScene = useMemo(() => SkeletonUtils.clone(standGltf.scene), [standGltf.scene]);
  const walkScene = useMemo(() => SkeletonUtils.clone(walkGltf.scene), [walkGltf.scene]);

  const walkMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const standMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentWalking = useRef(false);
  const auditLogged = useRef(false);

  // Compute y-offset so horse feet sit on ground (use standing scene as reference)
  const yOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(standScene);
    return -box.min.y;
  }, [standScene]);

  // Also compute walk scene offset (may differ slightly)
  const walkYOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(walkScene);
    return -box.min.y;
  }, [walkScene]);

  useEffect(() => {
    // Setup walk mixer
    const walkMixer = new THREE.AnimationMixer(walkScene);
    walkMixerRef.current = walkMixer;

    if (walkGltf.animations.length > 0) {
      const action = walkMixer.clipAction(walkGltf.animations[0]);
      action.play();
      action.setEffectiveWeight(1);
    }

    // Setup stand mixer (in case standing has an idle animation)
    const standMixer = new THREE.AnimationMixer(standScene);
    standMixerRef.current = standMixer;

    if (standGltf.animations.length > 0) {
      const action = standMixer.clipAction(standGltf.animations[0]);
      action.play();
      action.setEffectiveWeight(1);
    }

    // Initial visibility
    standScene.visible = true;
    walkScene.visible = false;
    currentWalking.current = false;

    console.log(`[HorseAudit] path=${renderPath} standClips=${standGltf.animations.length} walkClips=${walkGltf.animations.length}`);

    return () => {
      walkMixer.stopAllAction();
      walkMixer.uncacheRoot(walkScene);
      standMixer.stopAllAction();
      standMixer.uncacheRoot(standScene);
    };
  }, [standScene, walkScene, standGltf.animations, walkGltf.animations, renderPath]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    walkMixerRef.current?.update(dt);
    standMixerRef.current?.update(dt);

    const speed = typeof moveSpeed === 'number' ? moveSpeed : (moveSpeed.current ?? 0);
    const wantWalk = speed > HORSE_MOVE_THRESHOLD;

    if (!auditLogged.current) {
      auditLogged.current = true;
      console.log(`[HorseAudit] first frame speed=${speed.toFixed(2)} wantWalk=${wantWalk}`);
    }

    if (wantWalk !== currentWalking.current) {
      currentWalking.current = wantWalk;
      standScene.visible = !wantWalk;
      walkScene.visible = wantWalk;
    }
  });

  return (
    <group>
      <group position={[0, yOffset * scale, 0]}>
        <primitive object={standScene} scale={[scale, scale, scale]} castShadow receiveShadow />
      </group>
      <group position={[0, walkYOffset * scale, 0]}>
        <primitive object={walkScene} scale={[scale, scale, scale]} castShadow receiveShadow />
      </group>
    </group>
  );
}
