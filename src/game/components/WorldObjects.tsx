import { useRef, useCallback } from 'react';
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

interface ShakeState { shaking: boolean; timer: number; }

export function WorldObjects({
  resources, playerPositionRef, onSetInteraction,
  onAddResource, onDepleteResource, onHitResource,
}: Props) {
  const cooldownRef = useRef(0);
  const shakesRef = useRef<Map<string, ShakeState>>(new Map());
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  const lastInteractRef = useRef<string | null>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    cooldownRef.current = Math.max(0, cooldownRef.current - dt);
    const playerPos = playerPositionRef.current;
    if (!playerPos) return;

    // Find nearest gatherable
    let nearest: WorldResource | null = null;
    let nearestDist = INTERACTION_RANGE;
    for (const res of resources) {
      if (res.depleted || !res.gatherable) continue;
      const dx = playerPos.x - res.position[0];
      const dz = playerPos.z - res.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) { nearestDist = dist; nearest = res; }
    }

    if (nearest) {
      const label = nearest.type === 'tree' ? '🪓 Press E — Chop Tree' : '⛏ Press E — Mine Rock';
      onSetInteraction(`${label} (${nearest.health}/${nearest.maxHealth})`);
      lastInteractRef.current = nearest.id;
    } else if (lastInteractRef.current !== null) {
      onSetInteraction(null);
      lastInteractRef.current = null;
    }

    const { interact } = getMovementInput();
    if (interact && nearest && cooldownRef.current <= 0) {
      cooldownRef.current = GATHER_COOLDOWN;
      shakesRef.current.set(nearest.id, { shaking: true, timer: 0.3 });
      if (nearest.health <= 1) {
        onDepleteResource(nearest.id);
        onAddResource(nearest.type === 'tree' ? 'wood' : 'stone',
          nearest.type === 'tree' ? TREE_WOOD_REWARD : ROCK_STONE_REWARD);
      } else {
        onHitResource(nearest.id);
        onAddResource(nearest.type === 'tree' ? 'wood' : 'stone', 1);
      }
    }

    // Update shakes
    shakesRef.current.forEach((state, id) => {
      if (!state.shaking) return;
      state.timer -= dt;
      const group = groupRefs.current.get(id);
      if (group) {
        const intensity = Math.max(0, state.timer) * 10;
        group.rotation.z = Math.sin(Date.now() * 0.05) * 0.05 * intensity;
        group.rotation.x = Math.cos(Date.now() * 0.07) * 0.03 * intensity;
      }
      if (state.timer <= 0) {
        state.shaking = false;
        if (group) { group.rotation.z = 0; group.rotation.x = 0; }
      }
    });
  });

  const setRef = useCallback((id: string, el: THREE.Group | null) => {
    if (el) groupRefs.current.set(id, el);
    else groupRefs.current.delete(id);
  }, []);

  return (
    <group>
      {resources.map(res => {
        if (res.depleted) return null;
        const isHighlighted = lastInteractRef.current === res.id;

        if (res.type === 'tree') {
          const tH = res.trunkHeight * res.scale;
          const cR = res.crownRadius * (res.gatherable ? (res.health / res.maxHealth * 0.4 + 0.6) : 1);
          return (
            <group key={res.id} ref={el => setRef(res.id, el)} position={res.position} scale={res.scale}>
              <mesh position={[0, tH / 2, 0]} castShadow>
                <cylinderGeometry args={[0.15, 0.25, tH, 6]} />
                <meshLambertMaterial color={COLORS.woodDark} />
              </mesh>
              {res.variant === 1 ? (
                <>
                  <mesh position={[0, tH + 1, 0]} castShadow>
                    <coneGeometry args={[cR, 3, 6]} />
                    <meshLambertMaterial color={COLORS.leavesDark} />
                  </mesh>
                  <mesh position={[0, tH + 2.2, 0]} castShadow>
                    <coneGeometry args={[cR * 0.7, 2.2, 6]} />
                    <meshLambertMaterial color={COLORS.leaves} />
                  </mesh>
                </>
              ) : (
                <mesh position={[0, tH + cR * 0.6, 0]} castShadow>
                  <dodecahedronGeometry args={[cR, 1]} />
                  <meshLambertMaterial color={COLORS.leaves} />
                </mesh>
              )}
              {isHighlighted && (
                <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[1.5, 1.8, 16]} />
                  <meshBasicMaterial color="#ffcc44" transparent opacity={0.4} />
                </mesh>
              )}
            </group>
          );
        }

        // Rock
        return (
          <group key={res.id} ref={el => setRef(res.id, el)}
            position={res.position}
            scale={res.scale * (res.gatherable ? (res.health / res.maxHealth * 0.4 + 0.6) : 1)}>
            <mesh castShadow>
              <dodecahedronGeometry args={[1, 0]} />
              <meshLambertMaterial color={res.variant === 0 ? COLORS.stone : COLORS.stoneDark} />
            </mesh>
            {isHighlighted && (
              <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[1.2, 1.5, 16]} />
                <meshBasicMaterial color="#ffcc44" transparent opacity={0.4} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
