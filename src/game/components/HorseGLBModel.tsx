/**
 * HorseGLBModel — single-mesh horse pipeline.
 * - Visible mesh comes from horsestanding.glb
 * - Walking animation comes from horseiswalking.glb and is remapped onto
 *   the standing skeleton
 */
import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

import horseStandingUrl from '@/assets/horsestanding.glb';
import horseWalkingUrl from '@/assets/horseiswalking.glb';

interface Props {
  moveSpeed: number | React.RefObject<number>;
  scale?: number;
  renderPath?: string;
}

const HORSE_MOVE_THRESHOLD = 0.3;
const HORSE_AUDIT_FRAME_LIMIT = 24;

function normalizeBoneName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function splitTrackName(trackName: string) {
  const parts = trackName.split('.');
  const property = parts.pop() ?? '';
  const targetPath = parts.join('.');
  return { targetPath, property };
}

function buildTargetCandidates(targetPath: string) {
  const candidates = new Set<string>();
  const chunks = targetPath.split(/[\/|:]/).filter(Boolean);

  candidates.add(targetPath);
  for (let i = 0; i < chunks.length; i++) {
    const suffix = chunks.slice(i);
    candidates.add(suffix.join('/'));
    candidates.add(suffix.join('|'));
    candidates.add(suffix.join(':'));
    candidates.add(suffix.join('.'));
    candidates.add(suffix[suffix.length - 1]);
  }

  return [...candidates].filter(Boolean);
}

export function HorseGLBModel({ moveSpeed, scale = 1, renderPath = 'unknown' }: Props) {
  const standingGltf = useGLTF(horseStandingUrl);
  const walkingGltf = useGLTF(horseWalkingUrl);

  const clonedScene = useMemo(() => SkeletonUtils.clone(standingGltf.scene), [standingGltf.scene]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const standActionRef = useRef<THREE.AnimationAction | null>(null);
  const walkActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentStateRef = useRef<'standing' | 'walking'>('standing');
  const frameAuditCountRef = useRef(0);
  const mixerAuditLoggedRef = useRef(false);

  const yOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    return -box.min.y;
  }, [clonedScene]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;

    const standingNames = new Set<string>();
    const standingBones: string[] = [];
    clonedScene.traverse((obj) => {
      if (obj.name) standingNames.add(obj.name);
      if ((obj as THREE.Bone).isBone && obj.name) standingBones.push(obj.name);
    });

    const standingByNormalized = new Map<string, string>();
    [...standingNames].forEach((name) => {
      const normalized = normalizeBoneName(name);
      if (normalized && !standingByNormalized.has(normalized)) {
        standingByNormalized.set(normalized, name);
      }
    });

    const findStandingTarget = (rawTarget: string): string | null => {
      const candidates = buildTargetCandidates(rawTarget);

      for (const candidate of candidates) {
        if (standingNames.has(candidate)) return candidate;
      }

      for (const candidate of candidates) {
        const normalized = normalizeBoneName(candidate);
        if (!normalized) continue;

        const exact = standingByNormalized.get(normalized);
        if (exact) return exact;

        for (const [normStanding, name] of standingByNormalized.entries()) {
          if (normStanding.endsWith(normalized) || normalized.endsWith(normStanding)) {
            return name;
          }
        }
      }

      return null;
    };

    if (standingGltf.animations.length > 0) {
      const action = mixer.clipAction(standingGltf.animations[0]);
      action.play();
      action.setEffectiveWeight(1);
      standActionRef.current = action;
    }

    const walkClipSource = walkingGltf.animations[0] ?? null;
    const walkTargets = walkClipSource
      ? [...new Set(walkClipSource.tracks.map((track) => splitTrackName(track.name).targetPath).filter(Boolean))]
      : [];

    let remappedCount = 0;

    if (walkClipSource) {
      const remappedTracks: THREE.KeyframeTrack[] = [];

      walkClipSource.tracks.forEach((track) => {
        const { targetPath, property } = splitTrackName(track.name);
        if (!targetPath || !property) return;

        const mappedTarget = findStandingTarget(targetPath);
        if (!mappedTarget) return;

        const remappedTrack = track.clone();
        remappedTrack.name = `${mappedTarget}.${property}`;
        remappedTracks.push(remappedTrack);
      });

      remappedCount = remappedTracks.length;

      if (remappedTracks.length > 0) {
        const walkClip = new THREE.AnimationClip(`${walkClipSource.name}_remapped`, walkClipSource.duration, remappedTracks);
        const action = mixer.clipAction(walkClip);
        action.play();
        action.setEffectiveWeight(0);
        walkActionRef.current = action;
      }
    }

    console.log(`[HorseAudit] render path = ${renderPath}`);
    console.log(`[HorseAudit] standing asset loaded = ${standingGltf.scene ? 'yes' : 'no'}`);
    console.log(`[HorseAudit] walking asset loaded = ${walkingGltf.scene || walkingGltf.animations.length > 0 ? 'yes' : 'no'}`);
    console.log(`[HorseAudit] walk clip found = ${walkClipSource ? 'yes' : 'no'}`);
    console.log(`[HorseAudit] walk clip track count = ${walkClipSource?.tracks.length ?? 0}`);
    console.log(`[HorseAudit] standing skeleton bone names = ${standingBones.join(', ') || '(none)'}`);
    console.log(`[HorseAudit] walk clip track targets = ${walkTargets.join(', ') || '(none)'}`);
    console.log(`[HorseAudit] remapped tracks count = ${remappedCount}`);

    currentStateRef.current = 'standing';
    frameAuditCountRef.current = 0;
    mixerAuditLoggedRef.current = false;

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
    };
  }, [clonedScene, standingGltf.animations, standingGltf.scene, walkingGltf.animations, walkingGltf.scene, renderPath]);

  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    if (!mixer) return;

    const dt = Math.min(delta, 0.05);
    mixer.update(dt);

    if (!mixerAuditLoggedRef.current) {
      mixerAuditLoggedRef.current = true;
      console.log('[HorseAudit] mixer updated = yes');
    }

    const speed = typeof moveSpeed === 'number' ? moveSpeed : (moveSpeed.current ?? 0);
    const movingThresholdPassed = speed > HORSE_MOVE_THRESHOLD;
    const selectedState: 'standing' | 'walking' = movingThresholdPassed ? 'walking' : 'standing';

    if (frameAuditCountRef.current < HORSE_AUDIT_FRAME_LIMIT) {
      frameAuditCountRef.current += 1;
      const selectedAction = selectedState === 'walking' ? walkActionRef.current : standActionRef.current;
      console.log(`[HorseAudit] active speed = ${speed.toFixed(2)}`);
      console.log(`[HorseAudit] moving threshold passed = ${movingThresholdPassed ? 'yes' : 'no'}`);
      console.log(`[HorseAudit] selected state = ${selectedState}`);
      console.log(`[HorseAudit] action playing = ${selectedAction?.isRunning() ? 'yes' : 'no'}`);
    }

    if (selectedState !== currentStateRef.current) {
      currentStateRef.current = selectedState;
      const fadeTime = 0.25;

      if (selectedState === 'walking') {
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
