/**
 * HorseGLBModel — clean rebuild using exactly 2 GLBs:
 *   mainhorsestanding.glb → idle / standing
 *   mainhorsewalking.glb  → walking / moving
 *
 * Both scenes are cloned (SkeletonUtils) so multiple instances work.
 * Each is independently scaled to TARGET_HORSE_HEIGHT.
 * Visibility uses React state with hysteresis to prevent flicker.
 * Animation clips are cloned before binding to ensure correct bone mapping.
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
// Hysteresis thresholds to prevent flicker
const WALK_START_THRESHOLD = 0.4;
const WALK_STOP_THRESHOLD = 0.15;

export function HorseGLBModel({ moveSpeed, scale = 1, renderPath = 'unknown' }: Props) {
  const standGltf = useGLTF(horseStandUrl);
  const walkGltf = useGLTF(horseWalkUrl);

  // Clone scenes so each instance is independent
  const standScene = useMemo(() => SkeletonUtils.clone(standGltf.scene), [standGltf.scene]);
  const walkScene = useMemo(() => SkeletonUtils.clone(walkGltf.scene), [walkGltf.scene]);

  const walkMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const standMixerRef = useRef<THREE.AnimationMixer | null>(null);

  // Use React state for visibility (not refs) — ensures correct initial render
  const [isWalking, setIsWalking] = useState(false);
  const isWalkingRef = useRef(false);

  // Compute independent scales and Y offsets for each model
  const { standScale, walkScale, standYOffset, walkYOffset } = useMemo(() => {
    const standBox = new THREE.Box3().setFromObject(standScene);
    const standSize = new THREE.Vector3();
    standBox.getSize(standSize);

    const walkBox = new THREE.Box3().setFromObject(walkScene);
    const walkSize = new THREE.Vector3();
    walkBox.getSize(walkSize);

    const sScale = standSize.y > 0.01 ? TARGET_HORSE_HEIGHT / standSize.y : 1;
    const wScale = walkSize.y > 0.01 ? TARGET_HORSE_HEIGHT / walkSize.y : 1;

    return {
      standScale: sScale,
      walkScale: wScale,
      standYOffset: -standBox.min.y * sScale,
      walkYOffset: -walkBox.min.y * wScale,
    };
  }, [standScene, walkScene]);

  const finalStandScale = standScale * scale;
  const finalWalkScale = walkScale * scale;

  // Setup materials + animation mixers (once per clone)
  useEffect(() => {
    const fixMaterials = (scene: THREE.Object3D) => {
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.frustumCulled = false;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            if (mat) {
              mat.visible = true;
              mat.side = THREE.DoubleSide;
              if ((mat as THREE.MeshStandardMaterial).opacity !== undefined) {
                (mat as THREE.MeshStandardMaterial).opacity = Math.max((mat as THREE.MeshStandardMaterial).opacity, 1);
              }
            }
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
        const action = standMixer.clipAction(clip.clone());
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
        const action = walkMixer.clipAction(clip.clone());
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.setEffectiveWeight(1);
        action.play();
      }
    }

    return () => {
      standMixer.stopAllAction();
      standMixer.uncacheRoot(standScene);
      walkMixer.stopAllAction();
      walkMixer.uncacheRoot(walkScene);
    };
  }, [standScene, walkScene, standGltf.animations, walkGltf.animations]);

  // Frame update: tick mixers + hysteresis-based visibility switch
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    standMixerRef.current?.update(dt);
    walkMixerRef.current?.update(dt);

    const speed = typeof moveSpeed === 'number' ? moveSpeed : (moveSpeed.current ?? 0);

    let wantWalk = isWalkingRef.current;
    if (isWalkingRef.current) {
      // Currently walking — stop only below low threshold
      if (speed < WALK_STOP_THRESHOLD) wantWalk = false;
    } else {
      // Currently standing — start only above high threshold
      if (speed > WALK_START_THRESHOLD) wantWalk = true;
    }

    if (wantWalk !== isWalkingRef.current) {
      isWalkingRef.current = wantWalk;
      setIsWalking(wantWalk);
    }
  });

  return (
    <group>
      {/* Standing model */}
      <group visible={!isWalking} position={[0, standYOffset * scale, 0]}>
        <primitive
          object={standScene}
          scale={[finalStandScale, finalStandScale, finalStandScale]}
          castShadow
          receiveShadow
        />
      </group>
      {/* Walking model */}
      <group visible={isWalking} position={[0, walkYOffset * scale, 0]}>
        <primitive
          object={walkScene}
          scale={[finalWalkScale, finalWalkScale, finalWalkScale]}
          castShadow
          receiveShadow
        />
      </group>
    </group>
  );
}
