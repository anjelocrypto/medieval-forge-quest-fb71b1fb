/**
 * CollisionSystem — Simple circle/cylinder-based obstacle registry with push-out resolution.
 * Obstacles are registered as circles on the XZ plane with a radius.
 * Player (and mounted player) are resolved as a moving circle pushed out of overlaps.
 */

import * as THREE from 'three';
import { WorldResource } from './WorldResources';
import { PlacedStructure, BUILDABLES } from './BuildingData';
import { HorseData } from './HorseData';
import { POIS } from '../constants';
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

  // POI static structures
  addPOIObstacles();
}

function addPOIObstacles() {
  const c = POIS.castle;
  // Castle walls (thick stone walls)
  boxObstacles.push({ cx: c.x, cz: c.z - 18, halfW: 14, halfD: 1.25, rotation: 0, id: 'castle-wall-n' });
  boxObstacles.push({ cx: c.x, cz: c.z + 18, halfW: 14, halfD: 1.25, rotation: 0, id: 'castle-wall-s' });
  boxObstacles.push({ cx: c.x - 14, cz: c.z, halfW: 1.25, halfD: 16.5, rotation: 0, id: 'castle-wall-w' });
  boxObstacles.push({ cx: c.x + 14, cz: c.z, halfW: 1.25, halfD: 16.5, rotation: 0, id: 'castle-wall-e' });
  // Castle keep
  circleObstacles.push({ x: c.x, z: c.z, radius: 5.5, id: 'castle-keep' });
  // Corner towers
  for (const [tx, tz] of [[-14, -18], [14, -18], [-14, 18], [14, 18]]) {
    circleObstacles.push({ x: c.x + tx, z: c.z + tz, radius: 3, id: `castle-tower-${tx}-${tz}` });
  }
  // Gate opening — leave a gap in south wall by not adding obstacle at gate center
  // (the south wall already has the gap implicitly since we use one wide box — 
  //  let's split it into two segments with a gap)
  // Remove the full south wall and add two segments
  boxObstacles.pop(); // remove castle-wall-s (index is predictable since we just pushed it)
  // We need to find and remove it properly — let's just rebuild
  const southIdx = boxObstacles.findIndex(o => o.id === 'castle-wall-s');
  if (southIdx >= 0) boxObstacles.splice(southIdx, 1);
  // Two wall segments with 4-unit gate gap
  boxObstacles.push({ cx: c.x - 8, cz: c.z + 18, halfW: 6, halfD: 1.25, rotation: 0, id: 'castle-wall-s-l' });
  boxObstacles.push({ cx: c.x + 8, cz: c.z + 18, halfW: 6, halfD: 1.25, rotation: 0, id: 'castle-wall-s-r' });
  // Gate towers
  circleObstacles.push({ x: c.x - 4.5, z: c.z + 18.5, radius: 2, id: 'castle-gate-l' });
  circleObstacles.push({ x: c.x + 4.5, z: c.z + 18.5, radius: 2, id: 'castle-gate-r' });

  // Village houses
  const v = POIS.village;
  const houses = [
    { dx: 0, dz: 0, w: 5, d: 6 },
    { dx: -12, dz: 6, w: 4, d: 5 },
    { dx: 10, dz: -7, w: 6, d: 5 },
    { dx: -6, dz: -12, w: 4.5, d: 5.5 },
    { dx: 14, dz: 9, w: 5, d: 4.5 },
  ];
  for (let i = 0; i < houses.length; i++) {
    const h = houses[i];
    circleObstacles.push({
      x: v.x + h.dx, z: v.z + h.dz,
      radius: Math.max(h.w, h.d) / 2 + 0.3,
      id: `village-house-${i}`,
    });
  }
  // Village well
  circleObstacles.push({ x: v.x + 4, z: v.z + 4, radius: 1, id: 'village-well' });

  // Ruins pillars
  const r = POIS.ruins;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const rad = 12;
    circleObstacles.push({
      x: r.x + Math.cos(angle) * rad,
      z: r.z + Math.sin(angle) * rad,
      radius: 0.7, id: `ruins-pillar-${i}`,
    });
  }
  // Ruins altar
  circleObstacles.push({ x: r.x, z: r.z, radius: 2, id: 'ruins-altar' });
  // Ruins arch pillars
  circleObstacles.push({ x: r.x - 2, z: r.z + 12, radius: 0.6, id: 'ruins-arch-l' });
  circleObstacles.push({ x: r.x + 2, z: r.z + 12, radius: 0.6, id: 'ruins-arch-r' });

  // Bandit camp tents
  const bc = POIS.camp;
  circleObstacles.push({ x: bc.x - 3, z: bc.z, radius: 2.2, id: 'camp-tent-1' });
  circleObstacles.push({ x: bc.x + 4, z: bc.z + 3, radius: 1.8, id: 'camp-tent-2' });
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
