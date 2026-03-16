/**
 * HorseGLBModel — dual-scene visibility swap.
 * horsestands.glb = idle pose (full scene)
 * horsewalks.glb  = walking animation (full scene)
 * We show one and hide the other based on moveSpeed.
 * Both are cloned so multiple horses work independently.
 *
 * Visibility is toggled on wrapper <group> refs (not scene.visible)
 * to avoid Three.js propagation issues with cloned skinned meshes.
 * Animation clips are cloned to properly bind to cloned scene roots.
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
const TARGET_HORSE_HEIGHT = 2.0;

export function HorseGLBModel({ moveSpeed, scale = 1, renderPath = 'unknown' }: Props) {
  const standGltf = useGLTF(horseStandsUrl);
  const walkGltf = useGLTF(horseWalksUrl);

  const standScene = useMemo(() => SkeletonUtils.clone(standGltf.scene), [standGltf.scene]);
  const walkScene = useMemo(() => SkeletonUtils.clone(walkGltf.scene), [walkGltf.scene]);

  // Refs for visibility toggling on wrapper groups (not scene.visible)
  const standGroupRef = useRef<THREE.Group>(null);
  const walkGroupRef = useRef<THREE.Group>(null);

  const walkMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const standMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentWalking = useRef(false);
  const auditLogged = useRef(false);

  // Compute independent auto-scales for each model
  const { standAutoScale, walkAutoScale, yOffset, walkYOffset } = useMemo(() => {
    const standBox = new THREE.Box3().setFromObject(standScene);
    const standSize = new THREE.Vector3();
    standBox.getSize(standSize);

    const walkBox = new THREE.Box3().setFromObject(walkScene);
    const walkSize = new THREE.Vector3();
    walkBox.getSize(walkSize);

    const standNativeHeight = standSize.y;
    const walkNativeHeight = walkSize.y;
    const computedStandScale = standNativeHeight > 0.01 ? TARGET_HORSE_HEIGHT / standNativeHeight : 1;
    const computedWalkScale = walkNativeHeight > 0.01 ? TARGET_HORSE_HEIGHT / walkNativeHeight : 1;

    console.log(`[HorseAudit] standBox size: x=${standSize.x.toFixed(3)} y=${standSize.y.toFixed(3)} z=${standSize.z.toFixed(3)}`);
    console.log(`[HorseAudit] walkBox size: x=${walkSize.x.toFixed(3)} y=${walkSize.y.toFixed(3)} z=${walkSize.z.toFixed(3)}`);
    console.log(`[HorseAudit] standAutoScale=${computedStandScale.toFixed(4)} walkAutoScale=${computedWalkScale.toFixed(4)}`);

    return {
      standAutoScale: computedStandScale,
      walkAutoScale: computedWalkScale,
      yOffset: -standBox.min.y * computedStandScale,
      walkYOffset: -walkBox.min.y * computedWalkScale,
    };
  }, [standScene, walkScene]);

  const standFinalScale = standAutoScale * scale;
  const walkFinalScale = walkAutoScale * scale;

  // Setup materials and animations — no scale values in deps to avoid re-triggering
  useEffect(() => {
    const fixMaterials = (scene: THREE.Object3D) => {
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.frustumCulled = false;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              mat.visible = true;
              mat.side = THREE.DoubleSide;
            });
          } else if (mesh.material) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.visible = true;
            mat.transparent = mat.transparent || false;
            mat.opacity = mat.opacity > 0 ? mat.opacity : 1;
            mat.side = THREE.DoubleSide;
          }
        }
      });
    };
    fixMaterials(standScene);
    fixMaterials(walkScene);

    // Setup walk mixer with CLONED clips for proper binding to cloned scene
    const walkMixer = new THREE.AnimationMixer(walkScene);
    walkMixerRef.current = walkMixer;
    if (walkGltf.animations.length > 0) {
      for (const clip of walkGltf.animations) {
        const clonedClip = clip.clone();
        const action = walkMixer.clipAction(clonedClip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.setEffectiveWeight(1);
        action.play();
      }
      console.log(`[HorseAudit] Walk mixer: ${walkGltf.animations.length} clips bound, tracks: ${walkGltf.animations.map(c => c.tracks.length).join(',')}`);
    } else {
      console.warn(`[HorseAudit] WARNING: walkGltf has 0 animation clips!`);
    }

    // Setup stand mixer with CLONED clips
    const standMixer = new THREE.AnimationMixer(standScene);
    standMixerRef.current = standMixer;
    if (standGltf.animations.length > 0) {
      for (const clip of standGltf.animations) {
        const clonedClip = clip.clone();
        const action = standMixer.clipAction(clonedClip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.setEffectiveWeight(1);
        action.play();
      }
      console.log(`[HorseAudit] Stand mixer: ${standGltf.animations.length} clips bound, tracks: ${standGltf.animations.map(c => c.tracks.length).join(',')}`);
    } else {
      console.warn(`[HorseAudit] WARNING: standGltf has 0 animation clips!`);
    }

    // Initial visibility via group refs
    currentWalking.current = false;
    if (standGroupRef.current) standGroupRef.current.visible = true;
    if (walkGroupRef.current) walkGroupRef.current.visible = false;

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
      console.log(`[HorseAudit] first frame speed=${speed.toFixed(2)} wantWalk=${wantWalk} standGroupRef=${!!standGroupRef.current} walkGroupRef=${!!walkGroupRef.current}`);
    }

    if (wantWalk !== currentWalking.current) {
      currentWalking.current = wantWalk;
      // Toggle visibility on wrapper groups, not on scene objects
      if (standGroupRef.current) standGroupRef.current.visible = !wantWalk;
      if (walkGroupRef.current) walkGroupRef.current.visible = wantWalk;
    }
  });

  return (
    <group>
      <group ref={standGroupRef} position={[0, yOffset * scale, 0]}>
        <primitive object={standScene} scale={[standFinalScale, standFinalScale, standFinalScale]} castShadow receiveShadow />
      </group>
      <group ref={walkGroupRef} visible={false} position={[0, walkYOffset * scale, 0]}>
        <primitive object={walkScene} scale={[walkFinalScale, walkFinalScale, walkFinalScale]} castShadow receiveShadow />
      </group>
    </group>
  );
}
