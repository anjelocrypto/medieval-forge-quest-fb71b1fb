/**
 * CollisionSystem — Simple circle/cylinder-based obstacle registry with push-out resolution.
 * Obstacles are registered as circles on the XZ plane with a radius.
 * Player (and mounted player) are resolved as a moving circle pushed out of overlaps.
 */

import * as THREE from 'three';
import { WorldResource } from './WorldResources';
import { PlacedStructure, BUILDABLES } from './BuildingData';
import { HorseData } from './HorseData';
import { SETTLEMENTS } from '../world/RegionData';
import { getTerrainHeight } from '../components/Terrain';

export interface CircleObstacle {
  x: number;
  z: number;
  radius: number;
  id: string;
}

export interface BoxObstacle {
  cx: number;
  cz: number;
  halfW: number; // half-width (X)
  halfD: number; // half-depth (Z)
  rotation: number; // Y rotation
  id: string;
}

// Single global obstacle list, rebuilt when world changes
let circleObstacles: CircleObstacle[] = [];
let boxObstacles: BoxObstacle[] = [];

const _cos = Math.cos;
const _sin = Math.sin;

/**
 * Rebuild the obstacle list from current world state.
 * Call whenever resources, structures, or horses change.
 */
export function rebuildObstacles(
  resources: WorldResource[],
  structures: PlacedStructure[],
  horses: HorseData[],
  excludeHorseId: string | null, // don't collide with mounted horse
) {
  circleObstacles = [];
  boxObstacles = [];

  // Trees — trunk collision (cylinder ~0.3-0.5 radius depending on scale)
  for (const r of resources) {
    if (r.depleted) continue;
    if (r.type === 'tree') {
      circleObstacles.push({
        x: r.position[0],
        z: r.position[2],
        radius: 0.25 * r.scale + 0.2,
        id: r.id,
      });
    } else if (r.type === 'rock') {
      circleObstacles.push({
        x: r.position[0],
        z: r.position[2],
        radius: r.scale * 0.5 + 0.15,
        id: r.id,
      });
    }
    // berry bushes and crates are small — skip collision
  }

  // Placed structures
  for (const s of structures) {
    const config = BUILDABLES.find(b => b.type === s.type);
    if (!config) continue;
    const [w, , d] = config.size;
    // Use box for walls/fences/gates, circle for others
    if (s.type === 'wall' || s.type === 'fence' || s.type === 'gate') {
      boxObstacles.push({
        cx: s.position[0],
        cz: s.position[2],
        halfW: w / 2 + 0.1,
        halfD: Math.max(d / 2, 0.3),
        rotation: s.rotation,
        id: s.id,
      });
    } else if (s.type === 'campfire') {
      // Small ring — don't block heavily
      circleObstacles.push({
        x: s.position[0], z: s.position[2],
        radius: 0.5, id: s.id,
      });
    } else {
      // shelter, watchtower, storage, workbench, bedroll — circle
      const rad = Math.max(w, d) / 2;
      circleObstacles.push({
        x: s.position[0], z: s.position[2],
        radius: rad, id: s.id,
      });
    }
  }

  // Horse (unmounted is solid)
  for (const h of horses) {
    if (h.id === excludeHorseId) continue;
    if (h.state === 'mounted') continue;
    circleObstacles.push({
      x: h.position[0], z: h.position[2],
      radius: 0.8, id: h.id,
    });
  }

  // Settlement static structures
  addSettlementObstacles();
}

/**
 * Add collision obstacles for all settlements based on RegionData.
 * Matches the geometry in Settlements.tsx.
 */
function addSettlementObstacles() {
  for (const s of SETTLEMENTS) {
    const [sx, sz] = s.position;

    switch (s.type) {
      case 'capital': {
        // Central keep — large cylinder
        circleObstacles.push({ x: sx, z: sz, radius: 7, id: `${s.id}-keep` });

        // Square walls with gate gap on south (+Z) side
        // North wall
        boxObstacles.push({ cx: sx, cz: sz - 35, halfW: 35, halfD: 1.25, rotation: 0, id: `${s.id}-wall-n` });
        // East wall
        boxObstacles.push({ cx: sx + 35, cz: sz, halfW: 1.25, halfD: 35, rotation: 0, id: `${s.id}-wall-e` });
        // West wall
        boxObstacles.push({ cx: sx - 35, cz: sz, halfW: 1.25, halfD: 35, rotation: 0, id: `${s.id}-wall-w` });
        // South wall — split for gate (4-unit gap at center)
        boxObstacles.push({ cx: sx - 20, cz: sz + 35, halfW: 15, halfD: 1.25, rotation: 0, id: `${s.id}-wall-s-l` });
        boxObstacles.push({ cx: sx + 20, cz: sz + 35, halfW: 15, halfD: 1.25, rotation: 0, id: `${s.id}-wall-s-r` });

        // Corner towers
        for (const [tx, tz] of [[-35, -35], [35, -35], [35, 35], [-35, 35]]) {
          circleObstacles.push({ x: sx + tx, z: sz + tz, radius: 3, id: `${s.id}-tower-${tx}-${tz}` });
        }
        // Gate towers
        circleObstacles.push({ x: sx - 5, z: sz + 35.5, radius: 2.2, id: `${s.id}-gate-l` });
        circleObstacles.push({ x: sx + 5, z: sz + 35.5, radius: 2.2, id: `${s.id}-gate-r` });
        // Well
        circleObstacles.push({ x: sx, z: sz + 14, radius: 1, id: `${s.id}-well` });
        // Stables
        circleObstacles.push({ x: sx + 25, z: sz + 10, radius: 4, id: `${s.id}-stable` });
        break;
      }

      case 'village': {
        // Houses scattered in ring — approximate with circles
        const isSmall = s.size === 'small';
        const houseCount = isSmall ? 4 : 8;
        const houseRadius = isSmall ? 8 : 15;
        for (let i = 0; i < houseCount; i++) {
          const a = (i / houseCount) * Math.PI * 2;
          const r = houseRadius * 0.7 + (i % 3) * 2;
          circleObstacles.push({
            x: sx + Math.cos(a) * r,
            z: sz + Math.sin(a) * r,
            radius: 2.5, id: `${s.id}-house-${i}`,
          });
        }
        // Well at center
        circleObstacles.push({ x: sx, z: sz, radius: 1, id: `${s.id}-well` });
        // Barn (large village only)
        if (!isSmall) {
          circleObstacles.push({ x: sx + 12, z: sz + 8, radius: 4.5, id: `${s.id}-barn` });
        }
        break;
      }

      case 'fort': {
        // Palisade circle — approximate with 8 wall segments
        const palisadeR = 22;
        const segments = 8;
        for (let i = 0; i < segments; i++) {
          const a1 = (i / segments) * Math.PI * 2;
          const a2 = ((i + 1) / segments) * Math.PI * 2;
          // Skip gate segment (facing +X, around PI/2)
          const midA = (a1 + a2) / 2;
          if (Math.abs(midA - Math.PI / 2) < 0.5) continue;
          const x1 = sx + Math.cos(a1) * palisadeR;
          const z1 = sz + Math.sin(a1) * palisadeR;
          const x2 = sx + Math.cos(a2) * palisadeR;
          const z2 = sz + Math.sin(a2) * palisadeR;
          const cx = (x1 + x2) / 2;
          const cz2 = (z1 + z2) / 2;
          const len = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
          const angle = Math.atan2(x2 - x1, z2 - z1);
          boxObstacles.push({
            cx, cz: cz2, halfW: 0.4, halfD: len / 2,
            rotation: angle, id: `${s.id}-palisade-${i}`,
          });
        }
        // Main building
        circleObstacles.push({ x: sx, z: sz, radius: 4.5, id: `${s.id}-main` });
        // Barracks
        circleObstacles.push({ x: sx - 10, z: sz + 5, radius: 3.5, id: `${s.id}-barracks-1` });
        circleObstacles.push({ x: sx + 10, z: sz - 5, radius: 3, id: `${s.id}-barracks-2` });
        // Watchtowers
        for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
          circleObstacles.push({
            x: sx + Math.cos(a) * palisadeR,
            z: sz + Math.sin(a) * palisadeR,
            radius: 1.8, id: `${s.id}-tower-${a.toFixed(1)}`,
          });
        }
        // Beacon tower
        circleObstacles.push({ x: sx, z: sz - 18, radius: 2.5, id: `${s.id}-beacon` });
        break;
      }

      case 'ruins': {
        // Central altar platform
        circleObstacles.push({ x: sx, z: sz, radius: 4.5, id: `${s.id}-altar` });
        // Grand arch pillars
        circleObstacles.push({ x: sx - 5, z: sz, radius: 1.2, id: `${s.id}-arch-l` });
        circleObstacles.push({ x: sx + 5, z: sz, radius: 1.2, id: `${s.id}-arch-r` });
        // Pillar ring
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          circleObstacles.push({
            x: sx + Math.cos(a) * 8,
            z: sz + Math.sin(a) * 8,
            radius: 0.7, id: `${s.id}-pillar-${i}`,
          });
        }
        // Fallen column
        boxObstacles.push({
          cx: sx + 8, cz: sz - 6, halfW: 0.35, halfD: 3, rotation: 0.5, id: `${s.id}-fallen`,
        });
        break;
      }

      case 'bandit_camp': {
        // Palisade ring — crude, 20 segments
        const campR = 16;
        const campSegs = 6;
        for (let i = 0; i < campSegs; i++) {
          const a1 = (i / campSegs) * Math.PI * 2;
          const a2 = ((i + 1) / campSegs) * Math.PI * 2;
          // Gate at angle 0
          if (Math.abs(a1) < 0.6 || Math.abs(a1 - Math.PI * 2) < 0.6) continue;
          const x1 = sx + Math.cos(a1) * campR;
          const z1 = sz + Math.sin(a1) * campR;
          const x2 = sx + Math.cos(a2) * campR;
          const z2 = sz + Math.sin(a2) * campR;
          const cx = (x1 + x2) / 2;
          const cz2 = (z1 + z2) / 2;
          const len = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
          const angle = Math.atan2(x2 - x1, z2 - z1);
          boxObstacles.push({
            cx, cz: cz2, halfW: 0.3, halfD: len / 2,
            rotation: angle, id: `${s.id}-palisade-${i}`,
          });
        }
        // Tents
        circleObstacles.push({ x: sx - 5, z: sz + 6, radius: 1.8, id: `${s.id}-tent-1` });
        circleObstacles.push({ x: sx + 6, z: sz - 4, radius: 1.5, id: `${s.id}-tent-2` });
        // Lookout posts
        circleObstacles.push({ x: sx - 12, z: sz + 8, radius: 1, id: `${s.id}-lookout-1` });
        circleObstacles.push({ x: sx + 10, z: sz - 10, radius: 1, id: `${s.id}-lookout-2` });
        // Cage
        circleObstacles.push({ x: sx + 6, z: sz + 6, radius: 1, id: `${s.id}-cage` });
        break;
      }

      case 'outpost': {
        // Two small buildings
        circleObstacles.push({ x: sx, z: sz, radius: 3, id: `${s.id}-main` });
        circleObstacles.push({ x: sx - 8, z: sz + 3, radius: 2.5, id: `${s.id}-side` });
        // Shrine stone
        circleObstacles.push({ x: sx + 5, z: sz, radius: 1, id: `${s.id}-shrine` });
        break;
      }

      case 'monastery': {
        // Main hall
        circleObstacles.push({ x: sx, z: sz, radius: 6, id: `${s.id}-hall` });
        // Spire
        circleObstacles.push({ x: sx, z: sz - 4, radius: 1.5, id: `${s.id}-spire` });
        // Side building
        circleObstacles.push({ x: sx - 8, z: sz + 4, radius: 3, id: `${s.id}-side` });
        // Walls (3 sides, open south)
        boxObstacles.push({ cx: sx, cz: sz - 10, halfW: 12, halfD: 0.75, rotation: 0, id: `${s.id}-wall-n` });
        boxObstacles.push({ cx: sx - 12, cz: sz, halfW: 0.75, halfD: 10, rotation: 0, id: `${s.id}-wall-w` });
        boxObstacles.push({ cx: sx + 12, cz: sz, halfW: 0.75, halfD: 10, rotation: 0, id: `${s.id}-wall-e` });
        break;
      }
    }
  }
}

/**
 * Resolve player position against all obstacles.
 * Uses circle-circle and circle-OBB push-out.
 * Returns the corrected position.
 */
export function resolveCollision(
  px: number, pz: number, playerRadius: number
): { x: number; z: number } {
  let x = px;
  let z = pz;

  // Circle obstacles — push out
  for (const obs of circleObstacles) {
    const dx = x - obs.x;
    const dz = z - obs.z;
    const distSq = dx * dx + dz * dz;
    const minDist = playerRadius + obs.radius;
    if (distSq < minDist * minDist && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const overlap = minDist - dist;
      const nx = dx / dist;
      const nz = dz / dist;
      x += nx * overlap;
      z += nz * overlap;
    }
  }

  // Box (OBB) obstacles — transform to local space, clamp, push out
  for (const obs of boxObstacles) {
    const cos = _cos(obs.rotation);
    const sin = _sin(obs.rotation);
    // Transform player to box local space
    const lx = cos * (x - obs.cx) + sin * (z - obs.cz);
    const lz = -sin * (x - obs.cx) + cos * (z - obs.cz);

    // Find closest point on box
    const clampX = Math.max(-obs.halfW, Math.min(obs.halfW, lx));
    const clampZ = Math.max(-obs.halfD, Math.min(obs.halfD, lz));

    const dlx = lx - clampX;
    const dlz = lz - clampZ;
    const dSq = dlx * dlx + dlz * dlz;

    if (dSq < playerRadius * playerRadius) {
      if (dSq > 0.0001) {
        const d = Math.sqrt(dSq);
        const overlap = playerRadius - d;
        const nlx = dlx / d;
        const nlz = dlz / d;
        // Push out in local space
        const pushLX = nlx * overlap;
        const pushLZ = nlz * overlap;
        // Transform back to world
        x += cos * pushLX - sin * pushLZ;
        z += sin * pushLX + cos * pushLZ;
      } else {
        // Inside the box — push out along shortest axis
        const overlapX = obs.halfW - Math.abs(lx) + playerRadius;
        const overlapZ = obs.halfD - Math.abs(lz) + playerRadius;
        if (overlapX < overlapZ) {
          const sign = lx >= 0 ? 1 : -1;
          const pushLX = sign * overlapX;
          x += cos * pushLX;
          z += sin * pushLX;
        } else {
          const sign = lz >= 0 ? 1 : -1;
          const pushLZ = sign * overlapZ;
          x += -sin * pushLZ;
          z += cos * pushLZ;
        }
      }
    }
  }

  return { x, z };
}

/**
 * Check if a build placement position is blocked by existing obstacles.
 */
export function isPlacementBlocked(px: number, pz: number, buildRadius: number): boolean {
  for (const obs of circleObstacles) {
    const dx = px - obs.x;
    const dz = pz - obs.z;
    const minDist = buildRadius + obs.radius;
    if (dx * dx + dz * dz < minDist * minDist) return true;
  }
  for (const obs of boxObstacles) {
    const cos = _cos(obs.rotation);
    const sin = _sin(obs.rotation);
    const lx = cos * (px - obs.cx) + sin * (pz - obs.cz);
    const lz = -sin * (px - obs.cx) + cos * (pz - obs.cz);
    const clampX = Math.max(-obs.halfW, Math.min(obs.halfW, lx));
    const clampZ = Math.max(-obs.halfD, Math.min(obs.halfD, lz));
    const dlx = lx - clampX;
    const dlz = lz - clampZ;
    if (dlx * dlx + dlz * dlz < buildRadius * buildRadius) return true;
  }
  return false;
}
