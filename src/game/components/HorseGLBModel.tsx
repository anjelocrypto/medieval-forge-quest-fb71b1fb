/**
 * HorseGLBModel — CLEAN REBUILD
 * Uses exactly 2 GLBs: mainhorsestanding.glb + mainhorsewalking.glb
 * 
 * Architecture:
 * - Both GLBs are loaded, cloned, scaled to same height, and ALWAYS in the scene tree
 * - Visibility is toggled via group.visible (never unmount/remount)
 * - Animation mixers are created once per clone lifetime
 * - Hysteresis prevents flicker between stand/walk
 * - Debug logging on first render to verify assets loaded correctly
 */
import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

import horseStandUrl from '@/assets/mainhorsestanding.glb';
import horseWalkUrl from '@/assets/mainhorsewalking.glb';

interface Props {
  moveSpeed: number | React.RefObject<number>;
  scale?: number;
  renderPath?: string;
}

const TARGET_HORSE_HEIGHT = 2.0;
const WALK_START_THRESHOLD = 0.4;
const WALK_STOP_THRESHOLD = 0.15;

export function HorseGLBModel({ moveSpeed, scale = 1, renderPath = 'unknown' }: Props) {
  const standGltf = useGLTF(horseStandUrl);
  const walkGltf = useGLTF(horseWalkUrl);
  const loggedRef = useRef(false);

  // Clone scenes so each instance is independent
  const standScene = useMemo(() => {
    const clone = SkeletonUtils.clone(standGltf.scene);
    return clone;
  }, [standGltf.scene]);

  const walkScene = useMemo(() => {
    const clone = SkeletonUtils.clone(walkGltf.scene);
    return clone;
  }, [walkGltf.scene]);

  const walkMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const standMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const standGroupRef = useRef<THREE.Group>(null);
  const walkGroupRef = useRef<THREE.Group>(null);

  const [isWalking, setIsWalking] = useState(false);
  const isWalkingRef = useRef(false);

  // Compute independent scales so both models match TARGET_HORSE_HEIGHT
  const metrics = useMemo(() => {
    // Force update transforms before measuring
    standScene.updateMatrixWorld(true);
    walkScene.updateMatrixWorld(true);

    const standBox = new THREE.Box3().setFromObject(standScene);
    const standSize = new THREE.Vector3();
    standBox.getSize(standSize);

    const walkBox = new THREE.Box3().setFromObject(walkScene);
    const walkSize = new THREE.Vector3();
    walkBox.getSize(walkSize);

    const sScale = standSize.y > 0.001 ? TARGET_HORSE_HEIGHT / standSize.y : 1;
    const wScale = walkSize.y > 0.001 ? TARGET_HORSE_HEIGHT / walkSize.y : 1;

    const result = {
      standScale: sScale,
      walkScale: wScale,
      standYOffset: -standBox.min.y * sScale,
      walkYOffset: -walkBox.min.y * wScale,
      standSize: standSize.clone(),
      walkSize: walkSize.clone(),
      standMeshCount: 0,
      walkMeshCount: 0,
    };

    // Count meshes for debug
    standScene.traverse(c => { if ((c as THREE.Mesh).isMesh) result.standMeshCount++; });
    walkScene.traverse(c => { if ((c as THREE.Mesh).isMesh) result.walkMeshCount++; });

    return result;
  }, [standScene, walkScene]);

  const finalStandScale = metrics.standScale * scale;
  const finalWalkScale = metrics.walkScale * scale;

  // Setup materials + animation mixers
  useEffect(() => {
    const fixMaterials = (scene: THREE.Object3D) => {
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.frustumCulled = false;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => {
              if (m) { m.visible = true; m.side = THREE.DoubleSide; m.transparent = false; m.opacity = 1; }
            });
          } else if (mesh.material) {
            mesh.material.visible = true;
            mesh.material.side = THREE.DoubleSide;
            (mesh.material as any).transparent = false;
            (mesh.material as any).opacity = 1;
          }
        }
      });
    };

    fixMaterials(standScene);
    fixMaterials(walkScene);

    // Stand mixer
    const standMixer = new THREE.AnimationMixer(standScene);
    standMixerRef.current = standMixer;
    if (standGltf.animations.length > 0) {
      for (const clip of standGltf.animations) {
        const cloned = clip.clone();
        const action = standMixer.clipAction(cloned);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.setEffectiveWeight(1);
        action.play();
      }
    }

    // Walk mixer
    const walkMixer = new THREE.AnimationMixer(walkScene);
    walkMixerRef.current = walkMixer;
    if (walkGltf.animations.length > 0) {
      for (const clip of walkGltf.animations) {
        const cloned = clip.clone();
        const action = walkMixer.clipAction(cloned);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.setEffectiveWeight(1);
        action.play();
      }
    }

    // Debug log once
    if (!loggedRef.current) {
      loggedRef.current = true;
      console.log(`[HorseGLBModel:${renderPath}] LOADED`,
        `stand: ${metrics.standMeshCount} meshes, size=${metrics.standSize.y.toFixed(2)}, scale=${metrics.standScale.toFixed(3)}, anims=${standGltf.animations.length}`,
        `| walk: ${metrics.walkMeshCount} meshes, size=${metrics.walkSize.y.toFixed(2)}, scale=${metrics.walkScale.toFixed(3)}, anims=${walkGltf.animations.length}`
      );
    }

    return () => {
      standMixer.stopAllAction();
      standMixer.uncacheRoot(standScene);
      walkMixer.stopAllAction();
      walkMixer.uncacheRoot(walkScene);
    };
  }, [standScene, walkScene, standGltf.animations, walkGltf.animations]);

  // Frame update: tick mixers + hysteresis toggle
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    standMixerRef.current?.update(dt);
    walkMixerRef.current?.update(dt);

    const speed = typeof moveSpeed === 'number' ? moveSpeed : (moveSpeed?.current ?? 0);

    let wantWalk = isWalkingRef.current;
    if (isWalkingRef.current) {
      if (speed < WALK_STOP_THRESHOLD) wantWalk = false;
    } else {
      if (speed > WALK_START_THRESHOLD) wantWalk = true;
    }

    if (wantWalk !== isWalkingRef.current) {
      isWalkingRef.current = wantWalk;
      setIsWalking(wantWalk);
    }

    // Direct visibility control via refs for immediate response
    if (standGroupRef.current) standGroupRef.current.visible = !wantWalk;
    if (walkGroupRef.current) walkGroupRef.current.visible = wantWalk;
  });

  return (
    <group>
      {/* Standing model — visible when not walking */}
      <group ref={standGroupRef} visible={!isWalking} position={[0, metrics.standYOffset * scale, 0]}>
        <primitive
          object={standScene}
          scale={[finalStandScale, finalStandScale, finalStandScale]}
        />
      </group>
      {/* Walking model — visible when walking */}
      <group ref={walkGroupRef} visible={isWalking} position={[0, metrics.walkYOffset * scale, 0]}>
        <primitive
          object={walkScene}
          scale={[finalWalkScale, finalWalkScale, finalWalkScale]}
        />
      </group>
    </group>
  );
}
