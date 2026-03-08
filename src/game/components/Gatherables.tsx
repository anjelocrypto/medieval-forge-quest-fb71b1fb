import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants';
import { GatherableResource, INTERACTION_RANGE, GATHER_COOLDOWN, TREE_WOOD_REWARD, ROCK_STONE_REWARD } from '../systems/GatherableData';
import { ResourceInventory } from '../types';

interface GatherablesProps {
  resources: GatherableResource[];
  playerPositionRef: React.RefObject<THREE.Vector3>;
  onSetInteraction: (text: string | null) => void;
  onAddResource: (type: keyof ResourceInventory, amount: number) => void;
  onDepleteResource: (id: string) => void;
  onHitResource: (id: string) => void;
  keysRef: React.RefObject<Set<string>>;
}

// Per-resource shake state
interface ShakeState {
  shaking: boolean;
  timer: number;
}

export function Gatherables({
  resources,
  playerPositionRef,
  onSetInteraction,
  onAddResource,
  onDepleteResource,
  onHitResource,
  keysRef,
}: GatherablesProps) {
  const cooldownRef = useRef(0);
  const shakesRef = useRef<Map<string, ShakeState>>(new Map());
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  const lastInteractRef = useRef<string | null>(null);
  const eWasPressedRef = useRef(false);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    cooldownRef.current = Math.max(0, cooldownRef.current - dt);

    const playerPos = playerPositionRef.current;
    if (!playerPos) return;

    // Find nearest interactable
    let nearest: GatherableResource | null = null;
    let nearestDist = INTERACTION_RANGE;

    for (const res of resources) {
      if (res.depleted) continue;
      const dx = playerPos.x - res.position[0];
      const dz = playerPos.z - res.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = res;
      }
    }

    // Update interaction text
    if (nearest) {
      const label = nearest.type === 'tree' ? '🪓 Press E — Chop Tree' : '⛏ Press E — Mine Rock';
      const hitsLeft = nearest.health;
      onSetInteraction(`${label} (${hitsLeft}/${nearest.maxHealth})`);
      lastInteractRef.current = nearest.id;
    } else {
      if (lastInteractRef.current !== null) {
        onSetInteraction(null);
        lastInteractRef.current = null;
      }
    }

    // Handle E press (edge-triggered)
    const keys = keysRef.current;
    const ePressed = keys ? keys.has('KeyE') : false;
    const eJustPressed = ePressed && !eWasPressedRef.current;
    eWasPressedRef.current = ePressed;

    if (eJustPressed && nearest && cooldownRef.current <= 0) {
      cooldownRef.current = GATHER_COOLDOWN;
      
      // Start shake
      shakesRef.current.set(nearest.id, { shaking: true, timer: 0.3 });
      
      if (nearest.health <= 1) {
        // Deplete
        onDepleteResource(nearest.id);
        if (nearest.type === 'tree') onAddResource('wood', TREE_WOOD_REWARD);
        else onAddResource('stone', ROCK_STONE_REWARD);
      } else {
        onHitResource(nearest.id);
        if (nearest.type === 'tree') onAddResource('wood', 1);
        else onAddResource('stone', 1);
      }
    }

    // Update shakes
    shakesRef.current.forEach((state, id) => {
      if (state.shaking) {
        state.timer -= dt;
        const group = groupRefs.current.get(id);
        if (group) {
          const intensity = Math.max(0, state.timer) * 10;
          group.rotation.z = Math.sin(Date.now() * 0.05) * 0.05 * intensity;
          group.rotation.x = Math.cos(Date.now() * 0.07) * 0.03 * intensity;
        }
        if (state.timer <= 0) {
          state.shaking = false;
          const group = groupRefs.current.get(id);
          if (group) {
            group.rotation.z = 0;
            group.rotation.x = 0;
          }
        }
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

        if (res.type === 'tree') {
          const trunkH = 2.5 * res.scale;
          return (
            <group
              key={res.id}
              ref={(el) => setRef(res.id, el)}
              position={res.position}
              scale={res.scale}
            >
              {/* Trunk */}
              <mesh position={[0, trunkH / 2, 0]} castShadow>
                <cylinderGeometry args={[0.18, 0.28, trunkH, 6]} />
                <meshLambertMaterial color={COLORS.woodDark} />
              </mesh>
              {/* Crown - health visual */}
              <mesh position={[0, trunkH + 1.2, 0]} castShadow>
                <dodecahedronGeometry args={[1.6 * (res.health / res.maxHealth * 0.5 + 0.5), 1]} />
                <meshLambertMaterial color={res.variant === 0 ? COLORS.leaves : COLORS.leavesDark} />
              </mesh>
              {/* Interaction glow ring */}
              {lastInteractRef.current === res.id && (
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
          <group
            key={res.id}
            ref={(el) => setRef(res.id, el)}
            position={[res.position[0], res.position[1] + res.scale * 0.3, res.position[2]]}
            scale={res.scale * (res.health / res.maxHealth * 0.4 + 0.6)}
          >
            <mesh castShadow>
              <dodecahedronGeometry args={[1, 0]} />
              <meshLambertMaterial color={res.variant === 0 ? COLORS.stone : COLORS.stoneDark} />
            </mesh>
            {lastInteractRef.current === res.id && (
              <mesh position={[0, -0.3 / res.scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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
