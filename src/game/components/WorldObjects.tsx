import { useMemo, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants';
import { WorldResource, INTERACTION_RANGE, GATHER_COOLDOWN, TREE_WOOD_REWARD, ROCK_STONE_REWARD } from '../systems/WorldResources';
import { getMovementInput } from '../systems/InputSystem';
import { ResourceInventory } from '../types';

interface Props {
  resources: WorldResource[];
  playerPositionRef: React.RefObject<THREE.Vector3>;
  onSetInteraction: (text: string | null) => void;
  onAddResource: (type: keyof ResourceInventory, amount: number) => void;
  onDepleteResource: (id: string) => void;
  onHitResource: (id: string) => void;
}

// Shared geometries & materials — created once
const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 1, 5);
const coneGeo = new THREE.ConeGeometry(1, 1, 5);
const dodecGeo = new THREE.DodecahedronGeometry(1, 1);
const rockGeo = new THREE.DodecahedronGeometry(1, 0);

const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.woodDark });
const leavesMat = new THREE.MeshLambertMaterial({ color: COLORS.leaves });
const leavesDarkMat = new THREE.MeshLambertMaterial({ color: COLORS.leavesDark });
const stoneMat = new THREE.MeshLambertMaterial({ color: COLORS.stone });
const stoneDarkMat = new THREE.MeshLambertMaterial({ color: COLORS.stoneDark });
const highlightMat = new THREE.MeshBasicMaterial({ color: '#ffcc44', transparent: true, opacity: 0.4 });
const highlightGeo = new THREE.RingGeometry(1.5, 1.8, 12);

export function WorldObjects({
  resources, playerPositionRef, onSetInteraction,
  onAddResource, onDepleteResource, onHitResource,
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

    // Only check interactions every 3 frames
    frameSkipRef.current++;
    const checkInteraction = frameSkipRef.current % 3 === 0;

    let nearestId: string | null = null;
    let nearestRes: WorldResource | null = null;

    if (checkInteraction) {
      let nearestDist = INTERACTION_RANGE;
      const px = playerPos.x, pz = playerPos.z;
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
        }
      }

      if (nearestRes) {
        const label = nearestRes.type === 'tree' ? '🪓 Press E — Chop Tree' : '⛏ Press E — Mine Rock';
        const text = `${label} (${nearestRes.health}/${nearestRes.maxHealth})`;
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
    } else {
      nearestId = lastInteractIdRef.current;
      if (nearestId) {
        nearestRes = resources.find(r => r.id === nearestId) || null;
      }
    }

    const { interact } = getMovementInput();
    if (interact && nearestRes && cooldownRef.current <= 0) {
      cooldownRef.current = GATHER_COOLDOWN;
      shakesRef.current.set(nearestRes.id, { timer: 0.3 });
      if (nearestRes.health <= 1) {
        onDepleteResource(nearestRes.id);
        onAddResource(nearestRes.type === 'tree' ? 'wood' : 'stone',
          nearestRes.type === 'tree' ? TREE_WOOD_REWARD : ROCK_STONE_REWARD);
      } else {
        onHitResource(nearestRes.id);
        onAddResource(nearestRes.type === 'tree' ? 'wood' : 'stone', 1);
      }
    }

    // Update shakes
    shakesRef.current.forEach((state, id) => {
      state.timer -= dt;
      const group = groupRefs.current.get(id);
      if (group) {
        if (state.timer > 0) {
          const intensity = state.timer * 10;
          group.rotation.z = Math.sin(Date.now() * 0.05) * 0.05 * intensity;
        } else {
          group.rotation.z = 0;
          group.rotation.x = 0;
          shakesRef.current.delete(id);
        }
      }
    });
  });

  const setRef = useCallback((id: string, el: THREE.Group | null) => {
    if (el) groupRefs.current.set(id, el);
    else groupRefs.current.delete(id);
  }, []);

  // Distance-based culling: only render objects within render distance
  // We use a memoized render that checks distance lazily
  const playerPos = playerPositionRef.current;

  return (
    <group>
      {resources.map(res => {
        if (res.depleted) return null;

        // Distance culling — skip rendering objects far from player
        if (playerPos) {
          const dx = playerPos.x - res.position[0];
          const dz = playerPos.z - res.position[2];
          const distSq = dx * dx + dz * dz;
          // Decorative: cull at 100, gatherable: cull at 150
          const cullDist = res.gatherable ? 150 : 100;
          if (distSq > cullDist * cullDist) return null;
        }

        const isHighlighted = lastInteractIdRef.current === res.id;

        if (res.type === 'tree') {
          const tH = res.trunkHeight * res.scale;
          const cR = res.crownRadius * (res.gatherable ? (res.health / res.maxHealth * 0.4 + 0.6) : 1);
          return (
            <group key={res.id} ref={el => setRef(res.id, el)} position={res.position} scale={res.scale}>
              <mesh position={[0, tH / 2, 0]} castShadow geometry={trunkGeo}
                scale={[1, tH, 1]} material={trunkMat} />
              {res.variant === 1 ? (
                <>
                  <mesh position={[0, tH + 1.5, 0]} castShadow geometry={coneGeo}
                    scale={[cR, 3, cR]} material={leavesDarkMat} />
                  <mesh position={[0, tH + 2.6, 0]} castShadow geometry={coneGeo}
                    scale={[cR * 0.7, 2.2, cR * 0.7]} material={leavesMat} />
                </>
              ) : (
                <mesh position={[0, tH + cR * 0.6, 0]} castShadow geometry={dodecGeo}
                  scale={[cR, cR, cR]} material={leavesMat} />
              )}
              {isHighlighted && (
                <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}
                  geometry={highlightGeo} material={highlightMat} />
              )}
            </group>
          );
        }

        // Rock
        const rockScale = res.scale * (res.gatherable ? (res.health / res.maxHealth * 0.4 + 0.6) : 1);
        return (
          <group key={res.id} ref={el => setRef(res.id, el)}
            position={res.position} scale={rockScale}>
            <mesh castShadow geometry={rockGeo}
              material={res.variant === 0 ? stoneMat : stoneDarkMat} />
            {isHighlighted && (
              <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}
                geometry={highlightGeo} material={highlightMat} />
            )}
          </group>
        );
      })}
    </group>
  );
}