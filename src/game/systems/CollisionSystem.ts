/**
 * CollisionSystem — Obstacle registry with push-out resolution.
 * Collision volumes MUST match visible geometry exactly.
 * No phantom blockers allowed on open ground.
 */

import { WorldResource } from './WorldResources';
import { PlacedStructure, BUILDABLES } from './BuildingData';
import { HorseData } from './HorseData';
import { SETTLEMENTS, SettlementDef } from '../world/RegionData';
import { seededRng } from '../world/SettlementPieces';

export interface CircleObstacle {
  x: number;
  z: number;
  radius: number;
  id: string;
}

export interface BoxObstacle {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  rotation: number;
  id: string;
}

// Global obstacle lists, rebuilt when world changes
let circleObstacles: CircleObstacle[] = [];
let boxObstacles: BoxObstacle[] = [];

// Debug access
export function getCircleObstacles() { return circleObstacles; }
export function getBoxObstacles() { return boxObstacles; }

const _cos = Math.cos;
const _sin = Math.sin;

/**
 * Rebuild the obstacle list from current world state.
 */
export function rebuildObstacles(
  resources: WorldResource[],
  structures: PlacedStructure[],
  horses: HorseData[],
  excludeHorseId: string | null,
) {
  circleObstacles = [];
  boxObstacles = [];

  // Trees
  for (const r of resources) {
    if (r.depleted) continue;
    if (r.type === 'tree') {
      circleObstacles.push({
        x: r.position[0], z: r.position[2],
        radius: 0.25 * r.scale + 0.2, id: r.id,
      });
    } else if (r.type === 'rock') {
      circleObstacles.push({
        x: r.position[0], z: r.position[2],
        radius: r.scale * 0.5 + 0.15, id: r.id,
      });
    }
  }

  // Player-placed structures
  for (const s of structures) {
    const config = BUILDABLES.find(b => b.type === s.type);
    if (!config) continue;
    const [w, , d] = config.size;
    if (s.type === 'wall' || s.type === 'fence' || s.type === 'gate') {
      boxObstacles.push({
        cx: s.position[0], cz: s.position[2],
        halfW: w / 2 + 0.1, halfD: Math.max(d / 2, 0.3),
        rotation: s.rotation, id: s.id,
      });
    } else if (s.type === 'campfire') {
      circleObstacles.push({ x: s.position[0], z: s.position[2], radius: 0.5, id: s.id });
    } else {
      const rad = Math.max(w, d) / 2;
      circleObstacles.push({ x: s.position[0], z: s.position[2], radius: rad, id: s.id });
    }
  }

  // Horse
  for (const h of horses) {
    if (h.id === excludeHorseId) continue;
    if (h.state === 'mounted') continue;
    circleObstacles.push({ x: h.position[0], z: h.position[2], radius: 0.8, id: h.id });
  }

  // Settlement static obstacles — must match Settlements.tsx visuals exactly
  addSettlementObstacles();
}

// ========== SETTLEMENT COLLISION ==========
// Each function below mirrors the EXACT positions used in Settlements.tsx

function addSettlementObstacles() {
  for (const s of SETTLEMENTS) {
    const [sx, sz] = s.position;

    switch (s.type) {
      case 'capital': addCapitalCollision(s, sx, sz); break;
      case 'village': {
        if (s.size === 'small') addSmallVillageCollision(s, sx, sz);
        else addFarmingVillageCollision(s, sx, sz);
        break;
      }
      case 'fort': addFortCollision(s, sx, sz); break;
      case 'ruins': addRuinsCollision(s, sx, sz); break;
      case 'bandit_camp': addBanditCampCollision(s, sx, sz); break;
      case 'outpost': addOutpostCollision(s, sx, sz); break;
      case 'monastery': addMonasteryCollision(s, sx, sz); break;
    }
  }
}

function addCapitalCollision(s: SettlementDef, sx: number, sz: number) {
  // Central keep — visual is box scale [12,20,12] → 6x6 footprint
  boxObstacles.push({ cx: sx, cz: sz, halfW: 6, halfD: 6, rotation: 0, id: `${s.id}-keep` });

  // Walls — visual Wall components: from/to with thickness 2.5
  // North wall: from [-35,0,-35] to [35,0,-35], thickness 2.5
  boxObstacles.push({ cx: sx, cz: sz - 35, halfW: 35, halfD: 1.25, rotation: 0, id: `${s.id}-wall-n` });
  // East wall: from [35,0,-35] to [35,0,35]
  boxObstacles.push({ cx: sx + 35, cz: sz, halfW: 1.25, halfD: 35, rotation: 0, id: `${s.id}-wall-e` });
  // South wall: from [35,0,35] to [-35,0,35] — FULL wall visually (no gate gap in mesh)
  // But we need a gate gap for gameplay. Split into two with 5-unit gap center.
  boxObstacles.push({ cx: sx - 20, cz: sz + 35, halfW: 15, halfD: 1.25, rotation: 0, id: `${s.id}-wall-s-l` });
  boxObstacles.push({ cx: sx + 20, cz: sz + 35, halfW: 15, halfD: 1.25, rotation: 0, id: `${s.id}-wall-s-r` });
  // West wall: from [-35,0,35] to [-35,0,-35]
  boxObstacles.push({ cx: sx - 35, cz: sz, halfW: 1.25, halfD: 35, rotation: 0, id: `${s.id}-wall-w` });

  // Corner towers — visual: radius 3, positions [-35,-35] etc.
  for (const [tx, tz] of [[-35, -35], [35, -35], [35, 35], [-35, 35]]) {
    circleObstacles.push({ x: sx + tx, z: sz + tz, radius: 3, id: `${s.id}-tower-${tx}-${tz}` });
  }

  // Gate towers — visual: radius 2.2 at [-5,35.5] and [5,35.5]
  circleObstacles.push({ x: sx - 5, z: sz + 35.5, radius: 2.2, id: `${s.id}-gate-l` });
  circleObstacles.push({ x: sx + 5, z: sz + 35.5, radius: 2.2, id: `${s.id}-gate-r` });

  // Well — visual: cylinder scale [0.8,0.8,0.8] at [0,0,14]
  circleObstacles.push({ x: sx, z: sz + 14, radius: 0.8, id: `${s.id}-well` });

  // Stables building — visual: House w=6 d=4 at [25,0,10]
  boxObstacles.push({ cx: sx + 25, cz: sz + 10, halfW: 3, halfD: 2, rotation: 1.5, id: `${s.id}-stable` });

  // Houses — use SAME seeded RNG as CapitalCity visual (seed 7777)
  addCapitalHouseCollision(sx, sz, s.id);
}

function addCapitalHouseCollision(sx: number, sz: number, sid: string) {
  const rng = seededRng(7777);
  // Outer ring — 16 houses (matches CapitalCity visual exactly)
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const r = 18 + rng() * 12;
    const hx = Math.cos(angle) * r;
    const hz = Math.sin(angle) * r;
    const rot = angle + Math.PI + (rng() - 0.5) * 0.3;
    const w = 3.5 + rng() * 2;
    const d = 4 + rng() * 2;
    rng(); // h (not needed for collision)
    rng(); // style (not needed)
    boxObstacles.push({
      cx: sx + hx, cz: sz + hz, halfW: w / 2, halfD: d / 2,
      rotation: rot, id: `${sid}-house-o${i}`,
    });
  }
  // Inner ring — 8 houses
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + 0.2;
    const r = 8 + rng() * 5;
    const hx = Math.cos(angle) * r;
    const hz = Math.sin(angle) * r;
    const rot = angle + Math.PI;
    const w = 3 + rng() * 1.5;
    const d = 3.5 + rng() * 1.5;
    rng(); // h
    rng(); // style  
    boxObstacles.push({
      cx: sx + hx, cz: sz + hz, halfW: w / 2, halfD: d / 2,
      rotation: rot, id: `${sid}-house-i${i}`,
    });
  }
}

function addFarmingVillageCollision(s: SettlementDef, sx: number, sz: number) {
  const rng = seededRng(3333);
  // 8 houses — matches FarmingVillage visual exactly
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + rng() * 0.4;
    const r = 10 + rng() * 15;
    const hx = Math.cos(angle) * r;
    const hz = Math.sin(angle) * r;
    const rot = angle + Math.PI + rng() * 0.5;
    const w = 3.5 + rng() * 1.5;
    const d = 4 + rng() * 1.5;
    rng(); // h
    rng(); // style
    boxObstacles.push({
      cx: sx + hx, cz: sz + hz, halfW: w / 2, halfD: d / 2,
      rotation: rot, id: `${s.id}-house-${i}`,
    });
  }
  // Barn at [12, 0, 8] — House w=6 d=8
  boxObstacles.push({ cx: sx + 12, cz: sz + 8, halfW: 3, halfD: 4, rotation: 0.5, id: `${s.id}-barn` });
  // Well at center
  circleObstacles.push({ x: sx, z: sz, radius: 0.8, id: `${s.id}-well` });
  // Cart at [5, 0, 5] — small
  circleObstacles.push({ x: sx + 5, z: sz + 5, radius: 0.8, id: `${s.id}-cart` });
}

function addSmallVillageCollision(s: SettlementDef, sx: number, sz: number) {
  const rng = seededRng(sx * 100 + sz); // matches SmallVillage seed
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + rng() * 0.5;
    const r = 5 + rng() * 6;
    const hx = Math.cos(angle) * r;
    const hz = Math.sin(angle) * r;
    const rot = angle + Math.PI;
    const w = 3 + rng();
    const d = 3.5 + rng();
    rng(); // h
    rng(); // style
    boxObstacles.push({
      cx: sx + hx, cz: sz + hz, halfW: w / 2, halfD: d / 2,
      rotation: rot, id: `${s.id}-house-${i}`,
    });
  }
  circleObstacles.push({ x: sx, z: sz, radius: 0.8, id: `${s.id}-well` });
}

function addFortCollision(s: SettlementDef, sx: number, sz: number) {
  // Main building — House w=7, d=8 at [0,0,0]
  boxObstacles.push({ cx: sx, cz: sz, halfW: 3.5, halfD: 4, rotation: 0, id: `${s.id}-main` });

  // Barracks — House w=5 d=6 at [-10,0,5]
  boxObstacles.push({ cx: sx - 10, cz: sz + 5, halfW: 2.5, halfD: 3, rotation: 0.3, id: `${s.id}-barracks-1` });
  // Barracks — House w=5 d=4 at [10,0,-5]
  boxObstacles.push({ cx: sx + 10, cz: sz - 5, halfW: 2.5, halfD: 2, rotation: -0.2, id: `${s.id}-barracks-2` });

  // Corner watchtowers — radius 1.8 cylinders at palisade edge
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    circleObstacles.push({
      x: sx + Math.cos(a) * 22, z: sz + Math.sin(a) * 22,
      radius: 1.8, id: `${s.id}-tower-${a.toFixed(1)}`,
    });
  }

  // Beacon tower at [0,0,-18] — radius 2.5
  circleObstacles.push({ x: sx, z: sz - 18, radius: 2.5, id: `${s.id}-beacon` });

  // Palisade — individual post collision (matches Palisade component with 32 segments, radius 22)
  // Each post is a box scale [0.3, h, 0.8] rotated to face center. Only the 0.3x0.8 footprint matters.
  // Gate at angle PI/2. Visual skips posts where angleDiff < 0.3.
  const pR = 22;
  const segments = 32;
  const gateAngle = Math.PI / 2;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const angleDiff = Math.abs(((a - gateAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
    if (angleDiff < 0.3) continue; // gate gap
    const px = sx + Math.cos(a) * pR;
    const pz = sz + Math.sin(a) * pR;
    circleObstacles.push({ x: px, z: pz, radius: 0.4, id: `${s.id}-pal-${i}` });
  }
}

function addRuinsCollision(s: SettlementDef, sx: number, sz: number) {
  // Altar platform — flat, box scale [8,0.6,8]. Use a low box, not a big circle.
  // Players can walk onto it (it's only 0.6 high). Skip collision for the platform.
  // Only block the altar stone on top: box scale [3,0.8,1.5]
  boxObstacles.push({ cx: sx, cz: sz, halfW: 1.5, halfD: 0.75, rotation: 0, id: `${s.id}-altar` });

  // Grand arch pillars — boxes scale [2,24,2] at [-5,0,0] and [2,20,2] at [5,0,0]
  circleObstacles.push({ x: sx - 5, z: sz, radius: 1, id: `${s.id}-arch-l` });
  circleObstacles.push({ x: sx + 5, z: sz, radius: 1, id: `${s.id}-arch-r` });

  // Pillar ring — 10 pillars at radius 8, cylinder scale [0.45, h, 0.45]
  const rng = seededRng(9999);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    rng(); // h consumed
    circleObstacles.push({
      x: sx + Math.cos(a) * 8, z: sz + Math.sin(a) * 8,
      radius: 0.5, id: `${s.id}-pillar-${i}`,
    });
  }

  // Ruined buildings — use same RNG as visual (seed 9999, but rng was already consumed for pillars)
  // Actually the ruins visual uses rng for pillars AND for ruined buildings.
  // The pillar loop consumed rng() once per pillar (for h). Then ruined buildings loop:
  // 12 buildings, each: angle += rng()*0.3, r = 12+rng()*20, then hx/hz, hy, wallH=1+rng()*3, rot=rng()*PI*2, w=3+rng()*3, d=3+rng()*3
  // That's 6 rng calls per building. Let me replicate:
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + rng() * 0.3;
    const r = 12 + rng() * 20;
    const hx = Math.cos(angle) * r;
    const hz = Math.sin(angle) * r;
    rng(); // wallH
    const rot = rng() * Math.PI * 2;
    const w = 3 + rng() * 3;
    const d = 3 + rng() * 3;
    // Ruined buildings are partially collapsed (low walls), but still solid footprint
    boxObstacles.push({
      cx: sx + hx, cz: sz + hz, halfW: w / 2, halfD: d / 2,
      rotation: rot, id: `${s.id}-ruin-${i}`,
    });
  }

  // Fallen column at [8, 0, -6] — cylinder on its side, radius 0.35, length 6
  boxObstacles.push({
    cx: sx + 8, cz: sz - 6, halfW: 0.35, halfD: 3, rotation: 0.5, id: `${s.id}-fallen`,
  });
}

function addBanditCampCollision(s: SettlementDef, sx: number, sz: number) {
  // Tents — cone shapes, use the same RNG as visual (seed 5555)
  const rng = seededRng(5555);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + rng() * 0.5;
    const r = 6 + rng() * 10;
    const tentSize = 1.5 + rng() * 1.5;
    rng(); // material choice
    circleObstacles.push({
      x: sx + Math.cos(angle) * r, z: sz + Math.sin(angle) * r,
      radius: tentSize * 0.6, id: `${s.id}-tent-${i}`,
    });
  }

  // Lookout posts — thin poles, small collision
  circleObstacles.push({ x: sx - 12, z: sz + 8, radius: 0.5, id: `${s.id}-lookout-1` });
  circleObstacles.push({ x: sx + 10, z: sz - 10, radius: 0.5, id: `${s.id}-lookout-2` });

  // Cage at [6, 0, 6]
  circleObstacles.push({ x: sx + 6, z: sz + 6, radius: 0.9, id: `${s.id}-cage` });

  // Palisade — individual posts (matches Palisade component: 20 segments, radius 16, gate at angle 0)
  const pR = 16;
  const segments = 20;
  const gateAngle = 0;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const angleDiff = Math.abs(((a - gateAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
    if (angleDiff < 0.3) continue;
    circleObstacles.push({
      x: sx + Math.cos(a) * pR, z: sz + Math.sin(a) * pR,
      radius: 0.3, id: `${s.id}-pal-${i}`,
    });
  }
}

function addOutpostCollision(s: SettlementDef, sx: number, sz: number) {
  // Main house — w=4, d=5
  boxObstacles.push({ cx: sx, cz: sz, halfW: 2, halfD: 2.5, rotation: 0, id: `${s.id}-main` });
  // Side house — w=3, d=3.5 at [-8, 0, 3]
  boxObstacles.push({ cx: sx - 8, cz: sz + 3, halfW: 1.5, halfD: 1.75, rotation: 0.5, id: `${s.id}-side` });
  // Shrine stone — box scale [1.5,2,0.5] at [5,0,0]
  circleObstacles.push({ x: sx + 5, z: sz, radius: 0.8, id: `${s.id}-shrine` });
  // Well
  circleObstacles.push({ x: sx + 3, z: sz - 4, radius: 0.8, id: `${s.id}-well` });
}

function addMonasteryCollision(s: SettlementDef, sx: number, sz: number) {
  // Main hall — box scale [8,7,12] → footprint 4x6
  boxObstacles.push({ cx: sx, cz: sz, halfW: 4, halfD: 6, rotation: 0, id: `${s.id}-hall` });

  // Spire — cylinder scale [1.2,8,1.2] at [0,0,-4]
  circleObstacles.push({ x: sx, z: sz - 4, radius: 1.2, id: `${s.id}-spire` });

  // Side building — House w=4 d=5 at [-8,0,4]
  boxObstacles.push({ cx: sx - 8, cz: sz + 4, halfW: 2, halfD: 2.5, rotation: 0, id: `${s.id}-side` });

  // Walls — Wall component with thickness 1.5
  // North: from [-12,0,-10] to [12,0,-10]
  boxObstacles.push({ cx: sx, cz: sz - 10, halfW: 12, halfD: 0.75, rotation: 0, id: `${s.id}-wall-n` });
  // West: from [-12,0,-10] to [-12,0,10]
  boxObstacles.push({ cx: sx - 12, cz: sz, halfW: 0.75, halfD: 10, rotation: 0, id: `${s.id}-wall-w` });
  // East: from [12,0,-10] to [12,0,10]
  boxObstacles.push({ cx: sx + 12, cz: sz, halfW: 0.75, halfD: 10, rotation: 0, id: `${s.id}-wall-e` });

  // Well at [4,0,6]
  circleObstacles.push({ x: sx + 4, z: sz + 6, radius: 0.8, id: `${s.id}-well` });
}

// ========== COLLISION RESOLUTION ==========

export function resolveCollision(
  px: number, pz: number, playerRadius: number
): { x: number; z: number } {
  let x = px;
  let z = pz;

  for (const obs of circleObstacles) {
    const dx = x - obs.x;
    const dz = z - obs.z;
    const distSq = dx * dx + dz * dz;
    const minDist = playerRadius + obs.radius;
    if (distSq < minDist * minDist && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const overlap = minDist - dist;
      x += (dx / dist) * overlap;
      z += (dz / dist) * overlap;
    }
  }

  for (const obs of boxObstacles) {
    const cos = _cos(obs.rotation);
    const sin = _sin(obs.rotation);
    const lx = cos * (x - obs.cx) + sin * (z - obs.cz);
    const lz = -sin * (x - obs.cx) + cos * (z - obs.cz);
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
        x += cos * (nlx * overlap) - sin * (nlz * overlap);
        z += sin * (nlx * overlap) + cos * (nlz * overlap);
      } else {
        const overlapX = obs.halfW - Math.abs(lx) + playerRadius;
        const overlapZ = obs.halfD - Math.abs(lz) + playerRadius;
        if (overlapX < overlapZ) {
          const sign = lx >= 0 ? 1 : -1;
          x += cos * (sign * overlapX);
          z += sin * (sign * overlapX);
        } else {
          const sign = lz >= 0 ? 1 : -1;
          x += -sin * (sign * overlapZ);
          z += cos * (sign * overlapZ);
        }
      }
    }
  }

  return { x, z };
}

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
