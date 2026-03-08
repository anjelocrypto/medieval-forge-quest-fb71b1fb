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

function WoodBeam({ position, rotation = [0, 0, 0], size, color, ghost, opacity }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number, number];
  color?: string;
  ghost: boolean;
  opacity: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color || COLORS.woodDark} transparent={ghost} opacity={opacity} />
    </mesh>
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
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5]} castShadow>
                <boxGeometry args={[0.2, 0.2, 0.2]} />
                <meshLambertMaterial color={color || COLORS.stoneDark} transparent={ghost} opacity={opacity} />
              </mesh>
            );
          })}
          {/* Logs - crossed */}
          <mesh position={[0, 0.15, 0]} rotation={[0, 0, 0.3]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.6, 5]} />
            <meshLambertMaterial color={color || COLORS.woodDark} transparent={ghost} opacity={opacity} />
          </mesh>
          <mesh position={[0, 0.15, 0]} rotation={[0, 1.2, -0.3]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.6, 5]} />
            <meshLambertMaterial color={color || COLORS.woodDark} transparent={ghost} opacity={opacity} />
          </mesh>
          <mesh position={[0, 0.2, 0]} rotation={[0.5, 0.6, 0.1]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.5, 5]} />
            <meshLambertMaterial color={color || '#5a3a1a'} transparent={ghost} opacity={opacity} />
          </mesh>
          {/* Fire glow + embers */}
          {!ghost && (
            <>
              <pointLight position={[0, 0.5, 0]} color="#ff6600" intensity={2.5} distance={10} />
              <pointLight position={[0, 0.3, 0]} color="#ff3300" intensity={0.8} distance={5} />
              {/* Ember particles */}
              {[0, 1, 2].map(i => (
                <mesh key={`ember-${i}`} position={[
                  Math.sin(i * 2.1) * 0.15,
                  0.3 + i * 0.12,
                  Math.cos(i * 2.1) * 0.15
                ]}>
                  <boxGeometry args={[0.04, 0.04, 0.04]} />
                  <meshBasicMaterial color="#ff8800" />
                </mesh>
              ))}
            </>
          )}
        </group>
      );

    case 'wall':
      return (
        <group>
          {/* Posts - thick, round top */}
          {[-1.5, 1.5].map((px, i) => (
            <group key={i}>
              <WoodBeam position={[px, 1.3, 0]} size={[0.22, 2.6, 0.22]} ghost={ghost} opacity={opacity} color={color} />
              {/* Post cap */}
              <mesh position={[px, 2.65, 0]} castShadow>
                <coneGeometry args={[0.15, 0.15, 6]} />
                <meshLambertMaterial color={color || COLORS.woodDark} transparent={ghost} opacity={opacity} />
              </mesh>
            </group>
          ))}
          {/* Horizontal planks */}
          {[0.4, 0.9, 1.4, 1.9, 2.3].map((py, i) => (
            <WoodBeam key={i} position={[0, py, 0]} size={[2.8, 0.18, 0.12]}
              ghost={ghost} opacity={opacity} color={color || (i % 2 === 0 ? '#7a5a14' : '#6a4a10')} />
          ))}
          {/* Cross brace */}
          <WoodBeam position={[0, 1.3, 0.07]} rotation={[0, 0, 0.5]} size={[0.1, 2.2, 0.08]}
            ghost={ghost} opacity={opacity} color={color || COLORS.woodDark} />
          {/* Support brace at base */}
          <WoodBeam position={[-1.2, 0.5, -0.5]} rotation={[0.6, 0, 0]} size={[0.12, 1, 0.12]}
            ghost={ghost} opacity={opacity} color={color || COLORS.woodDark} />
          <WoodBeam position={[1.2, 0.5, -0.5]} rotation={[0.6, 0, 0]} size={[0.12, 1, 0.12]}
            ghost={ghost} opacity={opacity} color={color || COLORS.woodDark} />
        </group>
      );

    case 'fence':
      return (
        <group>
          {/* Posts with pointed tops */}
          {[-1.8, -0.6, 0.6, 1.8].map((px, i) => (
            <group key={i}>
              <WoodBeam position={[px, 0.55, 0]} size={[0.12, 1.1, 0.12]}
                ghost={ghost} opacity={opacity} color={color || COLORS.woodDark} />
              <mesh position={[px, 1.15, 0]} castShadow>
                <coneGeometry args={[0.08, 0.12, 4]} />
                <meshLambertMaterial color={color || COLORS.woodDark} transparent={ghost} opacity={opacity} />
              </mesh>
            </group>
          ))}
          {/* Rails */}
          <WoodBeam position={[0, 0.35, 0]} size={[3.8, 0.08, 0.08]}
            ghost={ghost} opacity={opacity} color={color || '#6b4f10'} />
          <WoodBeam position={[0, 0.75, 0]} size={[3.8, 0.08, 0.08]}
            ghost={ghost} opacity={opacity} color={color || '#6b4f10'} />
          {/* Rope lashing detail */}
          {[-1.8, 1.8].map((px, i) => (
            <mesh key={`rope-${i}`} position={[px, 0.55, 0]} castShadow>
              <boxGeometry args={[0.06, 0.15, 0.15]} />
              <meshLambertMaterial color={color || '#8a7a50'} transparent={ghost} opacity={opacity} />
            </mesh>
          ))}
        </group>
      );

    case 'shelter':
      return (
        <group>
          {/* Foundation stones */}
          <mesh position={[0, 0.08, 0]} castShadow>
            <boxGeometry args={[3.8, 0.16, 3.8]} />
            <meshLambertMaterial color={color || COLORS.stoneDark} transparent={ghost} opacity={opacity} />
          </mesh>
          {/* Floor */}
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[3.5, 0.08, 3.5]} />
            <meshLambertMaterial color={color || '#5a3a1a'} transparent={ghost} opacity={opacity} />
          </mesh>
          {/* Corner posts */}
          {[[-1.65, -1.65], [1.65, -1.65], [-1.65, 1.65], [1.65, 1.65]].map(([px, pz], i) => (
            <WoodBeam key={i} position={[px, 1.3, pz]} size={[0.2, 2.2, 0.2]}
              ghost={ghost} opacity={opacity} color={color || COLORS.woodDark} />
          ))}
          {/* Walls - lower half with gaps */}
          <WoodBeam position={[-1.65, 0.7, 0]} size={[0.12, 1, 3.3]}
            ghost={ghost} opacity={opacity} color={color || '#7a5a14'} />
          <WoodBeam position={[1.65, 0.7, 0]} size={[0.12, 1, 3.3]}
            ghost={ghost} opacity={opacity} color={color || '#7a5a14'} />
          <WoodBeam position={[0, 0.7, -1.65]} size={[3.3, 1, 0.12]}
            ghost={ghost} opacity={opacity} color={color || '#7a5a14'} />
          {/* Front wall with doorway gap */}
          <WoodBeam position={[-1, 0.7, 1.65]} size={[1, 1, 0.12]}
            ghost={ghost} opacity={opacity} color={color || '#7a5a14'} />
          <WoodBeam position={[1, 0.7, 1.65]} size={[1, 1, 0.12]}
            ghost={ghost} opacity={opacity} color={color || '#7a5a14'} />
          {/* Door lintel */}
          <WoodBeam position={[0, 1.3, 1.65]} size={[0.8, 0.12, 0.14]}
            ghost={ghost} opacity={opacity} color={color || COLORS.woodDark} />

          {/* Roof beams */}
          <WoodBeam position={[0, 2.4, 0]} size={[3.8, 0.12, 0.12]}
            ghost={ghost} opacity={opacity} color={color || COLORS.woodDark} />
          <WoodBeam position={[0, 2.4, -1]} size={[3.8, 0.12, 0.12]}
            ghost={ghost} opacity={opacity} color={color || COLORS.woodDark} />
          <WoodBeam position={[0, 2.4, 1]} size={[3.8, 0.12, 0.12]}
            ghost={ghost} opacity={opacity} color={color || COLORS.woodDark} />
          {/* Thatched roof */}
          <mesh position={[0, 2.9, 0]} castShadow>
            <coneGeometry args={[2.8, 1.2, 4]} />
            <meshLambertMaterial color={color || '#6a5a30'} transparent={ghost} opacity={opacity} />
          </mesh>
          {/* Roof thatch texture layer */}
          <mesh position={[0, 2.7, 0]} castShadow>
            <coneGeometry args={[2.9, 0.6, 4]} />
            <meshLambertMaterial color={color || '#7a6a3a'} transparent={ghost} opacity={opacity} />
          </mesh>
        </group>
      );

    default:
      return null;
  }
}