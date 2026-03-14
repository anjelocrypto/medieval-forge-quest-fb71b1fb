/**
 * HorseGLBModel — GLB-based horse with standing/walking animations.
 * Uses the standing GLB for the mesh, and the walking GLB only for its animation clip.
 * The walk animation is retargeted onto the standing model's skeleton.
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

  const clonedScene = useMemo(() => SkeletonUtils.clone(standingGltf.scene), [standingGltf.scene]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const standActionRef = useRef<THREE.AnimationAction | null>(null);
  const walkActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentStateRef = useRef<'standing' | 'walking'>('standing');

  // Calculate Y offset to place feet on ground
  const yOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    return -box.min.y;
  }, [clonedScene]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;

    // Collect all bone/object names in the standing model for remapping
    const standingNames = new Set<string>();
    clonedScene.traverse((obj) => standingNames.add(obj.name));

    // Standing animation (from standing GLB — may be 0 clips if static pose)
    if (standingGltf.animations.length > 0) {
      const action = mixer.clipAction(standingGltf.animations[0]);
      action.play();
      action.setEffectiveWeight(1);
      standActionRef.current = action;
    }

    // Walking animation — remap track names to match standing model's skeleton
    if (walkingGltf.animations.length > 0) {
      const origClip = walkingGltf.animations[0];

      // Collect walk model bone names for comparison
      const walkNames = new Set<string>();
      walkingGltf.scene.traverse((obj) => walkNames.add(obj.name));

      console.log(`[HorseAudit] Standing bones: ${[...standingNames].filter(n => n).join(', ')}`);
      console.log(`[HorseAudit] Walk bones: ${[...walkNames].filter(n => n).join(', ')}`);
      console.log(`[HorseAudit] Walk clip tracks (${origClip.tracks.length}):`);
      origClip.tracks.slice(0, 8).forEach(t => console.log(`[HorseAudit]   ${t.name}`));

      // Attempt to remap tracks: strip prefixes to find matching bone names
      const remappedTracks = origClip.tracks.map(track => {
        // Track name format: "BoneName.property" or "Root.BoneName.property"
        const parts = track.name.split('.');
        const property = parts.pop()!; // e.g. "position", "quaternion", "scale"
        const bonePath = parts.join('.');

        // Check if bonePath directly exists in standing model
        if (standingNames.has(bonePath)) {
          return track; // already matches
        }

        // Try just the last segment of the bone path
        const segments = bonePath.split('/');
        const leafBone = segments[segments.length - 1];
        if (standingNames.has(leafBone)) {
          return new THREE.KeyframeTrack(
            `${leafBone}.${property}`,
            // @ts-ignore - accessing internal arrays
            track.times as any,
            track.values as any
          );
        }

        // Try finding a case-insensitive match
        const lower = leafBone.toLowerCase();
        for (const name of standingNames) {
          if (name.toLowerCase() === lower) {
            return new THREE.KeyframeTrack(
              `${name}.${property}`,
              // @ts-ignore
              track.times as any,
              track.values as any
            );
          }
        }

        return track; // no remapping found
      });

      const walkClip = new THREE.AnimationClip(origClip.name, origClip.duration, remappedTracks);
      const action = mixer.clipAction(walkClip);
      action.play();
      action.setEffectiveWeight(0);
      walkActionRef.current = action;

      console.log(`[HorseAudit] INIT remapped walkClip tracks=${walkClip.tracks.length} duration=${walkClip.duration.toFixed(2)}s`);
    }

    console.log(`[HorseAudit] INIT standAnims=${standingGltf.animations.length} walkAnims=${walkingGltf.animations.length}`);

    currentStateRef.current = 'standing';

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
    };
  }, [clonedScene, standingGltf.animations, walkingGltf.animations, walkingGltf.scene]);

  const auditCountRef = useRef(0);

  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    const dt = Math.min(delta, 0.05);
    mixer.update(dt);

    const speed = typeof moveSpeed === 'number' ? moveSpeed : (moveSpeed.current ?? 0);
    const isMoving = speed > 0.3;
    const wantState = isMoving ? 'walking' : 'standing';

    if (auditCountRef.current < 5) {
      auditCountRef.current++;
      console.log(`[HorseAudit] speed=${speed.toFixed(2)} anim=${wantState} walkWeight=${walkActionRef.current?.getEffectiveWeight().toFixed(2)} refType=${typeof moveSpeed === 'number' ? 'number' : 'ref'}`);
    }

    if (wantState !== currentStateRef.current) {
      currentStateRef.current = wantState;
      console.log(`[HorseAudit] TRANSITION → ${wantState} speed=${speed.toFixed(2)}`);
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
