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

  // Nuclear fix for frustum culling: disable on EVERY node, not just meshes.
  // Must run synchronously in useMemo so it's applied before the first render frame.
  const fixSceneForRendering = (scene: THREE.Object3D) => {
    scene.traverse((child) => {
      // Disable frustum culling on EVERY object — groups, bones, meshes, everything
      child.frustumCulled = false;

      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Force correct bounding sphere for skinned meshes
        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
          const skinned = mesh as THREE.SkinnedMesh;
          skinned.geometry.computeBoundingSphere();
          // Expand bounding sphere to prevent any edge-case culling
          if (skinned.geometry.boundingSphere) {
            skinned.geometry.boundingSphere.radius *= 10;
          }
        }

        const fixMat = (m: THREE.Material) => {
          m.visible = true;
          m.side = THREE.DoubleSide;
          (m as any).transparent = false;
          (m as any).opacity = 1;
          (m as any).depthWrite = true;
          (m as any).depthTest = true;
          (m as any).alphaTest = 0;
        };

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => { if (m) fixMat(m); });
        } else if (mesh.material) {
          fixMat(mesh.material);
        }
      }
    });
  };

  // Clone scenes so each instance is independent — fix rendering SYNCHRONOUSLY
  const standScene = useMemo(() => {
    const clone = SkeletonUtils.clone(standGltf.scene);
    fixSceneForRendering(clone);
    return clone;
  }, [standGltf.scene]);

  const walkScene = useMemo(() => {
    const clone = SkeletonUtils.clone(walkGltf.scene);
    fixSceneForRendering(clone);
    return clone;
  }, [walkGltf.scene]);

  const walkMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const standMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const standGroupRef = useRef<THREE.Group>(null);
  const walkGroupRef = useRef<THREE.Group>(null);

  const [isWalking, setIsWalking] = useState(false);
  const isWalkingRef = useRef(false);

  // Compute UNIFIED scale from standing GLB (source of truth) — walk uses same scale
  const metrics = useMemo(() => {
    standScene.updateMatrixWorld(true);
    walkScene.updateMatrixWorld(true);

    const standBox = new THREE.Box3().setFromObject(standScene);
    const standSize = new THREE.Vector3();
    standBox.getSize(standSize);

    const walkBox = new THREE.Box3().setFromObject(walkScene);
    const walkSize = new THREE.Vector3();
    walkBox.getSize(walkSize);

    // Use STANDING scale as the single source of truth for both models
    const unifiedScale = standSize.y > 0.001 ? TARGET_HORSE_HEIGHT / standSize.y : 1;

    const result = {
      unifiedScale,
      standYOffset: -standBox.min.y * unifiedScale,
      walkYOffset: -walkBox.min.y * unifiedScale,
      standSize: standSize.clone(),
      walkSize: walkSize.clone(),
      standMeshCount: 0,
      walkMeshCount: 0,
    };

    standScene.traverse(c => { if ((c as THREE.Mesh).isMesh) result.standMeshCount++; });
    walkScene.traverse(c => { if ((c as THREE.Mesh).isMesh) result.walkMeshCount++; });

    return result;
  }, [standScene, walkScene]);

  const finalScale = metrics.unifiedScale * scale;

  // Setup animation mixers (materials already fixed synchronously in useMemo)
  useEffect(() => {
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
        `stand: ${metrics.standMeshCount} meshes, size=${metrics.standSize.y.toFixed(2)}, scale=${metrics.unifiedScale.toFixed(3)}, anims=${standGltf.animations.length}`,
        `| walk: ${metrics.walkMeshCount} meshes, size=${metrics.walkSize.y.toFixed(2)}, scale=${metrics.unifiedScale.toFixed(3)} (unified), anims=${walkGltf.animations.length}`
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
