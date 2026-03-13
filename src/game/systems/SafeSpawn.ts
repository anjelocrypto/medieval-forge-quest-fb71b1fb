/**
 * SafeSpawn — Canonical spawn system with collision validation.
 *
 * Guarantees every player spawns on walkable ground outside all buildings,
 * walls, props, and obstacles. Used for:
 *   - first spawn
 *   - respawn after death
 *   - reconnect fallback (if restored position is invalid)
 *   - multiplayer default position
 */

import { getTerrainHeight } from '../components/Terrain';
import { getBridgeHeight } from '../world/BridgeData';
import { getLakeHeight, getRiverHeight } from '../world/WaterData';
import {
  getCircleObstacles,
  getBoxObstacles,
} from './CollisionSystem';

// ===== Canonical spawn point =====
// South of the Town District, on the road approach to Ironhold.
// Town buildings extend to about z≈72; z=82 is clear open ground.
const CANONICAL_SPAWN_X = 0;
const CANONICAL_SPAWN_Z = 82;

// Player collision radius for spawn validation
const SPAWN_CHECK_RADIUS = 1.2; // slightly larger than player radius for safety margin

// Spiral search parameters
const SPIRAL_STEP = 2.5;    // meters between test points
const SPIRAL_MAX_RINGS = 12; // max search distance = 12 * 2.5 = 30m

// ===== Multiplayer spawn separation =====
// Ring-based offsets so multiple players don't overlap
const SPAWN_SEPARATION_RADIUS = 3.0; // meters between ring positions
const SPAWN_RING_SLOTS = 8;          // 8 slots per ring (45° apart)
let spawnIndexCounter = 0; // increments per spawn call in this session

// ===== Core validation =====

/** Check if a point collides with any registered obstacle. */
function isPointBlocked(x: number, z: number, radius: number): boolean {
  const circles = getCircleObstacles();
  const boxes = getBoxObstacles();

  for (const obs of circles) {
    const dx = x - obs.x;
    const dz = z - obs.z;
    const minDist = radius + obs.radius;
    if (dx * dx + dz * dz < minDist * minDist) return true;
  }

  for (const obs of boxes) {
    const cos = Math.cos(obs.rotation);
    const sin = Math.sin(obs.rotation);
    const lx = cos * (x - obs.cx) + sin * (z - obs.cz);
    const lz = -sin * (x - obs.cx) + cos * (z - obs.cz);
    const clampX = Math.max(-obs.halfW, Math.min(obs.halfW, lx));
    const clampZ = Math.max(-obs.halfD, Math.min(obs.halfD, lz));
    const dlx = lx - clampX;
    const dlz = lz - clampZ;
    if (dlx * dlx + dlz * dlz < radius * radius) return true;
  }

  return false;
}

/** Check if terrain at (x,z) is valid walkable ground (not underwater, not in water body). */
function isTerrainValid(x: number, z: number): boolean {
  const y = getTerrainHeight(x, z);
  // Reject if below water level
  if (y < -0.5) return false;
  // Reject if inside a lake
  if (getLakeHeight(x, z) !== null) return false;
  // Reject if inside a river
  if (getRiverHeight(x, z) !== null) return false;
  // Bridge is valid even over water
  const bridgeY = getBridgeHeight(x, z);
  if (bridgeY !== null) return true;
  return true;
}

/** Full spawn validation: terrain + collision. */
function isSpawnValid(x: number, z: number): boolean {
  if (!isTerrainValid(x, z)) return false;
  if (isPointBlocked(x, z, SPAWN_CHECK_RADIUS)) return false;
  return true;
}

// ===== Spiral search =====

/**
 * Starting from (cx, cz), search outward in a spiral for the nearest
 * valid spawn point. Returns [x, z] or null if nothing found.
 */
function spiralSearch(cx: number, cz: number): [number, number] | null {
  // Ring 0: test center
  if (isSpawnValid(cx, cz)) return [cx, cz];

  // Expanding rings
  for (let ring = 1; ring <= SPIRAL_MAX_RINGS; ring++) {
    const dist = ring * SPIRAL_STEP;
    // Test 8 * ring points evenly around the ring
    const pointCount = 8 * ring;
    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2;
      const tx = cx + Math.cos(angle) * dist;
      const tz = cz + Math.sin(angle) * dist;
      if (isSpawnValid(tx, tz)) return [tx, tz];
    }
  }

  return null;
}

// ===== Public API =====

export interface SafeSpawnResult {
  x: number;
  y: number;
  z: number;
  fallbackUsed: boolean;
  rejectedReason: string | null;
}

/**
 * Find a safe spawn position. Uses canonical spawn by default.
 * If preferredX/Z are provided (e.g. reconnect restore), validates them first.
 * Applies ring-based separation so multiple players don't overlap.
 */
export function findSafeSpawn(
  preferredX?: number,
  preferredZ?: number,
  playerHeight: number = 1.8,
): SafeSpawnResult {
  // 1. Try preferred position (reconnect restore)
  if (preferredX !== undefined && preferredZ !== undefined) {
    if (isSpawnValid(preferredX, preferredZ)) {
      const y = getGroundY(preferredX, preferredZ);
      console.log(`[SpawnAudit] preferred spawn ACCEPTED: ${preferredX.toFixed(1)}, ${preferredZ.toFixed(1)}, y=${y.toFixed(2)}`);
      return { x: preferredX, y: y + playerHeight / 2, z: preferredZ, fallbackUsed: false, rejectedReason: null };
    }
    const reason = getRejectReason(preferredX, preferredZ);
    console.warn(`[SpawnAudit] preferred spawn REJECTED at ${preferredX.toFixed(1)}, ${preferredZ.toFixed(1)} — ${reason}`);

    // Try spiral from preferred position
    const nearby = spiralSearch(preferredX, preferredZ);
    if (nearby) {
      const y = getGroundY(nearby[0], nearby[1]);
      console.log(`[SpawnAudit] fallback found near preferred: ${nearby[0].toFixed(1)}, ${nearby[1].toFixed(1)}, y=${y.toFixed(2)}`);
      return { x: nearby[0], y: y + playerHeight / 2, z: nearby[1], fallbackUsed: true, rejectedReason: reason };
    }
  }

  // 2. Try canonical spawn with ring-based separation for multiplayer
  const spawnIdx = spawnIndexCounter++;
  const separated = getSeperatedSpawnPoint(CANONICAL_SPAWN_X, CANONICAL_SPAWN_Z, spawnIdx);

  if (separated) {
    const y = getGroundY(separated[0], separated[1]);
    console.log(`[SpawnAudit] canonical spawn OK (slot ${spawnIdx}): ${separated[0].toFixed(1)}, ${separated[1].toFixed(1)}, y=${y.toFixed(2)}, circles=${getCircleObstacles().length}, boxes=${getBoxObstacles().length}`);
    return { x: separated[0], y: y + playerHeight / 2, z: separated[1], fallbackUsed: spawnIdx > 0, rejectedReason: null };
  }

  // 3. Spiral from canonical (ignoring separation)
  console.warn(`[SpawnAudit] canonical spawn zone BLOCKED, searching nearby...`);
  const found = spiralSearch(CANONICAL_SPAWN_X, CANONICAL_SPAWN_Z);
  if (found) {
    const y = getGroundY(found[0], found[1]);
    console.log(`[SpawnAudit] fallback from canonical: ${found[0].toFixed(1)}, ${found[1].toFixed(1)}, y=${y.toFixed(2)}`);
    return { x: found[0], y: y + playerHeight / 2, z: found[1], fallbackUsed: true, rejectedReason: 'canonical zone blocked' };
  }

  // 4. Absolute last resort — open field far from settlements
  console.error(`[SpawnAudit] ALL SPAWN SEARCHES FAILED — using emergency fallback`);
  const emergencyX = 0;
  const emergencyZ = 120;
  const y = getGroundY(emergencyX, emergencyZ);
  return { x: emergencyX, y: y + playerHeight / 2, z: emergencyZ, fallbackUsed: true, rejectedReason: 'all searches failed' };
}

// ===== Ring-based spawn separation =====

/**
 * For spawn index 0, try the center. For index 1+, place on expanding rings
 * around the center so players don't stack.
 */
function getSeperatedSpawnPoint(cx: number, cz: number, index: number): [number, number] | null {
  if (index === 0) {
    // First player gets center
    if (isSpawnValid(cx, cz)) return [cx, cz];
    // Center blocked, try spiral
    return spiralSearch(cx, cz);
  }

  // Ring placement: ring 1 has SPAWN_RING_SLOTS positions, ring 2 has SPAWN_RING_SLOTS, etc.
  const ring = Math.ceil(index / SPAWN_RING_SLOTS);
  const slotInRing = (index - 1) % SPAWN_RING_SLOTS;
  const dist = ring * SPAWN_SEPARATION_RADIUS;
  // Offset angle slightly per ring so rings don't align
  const angleOffset = ring * 0.4;
  const angle = angleOffset + (slotInRing / SPAWN_RING_SLOTS) * Math.PI * 2;
  const tx = cx + Math.cos(angle) * dist;
  const tz = cz + Math.sin(angle) * dist;

  if (isSpawnValid(tx, tz)) return [tx, tz];

  // Ring slot blocked — spiral from that offset point
  return spiralSearch(tx, tz);
}

// ===== Rejection diagnostics =====

function getRejectReason(x: number, z: number): string {
  const y = getTerrainHeight(x, z);
  if (y < -0.5) return 'terrain below water level';
  if (getLakeHeight(x, z) !== null) return 'inside lake';
  if (getRiverHeight(x, z) !== null) return 'inside river';
  if (isPointBlocked(x, z, SPAWN_CHECK_RADIUS)) return 'collision with obstacle';
  return 'unknown';
}

/** Get ground Y at position, considering bridges. */
function getGroundY(x: number, z: number): number {
  const bridgeY = getBridgeHeight(x, z);
  if (bridgeY !== null) return bridgeY;
  return getTerrainHeight(x, z);
}

/** Validate an existing position (for reconnect). Returns true if player can stay there. */
export function isPositionSafe(x: number, z: number): boolean {
  return isSpawnValid(x, z);
}

/** Get the canonical spawn coordinates (for debug overlay, etc.) */
export function getCanonicalSpawn(): [number, number] {
  return [CANONICAL_SPAWN_X, CANONICAL_SPAWN_Z];
}

/** Reset spawn index (call when entering a new session). */
export function resetSpawnIndex(): void {
  spawnIndexCounter = 0;
}
