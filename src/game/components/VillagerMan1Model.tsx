/**
 * VillagerMan1Model — GLB-based NPC villager with walking/standing animation cycling.
 * Alternates between standing idle and walking patrol with smooth crossfade transitions.
 * Distance-culled for performance.
 */
import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinnedScene } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getTerrainHeight } from './Terrain';

import walkingUrl from '@/assets/villagerman1walking.glb';
import standingUrl from '@/assets/villagerman1standing.glb';

export interface VillagerMan1Def {
  id: string;
  homePos: [number, number, number];
  patrolRadius: number;
  patrolSpeed: number;
  facingAngle: number;
  /** Duration in seconds for standing phase */
  standDuration?: number;
  /** Duration in seconds for walking phase */
  walkDuration?: number;
}

interface Props {
  def: VillagerMan1Def;
  playerPos: THREE.Vector3 | null;
}

const CULL_DISTANCE = 80;
const CULL_DISTANCE_SQ = CULL_DISTANCE * CULL_DISTANCE;
const TARGET_HEIGHT = 1.8;
const CROSSFADE_DURATION = 0.4;

function cloneAndNormalize(scene: THREE.Group): THREE.Group {
  const cloned = cloneSkinnedScene(scene) as THREE.Group;
  cloned.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const normMat = (mat: THREE.Material) => {
      const c = mat.clone();
      if (c instanceof THREE.MeshStandardMaterial || c instanceof THREE.MeshPhysicalMaterial) {
        c.emissive.set(0x000000);
        c.emissiveIntensity = 0;
        c.metalness = Math.min(c.metalness, 0.2);
        c.roughness = Math.max(c.roughness, 0.35);
      }
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(normMat) : normMat(mesh.material);
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      (mesh as THREE.SkinnedMesh).frustumCulled = false;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  cloned.updateMatrixWorld(true);
  return cloned;
}

function getSceneHeight(scene: THREE.Object3D): number {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  return Number.isFinite(size.y) && size.y > 0.001 ? size.y : 1;
}

function getFootY(scene: THREE.Object3D): number {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  return Number.isFinite(bounds.min.y) ? bounds.min.y : 0;
}

export function VillagerMan1Model({ def, playerPos }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);

  const walkGltf = useGLTF(walkingUrl);
  const standGltf = useGLTF(standingUrl);

  const patrolAngleRef = useRef(def.facingAngle);
  const facingRef = useRef(def.facingAngle);
  const phaseTimeRef = useRef(0);
  const [phase, setPhase] = useState<'standing' | 'walking'>('standing');

  const standDuration = def.standDuration ?? 45 + Math.random() * 30; // 45-75s
  const walkDuration = def.walkDuration ?? 30 + Math.random() * 30; // 30-60s

  // Clone scenes
  const { walkScene, standScene, scale, walkFootY, standFootY } = useMemo(() => {
    const ws = cloneAndNormalize(walkGltf.scene as THREE.Group);
    const ss = cloneAndNormalize(standGltf.scene as THREE.Group);
    const wh = getSceneHeight(ws);
    const sh = getSceneHeight(ss);
    const avgH = (wh + sh) / 2;
    const s = avgH > 0.01 ? TARGET_HEIGHT / avgH : 1;
    return {
      walkScene: ws,
      standScene: ss,
      scale: THREE.MathUtils.clamp(s, 0.1, 3),
      walkFootY: getFootY(ws),
      standFootY: getFootY(ss),
    };
  }, [walkGltf.scene, standGltf.scene]);

  // Animation mixers
  const walkMixer = useMemo(() => new THREE.AnimationMixer(walkScene), [walkScene]);
  const standMixer = useMemo(() => new THREE.AnimationMixer(standScene), [standScene]);

  // Setup actions
  const walkAction = useMemo(() => {
    if (walkGltf.animations.length === 0) return null;
    const clip = walkGltf.animations[0];
    // Strip root translation
    const filtered = clip.clone();
    filtered.tracks = filtered.tracks.filter(t => {
      if (!t.name.endsWith('.position')) return true;
      const target = t.name.slice(0, t.name.lastIndexOf('.'));
      return !/(hips|pelvis|root|armature)/i.test(target);
    });
    return walkMixer.clipAction(filtered);
  }, [walkGltf.animations, walkMixer]);

  const standAction = useMemo(() => {
    if (standGltf.animations.length === 0) return null;
    const clip = standGltf.animations[0];
    const filtered = clip.clone();
    filtered.tracks = filtered.tracks.filter(t => {
      if (!t.name.endsWith('.position')) return true;
      const target = t.name.slice(0, t.name.lastIndexOf('.'));
      return !/(hips|pelvis|root|armature)/i.test(target);
    });
    return standMixer.clipAction(filtered);
  }, [standGltf.animations, standMixer]);

  // Start initial phase
  useEffect(() => {
    if (standAction) {
      standAction.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
    if (walkAction) {
      walkAction.reset().setLoop(THREE.LoopRepeat, Infinity).play();
      walkAction.setEffectiveWeight(0);
    }
  }, [standAction, walkAction]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);

    // Distance cull
    if (playerPos) {
      const dx = playerPos.x - groupRef.current.position.x;
      const dz = playerPos.z - groupRef.current.position.z;
      if (dx * dx + dz * dz > CULL_DISTANCE_SQ) {
        groupRef.current.visible = false;
        return;
      }
      groupRef.current.visible = true;
    }

    // Phase timer
    phaseTimeRef.current += dt;
    const currentPhaseDuration = phase === 'standing' ? standDuration : walkDuration;
    if (phaseTimeRef.current >= currentPhaseDuration) {
      phaseTimeRef.current = 0;
      const newPhase = phase === 'standing' ? 'walking' : 'standing';
      setPhase(newPhase);

      // Crossfade
      if (newPhase === 'walking') {
        walkAction?.reset().setEffectiveWeight(1).fadeIn(CROSSFADE_DURATION).play();
        standAction?.fadeOut(CROSSFADE_DURATION);
      } else {
        standAction?.reset().setEffectiveWeight(1).fadeIn(CROSSFADE_DURATION).play();
        walkAction?.fadeOut(CROSSFADE_DURATION);
      }
    }

    // Movement
    if (phase === 'walking') {
      patrolAngleRef.current += dt * def.patrolSpeed * 0.3;
      const pa = patrolAngleRef.current;
      const tx = def.homePos[0] + Math.cos(pa) * def.patrolRadius;
      const tz = def.homePos[2] + Math.sin(pa) * def.patrolRadius;
      const ty = getTerrainHeight(tx, tz);
      groupRef.current.position.set(tx, ty, tz);
      const targetAngle = pa + Math.PI / 2;
      facingRef.current += (((targetAngle - facingRef.current + Math.PI) % (Math.PI * 2)) - Math.PI) * dt * 4;
      groupRef.current.rotation.y = facingRef.current;
    } else {
      // Stay in place during standing
      const tx = def.homePos[0] + Math.cos(patrolAngleRef.current) * def.patrolRadius;
      const tz = def.homePos[2] + Math.sin(patrolAngleRef.current) * def.patrolRadius;
      const ty = getTerrainHeight(tx, tz);
      groupRef.current.position.set(tx, ty, tz);
      groupRef.current.rotation.y = facingRef.current;
    }

    // Update mixers
    walkMixer.update(dt);
    standMixer.update(dt);

    // Show/hide correct scene
    if (innerRef.current) {
      walkScene.visible = phase === 'walking';
      standScene.visible = phase === 'standing';
    }
  });

  const footY = phase === 'walking' ? walkFootY : standFootY;

  return (
    <group ref={groupRef} position={def.homePos} rotation={[0, def.facingAngle, 0]}>
      <group ref={innerRef} scale={[scale, scale, scale]} position={[0, -footY * scale, 0]}>
        <primitive object={walkScene} />
        <primitive object={standScene} />
      </group>
    </group>
  );
}
