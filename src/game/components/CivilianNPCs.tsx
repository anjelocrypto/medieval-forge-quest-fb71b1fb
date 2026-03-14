/**
 * CivilianNPCs — Non-hostile townspeople with full procedural animation.
 * Scale-matched to player (~1.8m). Articulated limbs, distinct guard/villager gaits.
 * Performance: distance-culled, shared geometry/materials, lightweight state machine.
 * Covers central town + all 5 new kingdoms.
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTerrainHeight } from './Terrain';
import { SETTLEMENTS } from '../world/RegionData';

type CivilianBehavior = 'idle' | 'patrol' | 'talking';
type CivilianRole = 'villager' | 'merchant' | 'guard' | 'worker';

interface CivilianDef {
  id: string;
  role: CivilianRole;
  behavior: CivilianBehavior;
  homePos: [number, number, number];
  patrolRadius: number;
  patrolSpeed: number;
  talkPartnerOffset?: [number, number];
  facingAngle: number;
  kingdom?: string;
}

// ========== SEEDED RNG ==========
function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
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
      role, behavior,
      homePos: [x, y, z],
      patrolRadius: 3 + rng() * 4,
      patrolSpeed: 0.8 + rng() * 0.6,
      facingAngle: rng() * Math.PI * 2,
      ...opts,
    });
  };

  // ===== IRONHOLD (CENTRAL TOWN) =====
  // GATE DISTRICT
  add('guard', 'patrol', 5, 42, { patrolRadius: 6, patrolSpeed: 0.6 });
  add('guard', 'patrol', -5, 42, { patrolRadius: 6, patrolSpeed: 0.55 });
  add('guard', 'idle', 3, 38);
  add('guard', 'idle', -3, 38);

  // MARKET SQUARE
  add('merchant', 'talking', 19, 53, { talkPartnerOffset: [1.5, 0], facingAngle: Math.PI / 2 });
  add('villager', 'talking', 20.5, 53, { facingAngle: -Math.PI / 2 });
  add('merchant', 'idle', 22, 52.5);
  add('merchant', 'idle', 26, 52.5);
  add('villager', 'patrol', 22, 56, { patrolRadius: 5, patrolSpeed: 0.4 });
  add('villager', 'patrol', 20, 58, { patrolRadius: 4, patrolSpeed: 0.5 });
  add('villager', 'talking', 21, 55.5, { talkPartnerOffset: [0, 1.5], facingAngle: Math.PI });
  add('villager', 'talking', 21, 57, { facingAngle: 0 });

  // RESIDENTIAL
  add('villager', 'talking', -19, 50, { talkPartnerOffset: [1.2, 0.5], facingAngle: 0.8 });
  add('villager', 'talking', -17.8, 50.5, { facingAngle: -2.3 });
  add('villager', 'patrol', -22, 55, { patrolRadius: 6 });
  add('villager', 'patrol', -30, 50, { patrolRadius: 5 });
  add('villager', 'patrol', 34, 52, { patrolRadius: 4 });

  // WORKSHOP CORNER
  add('worker', 'idle', -16, 68);
  add('worker', 'idle', -23, 67);
  add('worker', 'patrol', -20, 70, { patrolRadius: 3, patrolSpeed: 0.5 });

  // BRIDGE APPROACH
  add('villager', 'patrol', 0, 70, { patrolRadius: 8, patrolSpeed: 0.7 });
  add('villager', 'patrol', -5, 75, { patrolRadius: 6, patrolSpeed: 0.6 });
  add('guard', 'patrol', 4, 65, { patrolRadius: 8, patrolSpeed: 0.5 });

  // INSIDE WALLS
  add('guard', 'patrol', 15, 20, { patrolRadius: 10, patrolSpeed: 0.5 });
  add('villager', 'patrol', -10, 15, { patrolRadius: 6, patrolSpeed: 0.4 });
  add('villager', 'idle', 8, 18);

  // ===== THORNWALL (fortified city) at [-500, -450] =====
  const tw = [-500, -450];
  // Gate guards
  add('guard', 'idle', tw[0] - 5, tw[1] + 45, { kingdom: 'thornwall' });
  add('guard', 'idle', tw[0] + 5, tw[1] + 45, { kingdom: 'thornwall' });
  add('guard', 'patrol', tw[0], tw[1] + 42, { patrolRadius: 8, patrolSpeed: 0.5, kingdom: 'thornwall' });
  add('guard', 'patrol', tw[0] + 40, tw[1], { patrolRadius: 12, patrolSpeed: 0.45, kingdom: 'thornwall' });
  // Barracks district
  add('guard', 'patrol', tw[0] - 15, tw[1] + 15, { patrolRadius: 10, patrolSpeed: 0.5, kingdom: 'thornwall' });
  add('guard', 'patrol', tw[0] + 15, tw[1] + 15, { patrolRadius: 10, patrolSpeed: 0.5, kingdom: 'thornwall' });
  // Workers at smithy
  add('worker', 'idle', tw[0] - 25, tw[1] + 5, { kingdom: 'thornwall' });
  add('worker', 'patrol', tw[0] - 22, tw[1] + 8, { patrolRadius: 3, patrolSpeed: 0.4, kingdom: 'thornwall' });
  // Civilians in housing
  add('villager', 'patrol', tw[0] + 20, tw[1] - 10, { patrolRadius: 8, patrolSpeed: 0.5, kingdom: 'thornwall' });
  add('villager', 'talking', tw[0] + 10, tw[1] + 25, { facingAngle: 1.2, kingdom: 'thornwall' });
  add('villager', 'talking', tw[0] + 11.5, tw[1] + 25, { facingAngle: -1.9, kingdom: 'thornwall' });
  add('villager', 'patrol', tw[0] - 15, tw[1] - 20, { patrolRadius: 6, kingdom: 'thornwall' });
  add('villager', 'idle', tw[0] + 10, tw[1] + 25, { kingdom: 'thornwall' });

  // ===== RIVERMOOR (river town) at [450, 350] =====
  const rm = [450, 350];
  // Dock guards
  add('guard', 'patrol', rm[0] - 15, rm[1] - 28, { patrolRadius: 10, patrolSpeed: 0.5, kingdom: 'rivermoor' });
  add('guard', 'patrol', rm[0] + 15, rm[1] - 28, { patrolRadius: 8, patrolSpeed: 0.45, kingdom: 'rivermoor' });
  // Market merchants near dock
  add('merchant', 'idle', rm[0] - 8, rm[1] - 22, { kingdom: 'rivermoor' });
  add('merchant', 'idle', rm[0] - 2, rm[1] - 22, { kingdom: 'rivermoor' });
  add('merchant', 'idle', rm[0] + 4, rm[1] - 22, { kingdom: 'rivermoor' });
  add('merchant', 'talking', rm[0] + 10, rm[1] - 22, { facingAngle: -0.5, kingdom: 'rivermoor' });
  add('villager', 'talking', rm[0] + 11, rm[1] - 21, { facingAngle: 2.6, kingdom: 'rivermoor' });
  // Town center
  add('villager', 'patrol', rm[0], rm[1] + 5, { patrolRadius: 10, patrolSpeed: 0.5, kingdom: 'rivermoor' });
  add('villager', 'patrol', rm[0] - 12, rm[1] + 10, { patrolRadius: 6, kingdom: 'rivermoor' });
  add('villager', 'patrol', rm[0] + 15, rm[1] + 8, { patrolRadius: 7, kingdom: 'rivermoor' });
  // Workers on docks
  add('worker', 'patrol', rm[0] - 5, rm[1] - 30, { patrolRadius: 8, patrolSpeed: 0.6, kingdom: 'rivermoor' });
  add('worker', 'idle', rm[0] + 8, rm[1] - 32, { kingdom: 'rivermoor' });
  // Gate approach
  add('guard', 'idle', rm[0] - 3, rm[1] + 30, { kingdom: 'rivermoor' });
  add('guard', 'idle', rm[0] + 3, rm[1] + 30, { kingdom: 'rivermoor' });

  // ===== STONEPEAK (mountain hold) at [-400, 500] =====
  const sp = [-400, 500];
  // Gate guards
  add('guard', 'idle', sp[0] - 4, sp[1] + 25, { kingdom: 'stonepeak' });
  add('guard', 'idle', sp[0] + 4, sp[1] + 25, { kingdom: 'stonepeak' });
  add('guard', 'patrol', sp[0], sp[1] + 28, { patrolRadius: 4, patrolSpeed: 0.5, kingdom: 'stonepeak' });
  // Wall patrols — constrained to stay inside walls (radius ±25)
  add('guard', 'patrol', sp[0] + 15, sp[1], { patrolRadius: 8, patrolSpeed: 0.4, kingdom: 'stonepeak' });
  add('guard', 'patrol', sp[0] - 15, sp[1], { patrolRadius: 8, patrolSpeed: 0.4, kingdom: 'stonepeak' });
  // Mine workers
  add('worker', 'patrol', sp[0] - 18, sp[1] - 5, { patrolRadius: 4, patrolSpeed: 0.5, kingdom: 'stonepeak' });
  add('worker', 'idle', sp[0] - 20, sp[1] - 3, { kingdom: 'stonepeak' });
  // Inner residents
  add('villager', 'patrol', sp[0] + 10, sp[1] + 5, { patrolRadius: 8, kingdom: 'stonepeak' });
  add('villager', 'patrol', sp[0] - 8, sp[1] + 10, { patrolRadius: 6, kingdom: 'stonepeak' });
  add('villager', 'talking', sp[0] + 5, sp[1] - 8, { facingAngle: 0.3, kingdom: 'stonepeak' });
  add('villager', 'talking', sp[0] + 6.5, sp[1] - 8, { facingAngle: -2.8, kingdom: 'stonepeak' });
  add('villager', 'idle', sp[0], sp[1] + 15, { kingdom: 'stonepeak' });

  // ===== DARKHOLLOW (frontier camp) at [550, -400] =====
  const dh = [550, -400];
  // Makeshift gate
  add('guard', 'patrol', dh[0], dh[1] + 25, { patrolRadius: 6, patrolSpeed: 0.6, kingdom: 'darkhollow' });
  add('guard', 'patrol', dh[0] + 18, dh[1] - 18, { patrolRadius: 8, patrolSpeed: 0.5, kingdom: 'darkhollow' });
  // Central fire gathering
  add('villager', 'talking', dh[0] - 2, dh[1] + 1, { facingAngle: 0.8, kingdom: 'darkhollow' });
  add('villager', 'talking', dh[0] + 1, dh[1] - 1.5, { facingAngle: -2.3, kingdom: 'darkhollow' });
  add('villager', 'idle', dh[0] + 3, dh[1] + 2, { kingdom: 'darkhollow' });
  // Scavenger workers
  add('worker', 'patrol', dh[0] + 8, dh[1] + 8, { patrolRadius: 5, patrolSpeed: 0.5, kingdom: 'darkhollow' });
  add('worker', 'patrol', dh[0] - 10, dh[1] - 5, { patrolRadius: 6, kingdom: 'darkhollow' });
  // Lookout tower guards
  add('guard', 'idle', dh[0] - 20, dh[1] + 18, { kingdom: 'darkhollow' });
  add('villager', 'patrol', dh[0] - 15, dh[1] + 5, { patrolRadius: 7, kingdom: 'darkhollow' });

  // ===== GOLDENVALE (trade city) at [-550, 100] =====
  const gv = [-550, 100];
  // Gate guards
  add('guard', 'idle', gv[0] - 4, gv[1] + 35, { kingdom: 'goldenvale' });
  add('guard', 'idle', gv[0] + 4, gv[1] + 35, { kingdom: 'goldenvale' });
  add('guard', 'patrol', gv[0], gv[1] + 33, { patrolRadius: 6, patrolSpeed: 0.5, kingdom: 'goldenvale' });
  // Wall patrol
  add('guard', 'patrol', gv[0] + 35, gv[1], { patrolRadius: 15, patrolSpeed: 0.4, kingdom: 'goldenvale' });
  // Market plaza — lots of merchants
  add('merchant', 'idle', gv[0] - 10, gv[1] + 8, { kingdom: 'goldenvale' });
  add('merchant', 'idle', gv[0] - 4, gv[1] + 8, { kingdom: 'goldenvale' });
  add('merchant', 'idle', gv[0] + 2, gv[1] + 8, { kingdom: 'goldenvale' });
  add('merchant', 'idle', gv[0] + 8, gv[1] + 8, { kingdom: 'goldenvale' });
  add('merchant', 'talking', gv[0] - 6, gv[1] + 12, { facingAngle: 1.5, kingdom: 'goldenvale' });
  add('villager', 'talking', gv[0] - 5, gv[1] + 13, { facingAngle: -1.5, kingdom: 'goldenvale' });
  // Residential areas
  add('villager', 'patrol', gv[0] + 20, gv[1] - 15, { patrolRadius: 8, kingdom: 'goldenvale' });
  add('villager', 'patrol', gv[0] - 20, gv[1] + 20, { patrolRadius: 6, kingdom: 'goldenvale' });
  add('villager', 'patrol', gv[0] + 15, gv[1] + 20, { patrolRadius: 7, kingdom: 'goldenvale' });
  add('villager', 'idle', gv[0] + 5, gv[1] - 10, { kingdom: 'goldenvale' });
  // Workers
  add('worker', 'patrol', gv[0] - 25, gv[1] - 10, { patrolRadius: 5, patrolSpeed: 0.5, kingdom: 'goldenvale' });

  return civs;
}

const CIVILIANS = generateCivilians();

// Group NPCs by kingdom center for distance culling
interface KingdomGroup {
  cx: number; cz: number;
  cullRadius: number;
  npcs: CivilianDef[];
}

function buildKingdomGroups(): KingdomGroup[] {
  const groups: KingdomGroup[] = [
    { cx: 0, cz: 50, cullRadius: 120, npcs: [] }, // Ironhold
    { cx: -500, cz: -450, cullRadius: 100, npcs: [] }, // Thornwall
    { cx: 450, cz: 350, cullRadius: 100, npcs: [] }, // Rivermoor
    { cx: -400, cz: 500, cullRadius: 100, npcs: [] }, // Stonepeak
    { cx: 550, cz: -400, cullRadius: 100, npcs: [] }, // Darkhollow
    { cx: -550, cz: 100, cullRadius: 100, npcs: [] }, // Goldenvale
  ];

  for (const c of CIVILIANS) {
    let bestGroup = groups[0];
    let bestDist = Infinity;
    for (const g of groups) {
      const dx = c.homePos[0] - g.cx;
      const dz = c.homePos[2] - g.cz;
      const d = dx * dx + dz * dz;
      if (d < bestDist) { bestDist = d; bestGroup = g; }
    }
    bestGroup.npcs.push(c);
  }

  return groups;
}

const KINGDOM_GROUPS = buildKingdomGroups();

// ========== SHARED GEOMETRY & MATERIALS ==========
const _boxGeo = new THREE.BoxGeometry(1, 1, 1);

const skinMat = new THREE.MeshLambertMaterial({ color: '#d4a574' });
const tunicBrown = new THREE.MeshLambertMaterial({ color: '#6a4a2a' });
const tunicGreen = new THREE.MeshLambertMaterial({ color: '#3a5a2a' });
const tunicBlue = new THREE.MeshLambertMaterial({ color: '#2a3a5a' });
const tunicRed = new THREE.MeshLambertMaterial({ color: '#6a2a2a' });
const pantsColor = new THREE.MeshLambertMaterial({ color: '#4a3a2a' });
const bootColor = new THREE.MeshLambertMaterial({ color: '#2a1a0a' });
const armorColor = new THREE.MeshLambertMaterial({ color: '#6a6a6a' });
const helmetColor = new THREE.MeshLambertMaterial({ color: '#5a5a5a' });
const spearWood = new THREE.MeshLambertMaterial({ color: '#5a3a10' });
const shieldMat = new THREE.MeshLambertMaterial({ color: '#4a3010' });
const hairBrown = new THREE.MeshLambertMaterial({ color: '#3a2a1a' });
const hairBlond = new THREE.MeshLambertMaterial({ color: '#8a7a3a' });
const hairDark = new THREE.MeshLambertMaterial({ color: '#1a1008' });

function getTunicMat(role: CivilianRole, seed: number): THREE.Material {
  if (role === 'guard') return armorColor;
  if (role === 'worker') return tunicBrown;
  const tunics = [tunicBrown, tunicGreen, tunicBlue, tunicRed];
  return tunics[seed % tunics.length];
}

function getHairMat(seed: number): THREE.Material {
  const hairs = [hairBrown, hairBlond, hairDark, hairBrown];
  return hairs[seed % hairs.length];
}

// ========== SINGLE CIVILIAN ==========
function Civilian({ def, playerPos }: { def: CivilianDef; playerPos: THREE.Vector3 | null }) {
  const groupRef = useRef<THREE.Group>(null!);
  const bodyRef = useRef<THREE.Group>(null!);
  const leftLegRef = useRef<THREE.Group>(null!);
  const rightLegRef = useRef<THREE.Group>(null!);
  const leftArmRef = useRef<THREE.Group>(null!);
  const rightArmRef = useRef<THREE.Group>(null!);
  const headRef = useRef<THREE.Group>(null!);
  const torsoRef = useRef<THREE.Group>(null!);

  const patrolAngleRef = useRef(Math.random() * Math.PI * 2);
  const timeRef = useRef(Math.random() * 100);
  const facingRef = useRef(def.facingAngle);

  const civIndex = parseInt(def.id.replace('civ-', ''));
  const tunicMat = useMemo(() => getTunicMat(def.role, civIndex), [def.role, civIndex]);
  const hairMat = useMemo(() => getHairMat(civIndex), [civIndex]);
  const isGuard = def.role === 'guard';
  const walkCycleSpeed = isGuard ? 5.5 : 7.0;
  const heightScale = useMemo(() => 0.95 + (seededRng(civIndex * 37)() * 0.1), [civIndex]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);
    timeRef.current += dt;
    const t = timeRef.current;

    // Per-NPC distance cull (secondary — primary is kingdom-level)
    if (playerPos) {
      const dx = playerPos.x - groupRef.current.position.x;
      const dz = playerPos.z - groupRef.current.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 80 * 80) {
        groupRef.current.visible = false;
        return;
      }
      groupRef.current.visible = true;
    }

    if (def.behavior === 'patrol') {
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
      const ty = getTerrainHeight(def.homePos[0], def.homePos[2]);
      groupRef.current.position.set(def.homePos[0], ty, def.homePos[2]);
    }

    if (!bodyRef.current || !leftLegRef.current || !rightLegRef.current ||
        !leftArmRef.current || !rightArmRef.current || !headRef.current || !torsoRef.current) return;

    const cycleT = t * walkCycleSpeed;

    if (def.behavior === 'patrol') {
      const legSwing = isGuard ? 0.35 : 0.5;
      const armSwing = isGuard ? 0.2 : 0.35;
      const hipSway = isGuard ? 0.01 : 0.03;
      const bodyBob = isGuard ? 0.03 : 0.06;
      const torsoTwist = isGuard ? 0.02 : 0.04;
      const shoulderRoll = isGuard ? 0.015 : 0.03;

      leftLegRef.current.rotation.x = Math.sin(cycleT) * legSwing;
      rightLegRef.current.rotation.x = Math.sin(cycleT + Math.PI) * legSwing;
      leftArmRef.current.rotation.x = Math.sin(cycleT + Math.PI) * armSwing;
      rightArmRef.current.rotation.x = Math.sin(cycleT) * armSwing;
      leftArmRef.current.rotation.z = -0.05 + Math.sin(cycleT * 0.5) * 0.02;
      rightArmRef.current.rotation.z = 0.05 + Math.sin(cycleT * 0.5 + Math.PI) * 0.02;
      bodyRef.current.position.y = Math.abs(Math.sin(cycleT)) * bodyBob;
      bodyRef.current.position.x = Math.sin(cycleT) * hipSway;
      torsoRef.current.rotation.y = Math.sin(cycleT) * torsoTwist;
      torsoRef.current.rotation.z = Math.sin(cycleT) * shoulderRoll;
      torsoRef.current.rotation.x = isGuard ? 0 : 0.03;
      headRef.current.rotation.y = -Math.sin(cycleT) * torsoTwist * 0.5;
      headRef.current.rotation.x = 0;
    } else if (def.behavior === 'idle') {
      const breathRate = 1.2;
      const breathAmt = 0.015;
      const swayRate = 0.4;
      const swayAmt = 0.008;

      torsoRef.current.rotation.x = Math.sin(t * breathRate) * breathAmt;
      bodyRef.current.position.y = Math.sin(t * breathRate) * 0.005;
      bodyRef.current.position.x = Math.sin(t * swayRate) * swayAmt;
      bodyRef.current.rotation.z = Math.sin(t * swayRate) * 0.005;
      headRef.current.rotation.y = Math.sin(t * 0.25) * 0.15;
      headRef.current.rotation.x = Math.sin(t * 0.18) * 0.03;
      leftArmRef.current.rotation.x = Math.sin(t * 0.3) * 0.02;
      rightArmRef.current.rotation.x = Math.sin(t * 0.35 + 1) * 0.02;
      leftArmRef.current.rotation.z = -0.08;
      rightArmRef.current.rotation.z = 0.08;
      leftLegRef.current.rotation.x = 0;
      rightLegRef.current.rotation.x = 0;
      groupRef.current.rotation.y = def.facingAngle + Math.sin(t * 0.15) * 0.15;

      if (isGuard) {
        bodyRef.current.position.x = 0;
        bodyRef.current.rotation.z = 0;
        headRef.current.rotation.y = Math.sin(t * 0.3) * 0.08;
        torsoRef.current.rotation.x = 0;
      }
    } else if (def.behavior === 'talking') {
      groupRef.current.rotation.y = def.facingAngle + Math.sin(t * 0.3) * 0.03;
      headRef.current.rotation.x = Math.sin(t * 2.5) * 0.06 + Math.sin(t * 1.1) * 0.03;
      headRef.current.rotation.z = Math.sin(t * 0.7) * 0.04;
      headRef.current.rotation.y = Math.sin(t * 0.8) * 0.08;
      const gesturePhase = Math.sin(t * 1.8);
      leftArmRef.current.rotation.x = -0.3 + gesturePhase * 0.15;
      leftArmRef.current.rotation.z = -0.15 + Math.sin(t * 1.2) * 0.05;
      rightArmRef.current.rotation.x = Math.sin(t * 0.4) * 0.03;
      rightArmRef.current.rotation.z = 0.08;
      bodyRef.current.position.x = Math.sin(t * 0.5) * 0.01;
      bodyRef.current.position.y = 0;
      torsoRef.current.rotation.x = Math.sin(t * 0.6) * 0.01;
      torsoRef.current.rotation.y = Math.sin(t * 0.9) * 0.02;
      leftLegRef.current.rotation.x = 0;
      rightLegRef.current.rotation.x = 0;
    }
  });

  return (
    <group ref={groupRef} position={def.homePos} rotation={[0, def.facingAngle, 0]}>
      <group ref={bodyRef} scale={[heightScale, heightScale, heightScale]}>
        <group ref={leftLegRef} position={[-0.15, 0.55, 0]}>
          <mesh position={[0, -0.15, 0]} geometry={_boxGeo} scale={[0.2, 0.3, 0.2]} material={pantsColor} castShadow />
          <mesh position={[0, -0.4, 0]} geometry={_boxGeo} scale={[0.18, 0.25, 0.18]} material={pantsColor} castShadow />
          <mesh position={[0, -0.58, 0.03]} geometry={_boxGeo} scale={[0.22, 0.12, 0.28]} material={bootColor} castShadow />
        </group>
        <group ref={rightLegRef} position={[0.15, 0.55, 0]}>
          <mesh position={[0, -0.15, 0]} geometry={_boxGeo} scale={[0.2, 0.3, 0.2]} material={pantsColor} castShadow />
          <mesh position={[0, -0.4, 0]} geometry={_boxGeo} scale={[0.18, 0.25, 0.18]} material={pantsColor} castShadow />
          <mesh position={[0, -0.58, 0.03]} geometry={_boxGeo} scale={[0.22, 0.12, 0.28]} material={bootColor} castShadow />
        </group>
        <group ref={torsoRef} position={[0, 0.7, 0]}>
          <mesh position={[0, 0, 0]} geometry={_boxGeo} scale={[0.55, 0.35, 0.3]} material={tunicMat} castShadow />
          <mesh position={[0, 0.25, 0]} geometry={_boxGeo} scale={[0.6, 0.3, 0.32]} material={tunicMat} castShadow />
          <mesh position={[0, -0.12, 0]} geometry={_boxGeo} scale={[0.58, 0.06, 0.32]} material={bootColor} castShadow />
          <group ref={leftArmRef} position={[-0.38, 0.2, 0]}>
            <mesh position={[0, -0.12, 0]} geometry={_boxGeo} scale={[0.16, 0.3, 0.16]} material={tunicMat} castShadow />
            <mesh position={[0, -0.35, 0]} geometry={_boxGeo} scale={[0.14, 0.22, 0.14]} material={tunicMat} castShadow />
            <mesh position={[0, -0.5, 0]} geometry={_boxGeo} scale={[0.1, 0.1, 0.1]} material={skinMat} />
          </group>
          <group ref={rightArmRef} position={[0.38, 0.2, 0]}>
            <mesh position={[0, -0.12, 0]} geometry={_boxGeo} scale={[0.16, 0.3, 0.16]} material={tunicMat} castShadow />
            <mesh position={[0, -0.35, 0]} geometry={_boxGeo} scale={[0.14, 0.22, 0.14]} material={tunicMat} castShadow />
            <mesh position={[0, -0.5, 0]} geometry={_boxGeo} scale={[0.1, 0.1, 0.1]} material={skinMat} />
          </group>
          <group ref={headRef} position={[0, 0.55, 0]}>
            <mesh position={[0, 0.05, 0]} geometry={_boxGeo} scale={[0.3, 0.32, 0.3]} material={skinMat} castShadow />
            <mesh position={[0, 0.07, 0.155]} geometry={_boxGeo} scale={[0.2, 0.04, 0.01]} material={bootColor} />
            {isGuard ? (
              <>
                <mesh position={[0, 0.18, 0]} geometry={_boxGeo} scale={[0.34, 0.12, 0.34]} material={helmetColor} castShadow />
                <mesh position={[0, 0.08, 0.16]} geometry={_boxGeo} scale={[0.03, 0.12, 0.03]} material={helmetColor} />
              </>
            ) : (
              <mesh position={[0, 0.16, -0.02]} geometry={_boxGeo} scale={[0.32, 0.12, 0.32]} material={hairMat} castShadow />
            )}
          </group>
          {isGuard && (
            <>
              <mesh position={[0.4, -0.1, 0]} geometry={_boxGeo} scale={[0.04, 2.0, 0.04]} material={spearWood} castShadow />
              <mesh position={[0.4, 0.95, 0]} geometry={_boxGeo} scale={[0.06, 0.12, 0.02]} material={helmetColor} castShadow />
              <mesh position={[-0.45, 0, -0.05]} geometry={_boxGeo} scale={[0.04, 0.4, 0.3]} material={shieldMat} castShadow />
            </>
          )}
        </group>
      </group>
    </group>
  );
}

// ========== GLB VILLAGER NPC DEFINITIONS ==========
function generateGLBVillagers(): VillagerMan1Def[] {
  const rng = seededRng(77777);
  const defs: VillagerMan1Def[] = [];
  let id = 0;

  const add = (x: number, z: number, opts?: Partial<VillagerMan1Def>) => {
    const y = getTerrainHeight(x, z);
    defs.push({
      id: `vm1-${id++}`,
      homePos: [x, y, z],
      patrolRadius: 4 + rng() * 5,
      patrolSpeed: 0.5 + rng() * 0.4,
      facingAngle: rng() * Math.PI * 2,
      standDuration: 30 + rng() * 40,
      walkDuration: 20 + rng() * 30,
      ...opts,
    });
  };

  // Ironhold village — scattered around central town
  add(15, 50);
  add(-12, 55);
  add(25, 60);
  add(-8, 48);
  add(5, 65);
  add(30, 55);

  // Thornwall
  add(-495, -445);
  add(-510, -440);

  // Rivermoor
  add(445, 355);
  add(455, 345);

  // Stonepeak
  add(-395, 505);

  // Darkhollow
  add(545, -395);

  // Goldenvale
  add(-545, 105);
  add(-555, 95);

  return defs;
}

const GLB_VILLAGERS = generateGLBVillagers();

// Group GLB villagers by kingdom for culling
interface GLBVillagerGroup {
  cx: number; cz: number;
  cullRadius: number;
  villagers: VillagerMan1Def[];
}

function buildGLBVillagerGroups(): GLBVillagerGroup[] {
  const groups: GLBVillagerGroup[] = [
    { cx: 0, cz: 50, cullRadius: 120, villagers: [] },
    { cx: -500, cz: -450, cullRadius: 100, villagers: [] },
    { cx: 450, cz: 350, cullRadius: 100, villagers: [] },
    { cx: -400, cz: 500, cullRadius: 100, villagers: [] },
    { cx: 550, cz: -400, cullRadius: 100, villagers: [] },
    { cx: -550, cz: 100, cullRadius: 100, villagers: [] },
  ];

  for (const v of GLB_VILLAGERS) {
    let bestGroup = groups[0];
    let bestDist = Infinity;
    for (const g of groups) {
      const dx = v.homePos[0] - g.cx;
      const dz = v.homePos[2] - g.cz;
      const d = dx * dx + dz * dz;
      if (d < bestDist) { bestDist = d; bestGroup = g; }
    }
    bestGroup.villagers.push(v);
  }

  return groups;
}

const GLB_VILLAGER_GROUPS = buildGLBVillagerGroups();

// ========== MAIN COMPONENT ==========
interface CivilianNPCsProps {
  playerPositionRef: React.RefObject<THREE.Vector3>;
}

export function CivilianNPCs({ playerPositionRef }: CivilianNPCsProps) {
  const playerPos = playerPositionRef.current;

  return (
    <group>
      {/* Procedural box NPCs */}
      {KINGDOM_GROUPS.map((group, gi) => {
        if (playerPos) {
          const dx = playerPos.x - group.cx;
          const dz = playerPos.z - group.cz;
          if (dx * dx + dz * dz > group.cullRadius * group.cullRadius) return null;
        }
        return (
          <group key={gi}>
            {group.npcs.map(c => (
              <Civilian key={c.id} def={c} playerPos={playerPos} />
            ))}
          </group>
        );
      })}

      {/* GLB-based VillagerMan1 NPCs */}
      <Suspense fallback={null}>
        {GLB_VILLAGER_GROUPS.map((group, gi) => {
          if (playerPos) {
            const dx = playerPos.x - group.cx;
            const dz = playerPos.z - group.cz;
            if (dx * dx + dz * dz > group.cullRadius * group.cullRadius) return null;
          }
          return (
            <group key={`vm1-group-${gi}`}>
              {group.villagers.map(v => (
                <VillagerMan1Model key={v.id} def={v} playerPos={playerPos} />
              ))}
            </group>
          );
        })}
      </Suspense>
    </group>
  );
}
