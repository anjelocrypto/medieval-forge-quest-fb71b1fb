/**
 * CivilianNPCs — Non-hostile townspeople with full procedural animation.
 * Scale-matched to player (~1.8m). Articulated limbs, distinct guard/villager gaits.
 * Performance: distance-culled, shared geometry/materials, lightweight state machine.
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTerrainHeight } from './Terrain';

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

  return civs;
}

const CIVILIANS = generateCivilians();

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
  const timeRef = useRef(Math.random() * 100); // offset so NPCs aren't synced
  const facingRef = useRef(def.facingAngle);

  const civIndex = parseInt(def.id.replace('civ-', ''));
  const tunicMat = useMemo(() => getTunicMat(def.role, civIndex), [def.role, civIndex]);
  const hairMat = useMemo(() => getHairMat(civIndex), [civIndex]);
  const isGuard = def.role === 'guard';
  const walkCycleSpeed = isGuard ? 5.5 : 7.0; // guards walk steadier
  // Height variation: 0.95 to 1.05 of base
  const heightScale = useMemo(() => 0.95 + (seededRng(civIndex * 37)() * 0.1), [civIndex]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);
    timeRef.current += dt;
    const t = timeRef.current;

    // Distance cull
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

    let moveSpeed = 0; // 0-1 blend for animation

    if (def.behavior === 'patrol') {
      patrolAngleRef.current += dt * def.patrolSpeed * 0.3;
      const pa = patrolAngleRef.current;
      const tx = def.homePos[0] + Math.cos(pa) * def.patrolRadius;
      const tz = def.homePos[2] + Math.sin(pa) * def.patrolRadius;
      const ty = getTerrainHeight(tx, tz);
      groupRef.current.position.set(tx, ty, tz);

      // Smooth facing toward movement direction
      const targetAngle = pa + Math.PI / 2;
      facingRef.current += (((targetAngle - facingRef.current + Math.PI) % (Math.PI * 2)) - Math.PI) * dt * 4;
      groupRef.current.rotation.y = facingRef.current;
      moveSpeed = 1;
    } else {
      // Stay at home position, update terrain height
      const ty = getTerrainHeight(def.homePos[0], def.homePos[2]);
      groupRef.current.position.set(def.homePos[0], ty, def.homePos[2]);
    }

    if (!bodyRef.current || !leftLegRef.current || !rightLegRef.current ||
        !leftArmRef.current || !rightArmRef.current || !headRef.current || !torsoRef.current) return;

    const cycleT = t * walkCycleSpeed;

    if (def.behavior === 'patrol') {
      // ===== WALKING ANIMATION =====
      const legSwing = isGuard ? 0.35 : 0.5; // guards: tighter stride
      const armSwing = isGuard ? 0.2 : 0.35;  // guards: less arm movement
      const hipSway = isGuard ? 0.01 : 0.03;
      const bodyBob = isGuard ? 0.03 : 0.06;
      const torsoTwist = isGuard ? 0.02 : 0.04;
      const shoulderRoll = isGuard ? 0.015 : 0.03;

      // Leg gait — alternating sinusoidal
      leftLegRef.current.rotation.x = Math.sin(cycleT) * legSwing;
      rightLegRef.current.rotation.x = Math.sin(cycleT + Math.PI) * legSwing;

      // Arm counter-swing
      leftArmRef.current.rotation.x = Math.sin(cycleT + Math.PI) * armSwing;
      rightArmRef.current.rotation.x = Math.sin(cycleT) * armSwing;
      // Slight arm outward sway
      leftArmRef.current.rotation.z = -0.05 + Math.sin(cycleT * 0.5) * 0.02;
      rightArmRef.current.rotation.z = 0.05 + Math.sin(cycleT * 0.5 + Math.PI) * 0.02;

      // Body bob synced to step frequency (2x leg freq)
      bodyRef.current.position.y = Math.abs(Math.sin(cycleT)) * bodyBob;

      // Hip sway
      bodyRef.current.position.x = Math.sin(cycleT) * hipSway;

      // Torso twist — counter to legs
      torsoRef.current.rotation.y = Math.sin(cycleT) * torsoTwist;
      // Shoulder roll
      torsoRef.current.rotation.z = Math.sin(cycleT) * shoulderRoll;

      // Forward lean
      torsoRef.current.rotation.x = isGuard ? 0 : 0.03;

      // Head stability — counter-rotates slightly against torso
      headRef.current.rotation.y = -Math.sin(cycleT) * torsoTwist * 0.5;
      headRef.current.rotation.x = 0;

    } else if (def.behavior === 'idle') {
      // ===== IDLE ANIMATION =====
      const breathRate = 1.2;
      const breathAmt = 0.015;
      const swayRate = 0.4;
      const swayAmt = 0.008;

      // Breathing — subtle torso scale/position
      torsoRef.current.rotation.x = Math.sin(t * breathRate) * breathAmt;
      bodyRef.current.position.y = Math.sin(t * breathRate) * 0.005;

      // Weight shift — slow lateral sway
      bodyRef.current.position.x = Math.sin(t * swayRate) * swayAmt;
      bodyRef.current.rotation.z = Math.sin(t * swayRate) * 0.005;

      // Head turns — slow look around
      headRef.current.rotation.y = Math.sin(t * 0.25) * 0.15;
      headRef.current.rotation.x = Math.sin(t * 0.18) * 0.03;

      // Arms relaxed at sides with slight sway
      leftArmRef.current.rotation.x = Math.sin(t * 0.3) * 0.02;
      rightArmRef.current.rotation.x = Math.sin(t * 0.35 + 1) * 0.02;
      leftArmRef.current.rotation.z = -0.08;
      rightArmRef.current.rotation.z = 0.08;

      // Legs straight
      leftLegRef.current.rotation.x = 0;
      rightLegRef.current.rotation.x = 0;

      // Slow body rotation — looking around
      groupRef.current.rotation.y = def.facingAngle + Math.sin(t * 0.15) * 0.15;

      // Guard: more upright, less sway
      if (isGuard) {
        bodyRef.current.position.x = 0;
        bodyRef.current.rotation.z = 0;
        headRef.current.rotation.y = Math.sin(t * 0.3) * 0.08;
        torsoRef.current.rotation.x = 0;
      }

    } else if (def.behavior === 'talking') {
      // ===== TALKING ANIMATION =====
      // Face partner direction
      groupRef.current.rotation.y = def.facingAngle + Math.sin(t * 0.3) * 0.03;

      // Head nods — conversational rhythm
      headRef.current.rotation.x = Math.sin(t * 2.5) * 0.06 + Math.sin(t * 1.1) * 0.03;
      // Head tilts
      headRef.current.rotation.z = Math.sin(t * 0.7) * 0.04;
      headRef.current.rotation.y = Math.sin(t * 0.8) * 0.08;

      // Gesture — one arm moves more (talking hand)
      const gesturePhase = Math.sin(t * 1.8);
      leftArmRef.current.rotation.x = -0.3 + gesturePhase * 0.15;
      leftArmRef.current.rotation.z = -0.15 + Math.sin(t * 1.2) * 0.05;
      // Other arm relaxed
      rightArmRef.current.rotation.x = Math.sin(t * 0.4) * 0.03;
      rightArmRef.current.rotation.z = 0.08;

      // Subtle weight shift
      bodyRef.current.position.x = Math.sin(t * 0.5) * 0.01;
      bodyRef.current.position.y = 0;
      torsoRef.current.rotation.x = Math.sin(t * 0.6) * 0.01;
      torsoRef.current.rotation.y = Math.sin(t * 0.9) * 0.02;

      // Legs still
      leftLegRef.current.rotation.x = 0;
      rightLegRef.current.rotation.x = 0;
    }
  });

  // Body dimensions matched to player:
  // Player total: ~1.8m. Boots ~0.1, legs ~0.55, torso ~0.65, head ~0.4, hair ~0.1
  return (
    <group ref={groupRef} position={def.homePos} rotation={[0, def.facingAngle, 0]}>
      <group ref={bodyRef} scale={[heightScale, heightScale, heightScale]}>
        {/* LEFT LEG — pivot at hip */}
        <group ref={leftLegRef} position={[-0.15, 0.55, 0]}>
          {/* Upper leg */}
          <mesh position={[0, -0.15, 0]} geometry={_boxGeo}
            scale={[0.2, 0.3, 0.2]} material={pantsColor} castShadow />
          {/* Lower leg */}
          <mesh position={[0, -0.4, 0]} geometry={_boxGeo}
            scale={[0.18, 0.25, 0.18]} material={pantsColor} castShadow />
          {/* Boot */}
          <mesh position={[0, -0.58, 0.03]} geometry={_boxGeo}
            scale={[0.22, 0.12, 0.28]} material={bootColor} castShadow />
        </group>

        {/* RIGHT LEG — pivot at hip */}
        <group ref={rightLegRef} position={[0.15, 0.55, 0]}>
          <mesh position={[0, -0.15, 0]} geometry={_boxGeo}
            scale={[0.2, 0.3, 0.2]} material={pantsColor} castShadow />
          <mesh position={[0, -0.4, 0]} geometry={_boxGeo}
            scale={[0.18, 0.25, 0.18]} material={pantsColor} castShadow />
          <mesh position={[0, -0.58, 0.03]} geometry={_boxGeo}
            scale={[0.22, 0.12, 0.28]} material={bootColor} castShadow />
        </group>

        {/* TORSO GROUP — pivot at waist */}
        <group ref={torsoRef} position={[0, 0.7, 0]}>
          {/* Lower torso */}
          <mesh position={[0, 0, 0]} geometry={_boxGeo}
            scale={[0.55, 0.35, 0.3]} material={tunicMat} castShadow />
          {/* Upper torso */}
          <mesh position={[0, 0.25, 0]} geometry={_boxGeo}
            scale={[0.6, 0.3, 0.32]} material={tunicMat} castShadow />
          {/* Belt */}
          <mesh position={[0, -0.12, 0]} geometry={_boxGeo}
            scale={[0.58, 0.06, 0.32]} material={bootColor} castShadow />

          {/* LEFT ARM — pivot at shoulder */}
          <group ref={leftArmRef} position={[-0.38, 0.2, 0]}>
            {/* Upper arm */}
            <mesh position={[0, -0.12, 0]} geometry={_boxGeo}
              scale={[0.16, 0.3, 0.16]} material={tunicMat} castShadow />
            {/* Forearm */}
            <mesh position={[0, -0.35, 0]} geometry={_boxGeo}
              scale={[0.14, 0.22, 0.14]} material={tunicMat} castShadow />
            {/* Hand */}
            <mesh position={[0, -0.5, 0]} geometry={_boxGeo}
              scale={[0.1, 0.1, 0.1]} material={skinMat} />
          </group>

          {/* RIGHT ARM — pivot at shoulder */}
          <group ref={rightArmRef} position={[0.38, 0.2, 0]}>
            <mesh position={[0, -0.12, 0]} geometry={_boxGeo}
              scale={[0.16, 0.3, 0.16]} material={tunicMat} castShadow />
            <mesh position={[0, -0.35, 0]} geometry={_boxGeo}
              scale={[0.14, 0.22, 0.14]} material={tunicMat} castShadow />
            <mesh position={[0, -0.5, 0]} geometry={_boxGeo}
              scale={[0.1, 0.1, 0.1]} material={skinMat} />
          </group>

          {/* HEAD — pivot at neck */}
          <group ref={headRef} position={[0, 0.55, 0]}>
            {/* Head */}
            <mesh position={[0, 0.05, 0]} geometry={_boxGeo}
              scale={[0.3, 0.32, 0.3]} material={skinMat} castShadow />
            {/* Eyes strip */}
            <mesh position={[0, 0.07, 0.155]} geometry={_boxGeo}
              scale={[0.2, 0.04, 0.01]} material={bootColor} />
            {/* Hair or helmet */}
            {isGuard ? (
              <>
                <mesh position={[0, 0.18, 0]} geometry={_boxGeo}
                  scale={[0.34, 0.12, 0.34]} material={helmetColor} castShadow />
                {/* Nose guard */}
                <mesh position={[0, 0.08, 0.16]} geometry={_boxGeo}
                  scale={[0.03, 0.12, 0.03]} material={helmetColor} />
              </>
            ) : (
              <mesh position={[0, 0.16, -0.02]} geometry={_boxGeo}
                scale={[0.32, 0.12, 0.32]} material={hairMat} castShadow />
            )}
          </group>

          {/* Guard equipment */}
          {isGuard && (
            <>
              {/* Spear in right hand */}
              <mesh position={[0.4, -0.1, 0]} geometry={_boxGeo}
                scale={[0.04, 2.0, 0.04]} material={spearWood} castShadow />
              {/* Spear tip */}
              <mesh position={[0.4, 0.95, 0]} geometry={_boxGeo}
                scale={[0.06, 0.12, 0.02]} material={helmetColor} castShadow />
              {/* Shield on left arm */}
              <mesh position={[-0.45, 0, -0.05]} geometry={_boxGeo}
                scale={[0.04, 0.4, 0.3]} material={shieldMat} castShadow />
            </>
          )}
        </group>
      </group>
    </group>
  );
}

// ========== MAIN COMPONENT ==========
interface CivilianNPCsProps {
  playerPositionRef: React.RefObject<THREE.Vector3>;
}

export function CivilianNPCs({ playerPositionRef }: CivilianNPCsProps) {
  const playerPos = playerPositionRef.current;

  // Early out if player is far from entire town
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
