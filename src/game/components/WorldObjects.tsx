import { useMemo, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants';
import {
  WorldResource, INTERACTION_RANGE, GATHER_COOLDOWN,
  TREE_WOOD_REWARD, ROCK_STONE_REWARD, BERRY_FOOD_REWARD, CRATE_REWARDS,
} from '../systems/WorldResources';
import { getMovementInput } from '../systems/InputSystem';
import { ResourceInventory, LootPickup } from '../types';
import { PlacedStructure } from '../systems/BuildingData';
import { HorseData, MOUNT_RANGE } from '../systems/HorseData';

interface Props {
  resources: WorldResource[];
  playerPositionRef: React.RefObject<THREE.Vector3>;
  onSetInteraction: (text: string | null) => void;
  onAddResource: (type: keyof ResourceInventory, amount: number) => void;
  onDepleteResource: (id: string) => void;
  onHitResource: (id: string) => void;
  structures: PlacedStructure[];
  inventory: ResourceInventory;
  onEatFood: () => void;
  horse: HorseData;
  isMounted: boolean;
}

const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 1, 5);
const coneGeo = new THREE.ConeGeometry(1, 1, 5);
const dodecGeo = new THREE.DodecahedronGeometry(1, 1);
const rockGeo = new THREE.DodecahedronGeometry(1, 0);
const sphereGeo = new THREE.SphereGeometry(1, 6, 6);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.woodDark });
const leavesMat = new THREE.MeshLambertMaterial({ color: COLORS.leaves });
const leavesDarkMat = new THREE.MeshLambertMaterial({ color: COLORS.leavesDark });
const stoneMat = new THREE.MeshLambertMaterial({ color: COLORS.stone });
const stoneDarkMat = new THREE.MeshLambertMaterial({ color: COLORS.stoneDark });
const highlightMat = new THREE.MeshBasicMaterial({ color: '#ffcc44', transparent: true, opacity: 0.4 });
const highlightGeo = new THREE.RingGeometry(1.5, 1.8, 12);
const berryLeafMat = new THREE.MeshLambertMaterial({ color: '#2a6a20' });
const berryMat = new THREE.MeshLambertMaterial({ color: '#cc3344' });
const crateMat = new THREE.MeshLambertMaterial({ color: '#6b4f10' });
const crateBandMat = new THREE.MeshLambertMaterial({ color: '#4a3a20' });

export function WorldObjects({
  resources, playerPositionRef, onSetInteraction,
  onAddResource, onDepleteResource, onHitResource,
  structures, inventory, onEatFood, horse, isMounted,
}: Props) {
  const cooldownRef = useRef(0);
  const lastInteractIdRef = useRef<string | null>(null);
  const lastInteractTextRef = useRef<string | null>(null);
  const shakesRef = useRef<Map<string, { timer: number }>>(new Map());
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  const frameSkipRef = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    cooldownRef.current = Math.max(0, cooldownRef.current - dt);
    const playerPos = playerPositionRef.current;
    if (!playerPos) return;

    frameSkipRef.current++;
    const checkInteraction = frameSkipRef.current % 3 === 0;

    // If mounted or horse is nearby (higher priority), skip resource interaction
    let horseNearby = false;
    if (!isMounted && horse.state !== 'mounted') {
      const dx = playerPos.x - horse.position[0], dz = playerPos.z - horse.position[2];
      if (dx * dx + dz * dz < MOUNT_RANGE * MOUNT_RANGE) { horseNearby = true; }
    }

    let nearestId: string | null = null;
    let nearestRes: WorldResource | null = null;
    let nearestType: string | null = null;

    if (checkInteraction && !isMounted && !horseNearby) {
      let nearestDist = INTERACTION_RANGE;
      const px = playerPos.x, pz = playerPos.z;

      // Check world resources
      for (let i = 0; i < resources.length; i++) {
        const res = resources[i];
        if (res.depleted || !res.gatherable) continue;
        const dx = px - res.position[0];
        const dz = pz - res.position[2];
        const distSq = dx * dx + dz * dz;
        if (distSq < nearestDist * nearestDist) {
          nearestDist = Math.sqrt(distSq);
          nearestRes = res;
          nearestId = res.id;
          nearestType = res.type;
        }
      }

      // Check workbench interaction
      for (const s of structures) {
        if (s.type !== 'workbench') continue;
        const dx = px - s.position[0];
        const dz = pz - s.position[2];
        const distSq = dx * dx + dz * dz;
        if (distSq < INTERACTION_RANGE * INTERACTION_RANGE && Math.sqrt(distSq) < nearestDist) {
          nearestDist = Math.sqrt(distSq);
          nearestId = 'workbench-' + s.id;
          nearestRes = null;
          nearestType = 'workbench';
        }
      }

      if (nearestType) {
        let text = '';
        if (nearestType === 'tree') text = `🪓 Press E — Chop Tree (${nearestRes!.health}/${nearestRes!.maxHealth})`;
        else if (nearestType === 'rock') text = `⛏ Press E — Mine Rock (${nearestRes!.health}/${nearestRes!.maxHealth})`;
        else if (nearestType === 'berry_bush') text = `🫐 Press E — Pick Berries (${nearestRes!.health}/${nearestRes!.maxHealth})`;
        else if (nearestType === 'crate') text = `📦 Press E — Break Crate (${nearestRes!.health}/${nearestRes!.maxHealth})`;
        else if (nearestType === 'workbench') text = `🔨 Press E — Craft Food (5 Wood → 2 Food) [Wood: ${inventory.wood}]`;

        if (text !== lastInteractTextRef.current) {
          lastInteractTextRef.current = text;
          onSetInteraction(text);
        }
        lastInteractIdRef.current = nearestId;
      } else if (lastInteractIdRef.current !== null) {
        onSetInteraction(null);
        lastInteractIdRef.current = null;
        lastInteractTextRef.current = null;
      }
    } else if (isMounted || horseNearby) {
      // Horse has priority — clear any cached interaction target
      if (lastInteractIdRef.current !== null) {
        onSetInteraction(null);
        lastInteractIdRef.current = null;
        lastInteractTextRef.current = null;
      }
      nearestId = null;
      nearestType = null;
    } else {
      nearestId = lastInteractIdRef.current;
      if (nearestId && !nearestId.startsWith('workbench')) {
        nearestRes = resources.find(r => r.id === nearestId) || null;
        nearestType = nearestRes?.type || null;
      } else if (nearestId?.startsWith('workbench')) {
        nearestType = 'workbench';
      }
    }

    const { interact } = getMovementInput();
    if (interact && cooldownRef.current <= 0) {
      if (nearestType === 'workbench' && inventory.wood >= 5) {
        cooldownRef.current = GATHER_COOLDOWN;
        onAddResource('wood', -5);
        onAddResource('food', 2);
      } else if (nearestRes) {
        cooldownRef.current = GATHER_COOLDOWN;
        shakesRef.current.set(nearestRes.id, { timer: 0.3 });

        if (nearestRes.health <= 1) {
          onDepleteResource(nearestRes.id);
          if (nearestRes.type === 'tree') onAddResource('wood', TREE_WOOD_REWARD);
          else if (nearestRes.type === 'rock') onAddResource('stone', ROCK_STONE_REWARD);
          else if (nearestRes.type === 'berry_bush') onAddResource('food', BERRY_FOOD_REWARD);
          else if (nearestRes.type === 'crate') {
            onAddResource('wood', CRATE_REWARDS.wood);
            onAddResource('stone', CRATE_REWARDS.stone);
            onAddResource('food', CRATE_REWARDS.food);
          }
        } else {
          onHitResource(nearestRes.id);
          if (nearestRes.type === 'tree') onAddResource('wood', 1);
          else if (nearestRes.type === 'rock') onAddResource('stone', 1);
          else if (nearestRes.type === 'berry_bush') onAddResource('food', 1);
          else if (nearestRes.type === 'crate') onAddResource('wood', 1);
        }
      }
    }

    // Update shakes
    shakesRef.current.forEach((state, id) => {
      state.timer -= dt;
      const group = groupRefs.current.get(id);
      if (group) {
        if (state.timer > 0) {
          group.rotation.z = Math.sin(Date.now() * 0.05) * 0.05 * state.timer * 10;
        } else {
          group.rotation.z = 0;
          shakesRef.current.delete(id);
        }
      }
    });
  });

  const setRef = useCallback((id: string, el: THREE.Group | null) => {
    if (el) groupRefs.current.set(id, el);
    else groupRefs.current.delete(id);
  }, []);

  const playerPos = playerPositionRef.current;

  return (
    <group>
      {resources.map(res => {
        if (res.depleted) return null;
        if (playerPos) {
          const dx = playerPos.x - res.position[0];
          const dz = playerPos.z - res.position[2];
          const distSq = dx * dx + dz * dz;
          const cullDist = res.gatherable ? 150 : 100;
          if (distSq > cullDist * cullDist) return null;
        }

        const isHighlighted = lastInteractIdRef.current === res.id;

        if (res.type === 'tree') {
          const tH = res.trunkHeight * res.scale;
          const cR = res.crownRadius * (res.gatherable ? (res.health / res.maxHealth * 0.4 + 0.6) : 1);
          return (
            <group key={res.id} ref={el => setRef(res.id, el)} position={res.position} scale={res.scale}>
              <mesh position={[0, tH / 2, 0]} castShadow geometry={trunkGeo} scale={[1, tH, 1]} material={trunkMat} />
              {res.variant === 1 ? (
                <>
                  <mesh position={[0, tH + 1.5, 0]} castShadow geometry={coneGeo} scale={[cR, 3, cR]} material={leavesDarkMat} />
                  <mesh position={[0, tH + 2.6, 0]} castShadow geometry={coneGeo} scale={[cR * 0.7, 2.2, cR * 0.7]} material={leavesMat} />
                </>
              ) : (
                <mesh position={[0, tH + cR * 0.6, 0]} castShadow geometry={dodecGeo} scale={[cR, cR, cR]} material={leavesMat} />
              )}
              {isHighlighted && (
                <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={highlightGeo} material={highlightMat} />
              )}
            </group>
          );
        }

        if (res.type === 'berry_bush') {
          return (
            <group key={res.id} ref={el => setRef(res.id, el)} position={res.position} scale={res.scale}>
              <mesh position={[0, 0.4, 0]} castShadow geometry={dodecGeo} scale={[0.8, 0.6, 0.8]} material={berryLeafMat} />
              {/* Berries */}
              {res.health > 0 && [[-0.3, 0.5, 0.2], [0.2, 0.45, -0.25], [0.1, 0.55, 0.3], [-0.15, 0.35, -0.2]].map(([bx, by, bz], i) => (
                <mesh key={i} position={[bx, by, bz]} geometry={sphereGeo} scale={[0.06, 0.06, 0.06]} material={berryMat} />
              ))}
              {isHighlighted && (
                <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={highlightGeo} material={highlightMat} />
              )}
            </group>
          );
        }

        if (res.type === 'crate') {
          return (
            <group key={res.id} ref={el => setRef(res.id, el)} position={res.position} scale={res.scale}>
              <mesh position={[0, 0.4, 0]} castShadow geometry={boxGeo} scale={[0.7, 0.7, 0.7]} material={crateMat} />
              <mesh position={[0, 0.4, 0]} castShadow geometry={boxGeo} scale={[0.75, 0.1, 0.75]} material={crateBandMat} />
              {isHighlighted && (
                <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={highlightGeo} material={highlightMat} />
              )}
            </group>
          );
        }

        // Rock
        const rockScale = res.scale * (res.gatherable ? (res.health / res.maxHealth * 0.4 + 0.6) : 1);
        return (
          <group key={res.id} ref={el => setRef(res.id, el)} position={res.position} scale={rockScale}>
            <mesh castShadow geometry={rockGeo} material={res.variant === 0 ? stoneMat : stoneDarkMat} />
            {isHighlighted && (
              <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={highlightGeo} material={highlightMat} />
            )}
          </group>
        );
      })}
    </group>
  );
}