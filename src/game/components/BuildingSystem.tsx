import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getMovementInput } from '../systems/InputSystem';
import { getTerrainHeight } from './Terrain';
import { PlacedStructure, BUILDABLES, BuildableType, MIN_STRUCTURE_SPACING } from '../systems/BuildingData';
import { ResourceInventory } from '../types';
import { COLORS } from '../constants';

interface Props {
  buildMode: boolean;
  selectedIndex: number;
  playerPositionRef: React.RefObject<THREE.Vector3>;
  playerRotationRef: React.RefObject<number>;
  structures: PlacedStructure[];
  inventory: ResourceInventory;
  onPlace: (structure: PlacedStructure) => void;
  onSetBuildFeedback: (text: string | null) => void;
}

function canAfford(cost: Partial<ResourceInventory>, inv: ResourceInventory): boolean {
  for (const [key, val] of Object.entries(cost)) {
    if ((inv[key as keyof ResourceInventory] || 0) < (val || 0)) return false;
  }
  return true;
}

function isValidPlacement(
  pos: [number, number, number],
  playerPos: THREE.Vector3,
  structures: PlacedStructure[],
): { valid: boolean; reason?: string } {
  const dx = pos[0] - playerPos.x;
  const dz = pos[2] - playerPos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 2) return { valid: false, reason: 'Too close to player' };
  if (dist > 8) return { valid: false, reason: 'Too far away' };
  if (pos[1] < -0.5) return { valid: false, reason: 'Cannot place in water' };

  for (const s of structures) {
    const sdx = pos[0] - s.position[0];
    const sdz = pos[2] - s.position[2];
    if (Math.sqrt(sdx * sdx + sdz * sdz) < MIN_STRUCTURE_SPACING) {
      return { valid: false, reason: 'Too close to another structure' };
    }
  }
  return { valid: true };
}

export function BuildingSystem({
  buildMode, selectedIndex, playerPositionRef, playerRotationRef,
  structures, inventory, onPlace, onSetBuildFeedback,
}: Props) {
  const ghostPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const validRef = useRef(false);
  const idCounterRef = useRef(0);

  useFrame(() => {
    if (!buildMode) return;
    const playerPos = playerPositionRef.current;
    if (!playerPos) return;

    const config = BUILDABLES[selectedIndex];
    if (!config) return;

    // Place ghost 5 units in front of player
    const rot = playerRotationRef.current || 0;
    const placeX = playerPos.x + Math.sin(rot) * 5;
    const placeZ = playerPos.z + Math.cos(rot) * 5;
    const placeY = getTerrainHeight(placeX, placeZ);
    ghostPosRef.current = [placeX, placeY, placeZ];

    const { valid, reason } = isValidPlacement(ghostPosRef.current, playerPos, structures);
    const affordable = canAfford(config.cost, inventory);
    validRef.current = valid && affordable;

    if (!affordable) {
      onSetBuildFeedback(`❌ Not enough resources — ${config.description}`);
    } else if (!valid) {
      onSetBuildFeedback(`❌ ${reason}`);
    } else {
      onSetBuildFeedback(`✅ ${config.label} — Click to place (${config.description})`);
    }

    const input = getMovementInput();
    if (input.buildPlace && validRef.current) {
      onPlace({
        id: `struct-${idCounterRef.current++}`,
        type: config.type,
        position: [...ghostPosRef.current],
        rotation: rot,
      });
    }
  });

  if (!buildMode) return <StructureRenderer structures={structures} />;

  const config = BUILDABLES[selectedIndex];
  const ghostPos = ghostPosRef.current;
  const isValid = validRef.current;

  return (
    <group>
      <StructureRenderer structures={structures} />
      {/* Ghost preview */}
      <group position={ghostPos} rotation={[0, playerRotationRef.current || 0, 0]}>
        <StructureMesh type={config?.type || 'campfire'} ghost opacity={0.5} valid={isValid} />
      </group>
    </group>
  );
}

function StructureRenderer({ structures }: { structures: PlacedStructure[] }) {
  return (
    <group>
      {structures.map(s => (
        <group key={s.id} position={s.position} rotation={[0, s.rotation, 0]}>
          <StructureMesh type={s.type} ghost={false} opacity={1} valid={true} />
        </group>
      ))}
    </group>
  );
}

function StructureMesh({ type, ghost, opacity, valid }: {
  type: BuildableType; ghost: boolean; opacity: number; valid: boolean;
}) {
  const color = ghost ? (valid ? '#44ff44' : '#ff4444') : undefined;

  switch (type) {
    case 'campfire':
      return (
        <group>
          {/* Stone ring */}
          {[0, 1, 2, 3, 4, 5].map(i => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.4, 0.1, Math.sin(a) * 0.4]} castShadow>
                <boxGeometry args={[0.2, 0.15, 0.2]} />
                <meshLambertMaterial color={color || COLORS.stone} transparent={ghost} opacity={opacity} />
              </mesh>
            );
          })}
          {/* Logs */}
          <mesh position={[0, 0.15, 0]} rotation={[0, 0, 0.3]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.5, 5]} />
            <meshLambertMaterial color={color || COLORS.woodDark} transparent={ghost} opacity={opacity} />
          </mesh>
          <mesh position={[0, 0.15, 0]} rotation={[0, 1.2, -0.3]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.5, 5]} />
            <meshLambertMaterial color={color || COLORS.woodDark} transparent={ghost} opacity={opacity} />
          </mesh>
          {/* Fire glow */}
          {!ghost && (
            <pointLight position={[0, 0.4, 0]} color="#ff6600" intensity={2} distance={8} />
          )}
        </group>
      );

    case 'wall':
      return (
        <group>
          {/* Main wall */}
          <mesh position={[0, 1.25, 0]} castShadow>
            <boxGeometry args={[3, 2.5, 0.25]} />
            <meshLambertMaterial color={color || '#7a5a14'} transparent={ghost} opacity={opacity} />
          </mesh>
          {/* Posts */}
          <mesh position={[-1.4, 1.25, 0]} castShadow>
            <boxGeometry args={[0.2, 2.5, 0.2]} />
            <meshLambertMaterial color={color || COLORS.woodDark} transparent={ghost} opacity={opacity} />
          </mesh>
          <mesh position={[1.4, 1.25, 0]} castShadow>
            <boxGeometry args={[0.2, 2.5, 0.2]} />
            <meshLambertMaterial color={color || COLORS.woodDark} transparent={ghost} opacity={opacity} />
          </mesh>
        </group>
      );

    case 'fence':
      return (
        <group>
          {/* Rails */}
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[4, 0.1, 0.1]} />
            <meshLambertMaterial color={color || '#6b4f10'} transparent={ghost} opacity={opacity} />
          </mesh>
          <mesh position={[0, 0.9, 0]} castShadow>
            <boxGeometry args={[4, 0.1, 0.1]} />
            <meshLambertMaterial color={color || '#6b4f10'} transparent={ghost} opacity={opacity} />
          </mesh>
          {/* Posts */}
          {[-1.8, -0.6, 0.6, 1.8].map((px, i) => (
            <mesh key={i} position={[px, 0.6, 0]} castShadow>
              <boxGeometry args={[0.12, 1.2, 0.12]} />
              <meshLambertMaterial color={color || COLORS.woodDark} transparent={ghost} opacity={opacity} />
            </mesh>
          ))}
        </group>
      );

    case 'shelter':
      return (
        <group>
          {/* Floor */}
          <mesh position={[0, 0.05, 0]} castShadow>
            <boxGeometry args={[3.5, 0.1, 3.5]} />
            <meshLambertMaterial color={color || '#5a3a1a'} transparent={ghost} opacity={opacity} />
          </mesh>
          {/* Walls */}
          <mesh position={[-1.7, 1, 0]} castShadow>
            <boxGeometry args={[0.15, 2, 3.5]} />
            <meshLambertMaterial color={color || '#7a5a14'} transparent={ghost} opacity={opacity} />
          </mesh>
          <mesh position={[1.7, 1, 0]} castShadow>
            <boxGeometry args={[0.15, 2, 3.5]} />
            <meshLambertMaterial color={color || '#7a5a14'} transparent={ghost} opacity={opacity} />
          </mesh>
          <mesh position={[0, 1, -1.7]} castShadow>
            <boxGeometry args={[3.5, 2, 0.15]} />
            <meshLambertMaterial color={color || '#7a5a14'} transparent={ghost} opacity={opacity} />
          </mesh>
          {/* Roof */}
          <mesh position={[0, 2.3, 0]} rotation={[0, 0, 0]} castShadow>
            <coneGeometry args={[2.8, 1.5, 4]} />
            <meshLambertMaterial color={color || COLORS.roof} transparent={ghost} opacity={opacity} />
          </mesh>
        </group>
      );

    default:
      return null;
  }
}
