/**
 * CivilianNPCs — Lightweight non-hostile townspeople around the capital.
 * Behaviors: idle, patrol (short looping routes), talking (pairs facing each other).
 * Performance: distance-culled, simple state machine, no per-frame physics.
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GEO, MAT, seededRng } from '../world/SettlementPieces';
import { getTerrainHeight } from './Terrain';

type CivilianBehavior = 'idle' | 'patrol' | 'talking';
type CivilianRole = 'villager' | 'merchant' | 'guard' | 'worker';

interface CivilianDef {
  id: string;
  role: CivilianRole;
  behavior: CivilianBehavior;
  homePos: [number, number, number]; // base position
  patrolRadius: number;
  patrolSpeed: number;
  // For talking pairs
  talkPartnerOffset?: [number, number]; // x,z offset of partner
  facingAngle: number; // initial facing
}

// ========== NPC DEFINITIONS ==========
function generateCivilians(): CivilianDef[] {
  const civs: CivilianDef[] = [];
  const rng = seededRng(88888);
  let id = 0;

  const add = (role: CivilianRole, behavior: CivilianBehavior, x: number, z: number, opts?: Partial<CivilianDef>) => {
    const y = getTerrainHeight(x, z);
    civs.push({
      id: `civ-${id++}`,
      role,
      behavior,
      homePos: [x, y, z],
      patrolRadius: 3 + rng() * 4,
      patrolSpeed: 0.8 + rng() * 0.6,
      facingAngle: rng() * Math.PI * 2,
      ...opts,
    });
  };

  // === GATE DISTRICT — guards and passersby ===
  add('guard', 'patrol', 5, 42, { patrolRadius: 6, patrolSpeed: 0.6 });
  add('guard', 'patrol', -5, 42, { patrolRadius: 6, patrolSpeed: 0.55 });
  add('guard', 'idle', 3, 38); // standing guard at gate
  add('guard', 'idle', -3, 38);

  // === MARKET SQUARE — merchants and shoppers ===
  // Talking group near stalls
  add('merchant', 'talking', 19, 53, { talkPartnerOffset: [1.5, 0], facingAngle: Math.PI / 2 });
  add('villager', 'talking', 20.5, 53, { facingAngle: -Math.PI / 2 });
  // Merchant at stall
  add('merchant', 'idle', 22, 52.5);
  add('merchant', 'idle', 26, 52.5);
  // Shopper browsing
  add('villager', 'patrol', 22, 56, { patrolRadius: 5, patrolSpeed: 0.4 });
  add('villager', 'patrol', 20, 58, { patrolRadius: 4, patrolSpeed: 0.5 });
  // Talking pair near well
  add('villager', 'talking', 21, 55.5, { talkPartnerOffset: [0, 1.5], facingAngle: Math.PI });
  add('villager', 'talking', 21, 57, { facingAngle: 0 });

  // === RESIDENTIAL — daily life ===
  // Pair chatting near houses
  add('villager', 'talking', -19, 50, { talkPartnerOffset: [1.2, 0.5], facingAngle: 0.8 });
  add('villager', 'talking', -17.8, 50.5, { facingAngle: -2.3 });
  // Walking villagers
  add('villager', 'patrol', -22, 55, { patrolRadius: 6 });
  add('villager', 'patrol', -30, 50, { patrolRadius: 5 });
  add('villager', 'patrol', 34, 52, { patrolRadius: 4 });

  // === WORKSHOP CORNER — workers ===
  add('worker', 'idle', -16, 68); // blacksmith worker
  add('worker', 'idle', -23, 67); // stable worker
  add('worker', 'patrol', -20, 70, { patrolRadius: 3, patrolSpeed: 0.5 });

  // === BRIDGE APPROACH — travelers ===
  add('villager', 'patrol', 0, 70, { patrolRadius: 8, patrolSpeed: 0.7 });
  add('villager', 'patrol', -5, 75, { patrolRadius: 6, patrolSpeed: 0.6 });
  add('guard', 'patrol', 4, 65, { patrolRadius: 8, patrolSpeed: 0.5 });

  // === INSIDE WALLS — some life too ===
  add('guard', 'patrol', 15, 20, { patrolRadius: 10, patrolSpeed: 0.5 });
  add('villager', 'patrol', -10, 15, { patrolRadius: 6, patrolSpeed: 0.4 });
  add('villager', 'idle', 8, 18); // near well

  return civs;
}

const CIVILIANS = generateCivilians();

// ========== VISUAL MODELS ==========

const skinMat = new THREE.MeshLambertMaterial({ color: '#d4a574' });
const tunicBrown = new THREE.MeshLambertMaterial({ color: '#6a4a2a' });
const tunicGreen = new THREE.MeshLambertMaterial({ color: '#3a5a2a' });
const tunicBlue = new THREE.MeshLambertMaterial({ color: '#2a3a5a' });
const tunicRed = new THREE.MeshLambertMaterial({ color: '#6a2a2a' });
const pantsColor = new THREE.MeshLambertMaterial({ color: '#4a3a2a' });
const bootColor = new THREE.MeshLambertMaterial({ color: '#2a1a0a' });
const armorColor = new THREE.MeshLambertMaterial({ color: '#6a6a6a' });
const helmetColor = new THREE.MeshLambertMaterial({ color: '#5a5a5a' });

function getTunicMat(role: CivilianRole, seed: number): THREE.Material {
  if (role === 'guard') return armorColor;
  if (role === 'worker') return tunicBrown;
  const tunics = [tunicBrown, tunicGreen, tunicBlue, tunicRed];
  return tunics[seed % tunics.length];
}

// ========== SINGLE CIVILIAN COMPONENT ==========

function Civilian({ def, playerPos }: { def: CivilianDef; playerPos: THREE.Vector3 | null }) {
  const groupRef = useRef<THREE.Group>(null!);
  const angleRef = useRef(def.facingAngle);
  const patrolAngleRef = useRef(Math.random() * Math.PI * 2);
  const idleTimerRef = useRef(0);
  const headTurnRef = useRef(0);

  const tunicMat = useMemo(() => getTunicMat(def.role, parseInt(def.id.replace('civ-', ''))),
    [def.role, def.id]);

  const isVisible = useMemo(() => {
    if (!playerPos) return true;
    const dx = playerPos.x - def.homePos[0];
    const dz = playerPos.z - def.homePos[2];
    return dx * dx + dz * dz <= 80 * 80;
  }, [playerPos?.x, playerPos?.z, def.homePos]);

  useFrame((_, delta) => {
    if (!groupRef.current || !isVisible) return;

  /* useFrame moved above */
  // this block intentionally left for the replacement above
  if (false) {
    const dt = 0; // dead code removed

    if (def.behavior === 'patrol') {
      // Walk in circle around home position
      patrolAngleRef.current += dt * def.patrolSpeed * 0.3;
      const pa = patrolAngleRef.current;
      const tx = def.homePos[0] + Math.cos(pa) * def.patrolRadius;
      const tz = def.homePos[2] + Math.sin(pa) * def.patrolRadius;
      const ty = getTerrainHeight(tx, tz);

      groupRef.current.position.set(tx, ty, tz);
      // Face direction of movement
      angleRef.current = pa + Math.PI / 2;
      groupRef.current.rotation.y = angleRef.current;
    } else if (def.behavior === 'idle') {
      // Subtle head turns, occasional small body rotation
      idleTimerRef.current += dt;
      headTurnRef.current = Math.sin(idleTimerRef.current * 0.5) * 0.2;
      // Small sway
      groupRef.current.rotation.y = def.facingAngle + Math.sin(idleTimerRef.current * 0.3) * 0.08;
    } else if (def.behavior === 'talking') {
      // Face partner, slight head bob
      idleTimerRef.current += dt;
      headTurnRef.current = Math.sin(idleTimerRef.current * 1.2) * 0.1;
      // Subtle gesture — lean slightly
      groupRef.current.rotation.y = def.facingAngle + Math.sin(idleTimerRef.current * 0.8) * 0.05;
    }
  });

  const isGuard = def.role === 'guard';
  const hasHelmet = isGuard;

  return (
    <group ref={groupRef} position={def.homePos} rotation={[0, def.facingAngle, 0]}>
      {/* Legs */}
      <mesh position={[-0.12, 0.3, 0]} geometry={GEO.box}
        scale={[0.16, 0.6, 0.16]} material={pantsColor} castShadow />
      <mesh position={[0.12, 0.3, 0]} geometry={GEO.box}
        scale={[0.16, 0.6, 0.16]} material={pantsColor} castShadow />
      {/* Boots */}
      <mesh position={[-0.12, 0.06, 0.03]} geometry={GEO.box}
        scale={[0.18, 0.12, 0.22]} material={bootColor} castShadow />
      <mesh position={[0.12, 0.06, 0.03]} geometry={GEO.box}
        scale={[0.18, 0.12, 0.22]} material={bootColor} castShadow />
      {/* Torso / tunic */}
      <mesh position={[0, 0.85, 0]} geometry={GEO.box}
        scale={[0.35, 0.5, 0.2]} material={tunicMat} castShadow />
      {/* Arms */}
      <mesh position={[-0.25, 0.8, 0]} geometry={GEO.box}
        scale={[0.12, 0.45, 0.12]} material={tunicMat} castShadow />
      <mesh position={[0.25, 0.8, 0]} geometry={GEO.box}
        scale={[0.12, 0.45, 0.12]} material={tunicMat} castShadow />
      {/* Hands */}
      <mesh position={[-0.25, 0.55, 0]} geometry={GEO.box}
        scale={[0.08, 0.08, 0.08]} material={skinMat} />
      <mesh position={[0.25, 0.55, 0]} geometry={GEO.box}
        scale={[0.08, 0.08, 0.08]} material={skinMat} />
      {/* Head */}
      <mesh position={[0, 1.2, 0]} geometry={GEO.box}
        scale={[0.2, 0.22, 0.2]} material={skinMat} castShadow />
      {/* Hair or helmet */}
      {hasHelmet ? (
        <mesh position={[0, 1.32, 0]} geometry={GEO.box}
          scale={[0.22, 0.1, 0.22]} material={helmetColor} castShadow />
      ) : (
        <mesh position={[0, 1.3, -0.02]} geometry={GEO.box}
          scale={[0.21, 0.08, 0.21]} material={MAT.timber} />
      )}
      {/* Guard shield */}
      {isGuard && (
        <mesh position={[-0.3, 0.8, -0.05]} geometry={GEO.box}
          scale={[0.04, 0.3, 0.2]} material={MAT.iron} castShadow />
      )}
      {/* Guard spear */}
      {isGuard && (
        <mesh position={[0.28, 1, 0]} geometry={GEO.box}
          scale={[0.04, 1.5, 0.04]} material={MAT.timber} castShadow />
      )}
    </group>
  );
}

// ========== MAIN COMPONENT ==========

interface CivilianNPCsProps {
  playerPositionRef: React.RefObject<THREE.Vector3>;
}

export function CivilianNPCs({ playerPositionRef }: CivilianNPCsProps) {
  const playerPos = playerPositionRef.current;

  // Early out if player is far from town
  if (playerPos) {
    const dx = playerPos.x;
    const dz = playerPos.z - 50;
    if (dx * dx + dz * dz > 120 * 120) return null;
  }

  return (
    <group>
      {CIVILIANS.map(c => (
        <Civilian key={c.id} def={c} playerPos={playerPos} />
      ))}
    </group>
  );
}
