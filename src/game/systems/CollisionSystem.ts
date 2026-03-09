/**
 * CollisionSystem — Obstacle registry with push-out resolution.
 * Collision volumes MUST match visible geometry exactly.
 */

import { WorldResource } from './WorldResources';
import { PlacedStructure, BUILDABLES } from './BuildingData';
import { HorseData } from './HorseData';
import { SETTLEMENTS, SettlementDef, SMALL_POIS } from '../world/RegionData';
import { seededRng } from '../world/SettlementPieces';
import { TOWN_BUILDINGS } from '../components/TownDistrict';
import { WILDERNESS_BUILDINGS } from '../components/WildernessStructures';

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

let circleObstacles: CircleObstacle[] = [];
let boxObstacles: BoxObstacle[] = [];

export function getCircleObstacles() { return circleObstacles; }
export function getBoxObstacles() { return boxObstacles; }

const _cos = Math.cos;
const _sin = Math.sin;

export function rebuildObstacles(
  resources: WorldResource[],
  structures: PlacedStructure[],
  horses: HorseData[],
  excludeHorseId: string | null,
) {
  circleObstacles = [];
  boxObstacles = [];

  for (const r of resources) {
    if (r.depleted) continue;
    if (r.type === 'tree') {
      circleObstacles.push({ x: r.position[0], z: r.position[2], radius: 0.25 * r.scale + 0.2, id: r.id });
    } else if (r.type === 'rock') {
      circleObstacles.push({ x: r.position[0], z: r.position[2], radius: r.scale * 0.5 + 0.15, id: r.id });
    }
  }

  for (const s of structures) {
    const config = BUILDABLES.find(b => b.type === s.type);
    if (!config) continue;
    const [w, , d] = config.size;
    if (s.type === 'wall' || s.type === 'fence' || s.type === 'gate') {
      boxObstacles.push({ cx: s.position[0], cz: s.position[2], halfW: w / 2 + 0.1, halfD: Math.max(d / 2, 0.3), rotation: s.rotation, id: s.id });
    } else if (s.type === 'campfire') {
      circleObstacles.push({ x: s.position[0], z: s.position[2], radius: 0.5, id: s.id });
    } else {
      circleObstacles.push({ x: s.position[0], z: s.position[2], radius: Math.max(w, d) / 2, id: s.id });
    }
  }

  for (const h of horses) {
    if (h.id === excludeHorseId || h.state === 'mounted') continue;
    circleObstacles.push({ x: h.position[0], z: h.position[2], radius: 0.8, id: h.id });
  }

  addSettlementObstacles();
  addPOIObstacles();
  addTownDistrictObstacles();
  addWildernessObstacles();
}

function addSettlementObstacles() {
  for (const s of SETTLEMENTS) {
    const [sx, sz] = s.position;
    switch (s.type) {
      case 'capital': addCapitalCollision(s, sx, sz); break;
      case 'village':
        if (s.size === 'small') addSmallVillageCollision(s, sx, sz);
        else addFarmingVillageCollision(s, sx, sz);
        break;
      case 'fort': addFortCollision(s, sx, sz); break;
      case 'ruins': addRuinsCollision(s, sx, sz); break;
      case 'bandit_camp': addBanditCampCollision(s, sx, sz); break;
      case 'outpost': addOutpostCollision(s, sx, sz); break;
      case 'monastery': addMonasteryCollision(s, sx, sz); break;
      case 'fortified_city': addFortifiedCityCollision(s, sx, sz); break;
      case 'river_town': addRiverTownCollision(s, sx, sz); break;
      case 'mountain_hold': addMountainHoldCollision(s, sx, sz); break;
      case 'frontier_camp': addFrontierCampCollision(s, sx, sz); break;
      case 'trade_city': addTradeCityCollision(s, sx, sz); break;
    }
  }
}

// === CAPITAL ===
function addCapitalCollision(s: SettlementDef, sx: number, sz: number) {
  // Keep platform + body: box [12,12,12] on platform [16,2,16]
  boxObstacles.push({ cx: sx, cz: sz, halfW: 8, halfD: 8, rotation: 0, id: `${s.id}-keep` });

  // Chapel at [-15, 0, -8]: box [5,7,8]
  boxObstacles.push({ cx: sx - 15, cz: sz - 8, halfW: 2.5, halfD: 4, rotation: 0, id: `${s.id}-chapel` });

  // Walls at ±38 (matches visual layout)
  boxObstacles.push({ cx: sx, cz: sz - 38, halfW: 38, halfD: 1.25, rotation: 0, id: `${s.id}-wall-n` });
  boxObstacles.push({ cx: sx + 38, cz: sz, halfW: 1.25, halfD: 38, rotation: 0, id: `${s.id}-wall-e` });
  // South wall segments: gap from -5.5 to +5.5 for gatehouse w=8
  boxObstacles.push({ cx: sx - 21.75, cz: sz + 38, halfW: 16.25, halfD: 1.25, rotation: 0, id: `${s.id}-wall-s-l` });
  boxObstacles.push({ cx: sx + 21.75, cz: sz + 38, halfW: 16.25, halfD: 1.25, rotation: 0, id: `${s.id}-wall-s-r` });
  boxObstacles.push({ cx: sx - 38, cz: sz, halfW: 1.25, halfD: 38, rotation: 0, id: `${s.id}-wall-w` });

  // Corner towers r=3.2 at ±38
  for (const [tx, tz] of [[-38, -38], [38, -38], [38, 38], [-38, 38]]) {
    circleObstacles.push({ x: sx + tx, z: sz + tz, radius: 3.2, id: `${s.id}-tower-${tx}-${tz}` });
  }
  // Mid-wall towers r=2.5
  for (const [tx, tz] of [[0, -38], [38, 0], [-38, 0]]) {
    circleObstacles.push({ x: sx + tx, z: sz + tz, radius: 2.5, id: `${s.id}-midtower-${tx}-${tz}` });
  }
  // Gatehouse towers at [±4, 38] r=1.5 — matches visual tower r=1.5, gap=5 units
  circleObstacles.push({ x: sx - 4, z: sz + 38, radius: 1.5, id: `${s.id}-gate-l` });
  circleObstacles.push({ x: sx + 4, z: sz + 38, radius: 1.5, id: `${s.id}-gate-r` });

  // Barracks at [22, 0, -15]
  boxObstacles.push({ cx: sx + 22, cz: sz - 15, halfW: 3.5, halfD: 2.5, rotation: 0, id: `${s.id}-barracks` });
  boxObstacles.push({ cx: sx + 22, cz: sz - 23, halfW: 3.5, halfD: 2, rotation: 0, id: `${s.id}-barracks2` });

  // Stables at [25, 0, 12]
  boxObstacles.push({ cx: sx + 25, cz: sz + 12, halfW: 3, halfD: 2.25, rotation: 1.5, id: `${s.id}-stable` });

  // Smithy at [-22, 0, 10]
  circleObstacles.push({ x: sx - 22, z: sz + 10, radius: 1.5, id: `${s.id}-smithy` });

  // Well at [8, 0, 18]
  circleObstacles.push({ x: sx + 8, z: sz + 18, radius: 0.8, id: `${s.id}-well` });

  // Houses — synced with visual RNG
  addCapitalHouseCollision(sx, sz, s.id);
}

function addCapitalHouseCollision(sx: number, sz: number, sid: string) {
  const rng = seededRng(7777);
  // Outer ring — 14 houses (RNG calls must match Settlements.tsx CapitalCity exactly)
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2;
    const r = 20 + rng() * 10;
    const hx = Math.cos(angle) * r;
    const hz = Math.sin(angle) * r;
    const rot = angle + Math.PI + (rng() - 0.5) * 0.4;
    const w = 4 + rng() * 2.5;
    const d = 4.5 + rng() * 2.5;
    rng(); // h
    rng(); // style s1
    rng(); // style s2 — always 2 calls to match visual
    rng(); // chimney
    rng(); // shed
    boxObstacles.push({ cx: sx + hx, cz: sz + hz, halfW: w / 2, halfD: d / 2, rotation: rot, id: `${sid}-house-o${i}` });
  }
  // Inner ring — 6 houses (style hardcoded 'stone' — no rng call for style)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.3;
    const r = 10 + rng() * 4;
    const hx = Math.cos(angle) * r;
    const hz = Math.sin(angle) * r;
    const rot = angle + Math.PI;
    const w = 3.5 + rng() * 1.5;
    const d = 4 + rng() * 1.5;
    rng(); // h
    // No rng() for style — matches visual which hardcodes 'stone'
    rng(); // chimney
    // shed is false, no rng call
    boxObstacles.push({ cx: sx + hx, cz: sz + hz, halfW: w / 2, halfD: d / 2, rotation: rot, id: `${sid}-house-i${i}` });
  }
}

// === FARMING VILLAGE ===
function addFarmingVillageCollision(s: SettlementDef, sx: number, sz: number) {
  const rng = seededRng(3333);
  // 10 houses
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + rng() * 0.5;
    const r = 8 + rng() * 14;
    const hx = Math.cos(angle) * r;
    const hz = Math.sin(angle) * r;
    const rot = angle + Math.PI + rng() * 0.6;
    const isLarger = i < 3;
    const w = isLarger ? 4.5 + rng() : 3 + rng() * 1.5;
    const d = isLarger ? 5 + rng() : 3.5 + rng() * 1.5;
    rng(); // h
    rng(); // style
    rng(); // chimney
    rng(); // shed
    boxObstacles.push({ cx: sx + hx, cz: sz + hz, halfW: w / 2, halfD: d / 2, rotation: rot, id: `${s.id}-house-${i}` });
  }
  // Barn at [14, 0, 6]
  boxObstacles.push({ cx: sx + 14, cz: sz + 6, halfW: 3.5, halfD: 4.5, rotation: 0.5, id: `${s.id}-barn` });
  // Windmill at [-18, 0, -20]
  circleObstacles.push({ x: sx - 18, z: sz - 20, radius: 2.5, id: `${s.id}-mill` });
  circleObstacles.push({ x: sx, z: sz, radius: 0.8, id: `${s.id}-well` });
}

// === SMALL VILLAGE ===
function addSmallVillageCollision(s: SettlementDef, sx: number, sz: number) {
  const rng = seededRng(sx * 100 + sz);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + rng() * 0.5;
    const r = 5 + rng() * 7;
    const hx = Math.cos(angle) * r;
    const hz = Math.sin(angle) * r;
    const rot = angle + Math.PI;
    const w = 3 + rng();
    const d = 3.5 + rng();
    rng(); // h
    rng(); // style
    rng(); // chimney
    rng(); // shed
    boxObstacles.push({ cx: sx + hx, cz: sz + hz, halfW: w / 2, halfD: d / 2, rotation: rot, id: `${s.id}-house-${i}` });
  }
  circleObstacles.push({ x: sx, z: sz, radius: 0.8, id: `${s.id}-well` });
}

// === MILITARY FORT (now square stone walls) ===
function addFortCollision(s: SettlementDef, sx: number, sz: number) {
  // Stone walls at ±20
  boxObstacles.push({ cx: sx, cz: sz - 20, halfW: 20, halfD: 0.9, rotation: 0, id: `${s.id}-wall-n` });
  boxObstacles.push({ cx: sx + 20, cz: sz, halfW: 0.9, halfD: 20, rotation: 0, id: `${s.id}-wall-e` });
  // South wall segments: gap from -5 to +5 for gatehouse w=7
  boxObstacles.push({ cx: sx - 12.5, cz: sz + 20, halfW: 7.5, halfD: 0.9, rotation: 0, id: `${s.id}-wall-s-l` });
  boxObstacles.push({ cx: sx + 12.5, cz: sz + 20, halfW: 7.5, halfD: 0.9, rotation: 0, id: `${s.id}-wall-s-r` });
  boxObstacles.push({ cx: sx - 20, cz: sz, halfW: 0.9, halfD: 20, rotation: 0, id: `${s.id}-wall-w` });

  // Corner towers r=2.2
  for (const [tx, tz] of [[-20, -20], [20, -20], [20, 20], [-20, 20]]) {
    circleObstacles.push({ x: sx + tx, z: sz + tz, radius: 2.2, id: `${s.id}-tower-${tx}-${tz}` });
  }
  // Gatehouse towers at [±3.5, 20] r=1.5 — matches visual tower r=1.5, gap=4 units
  circleObstacles.push({ x: sx - 3.5, z: sz + 20, radius: 1.5, id: `${s.id}-gate-l` });
  circleObstacles.push({ x: sx + 3.5, z: sz + 20, radius: 1.5, id: `${s.id}-gate-r` });

  // Command building w=8 d=7 at [0,0,-8]
  boxObstacles.push({ cx: sx, cz: sz - 8, halfW: 4, halfD: 3.5, rotation: 0, id: `${s.id}-cmd` });
  // Barracks
  boxObstacles.push({ cx: sx - 10, cz: sz + 3, halfW: 3, halfD: 2.5, rotation: 0.1, id: `${s.id}-barracks-1` });
  boxObstacles.push({ cx: sx + 10, cz: sz + 3, halfW: 2.5, halfD: 2.5, rotation: -0.1, id: `${s.id}-barracks-2` });
  // Armory
  boxObstacles.push({ cx: sx - 10, cz: sz - 10, halfW: 2, halfD: 2, rotation: 0, id: `${s.id}-armory` });
  // Beacon tower
  circleObstacles.push({ x: sx, z: sz - 18, radius: 2.5, id: `${s.id}-beacon` });
}

// === RUINS ===
function addRuinsCollision(s: SettlementDef, sx: number, sz: number) {
  // Altar
  boxObstacles.push({ cx: sx, cz: sz, halfW: 3, halfD: 3, rotation: 0, id: `${s.id}-altar` });

  // Grand arch at [0, 0, 25]
  circleObstacles.push({ x: sx - 5, z: sz + 25, radius: 1.25, id: `${s.id}-arch-l` });
  circleObstacles.push({ x: sx + 5, z: sz + 25, radius: 1.25, id: `${s.id}-arch-r` });

  // Collapsed hall at [-15, 0, -5]
  boxObstacles.push({ cx: sx - 15, cz: sz - 5, halfW: 4, halfD: 0.5, rotation: 0, id: `${s.id}-hall-wall` });

  // Ruined tower at [20, 0, -15]
  circleObstacles.push({ x: sx + 20, z: sz - 15, radius: 3, id: `${s.id}-ruin-tower` });

  const rng = seededRng(9999);
  // Ruined buildings — 14
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + rng() * 0.3;
    const r = 12 + rng() * 22;
    const hx = Math.cos(angle) * r;
    const hz = Math.sin(angle) * r;
    rng(); // wallH
    const rot = rng() * Math.PI * 2;
    const w = 3 + rng() * 4;
    const d = 3 + rng() * 4;
    boxObstacles.push({ cx: sx + hx, cz: sz + hz, halfW: w / 2, halfD: d / 2, rotation: rot, id: `${s.id}-ruin-${i}` });
  }

  // Pillars — 10
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    rng(); // h
    rng(); // standing check
    circleObstacles.push({ x: sx + Math.cos(a) * 9, z: sz + Math.sin(a) * 9, radius: 0.5, id: `${s.id}-pillar-${i}` });
  }
}

// === BANDIT CAMP ===
function addBanditCampCollision(s: SettlementDef, sx: number, sz: number) {
  const rng = seededRng(5555);
  // 7 tents
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2 + rng() * 0.6;
    const r = 5 + rng() * 11;
    const tentSize = 1.2 + rng() * 1.8;
    rng(); // rotation
    rng(); // material
    circleObstacles.push({
      x: sx + Math.cos(angle) * r, z: sz + Math.sin(angle) * r,
      radius: tentSize * 0.5, id: `${s.id}-tent-${i}`,
    });
  }

  // Lookout posts
  circleObstacles.push({ x: sx - 13, z: sz + 9, radius: 0.6, id: `${s.id}-lookout-1` });
  circleObstacles.push({ x: sx + 11, z: sz - 11, radius: 0.6, id: `${s.id}-lookout-2` });

  // Cage at [7, 0, 7]
  circleObstacles.push({ x: sx + 7, z: sz + 7, radius: 0.7, id: `${s.id}-cage` });

  // Palisade posts (22 segments, radius 17, gate at 0)
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const angleDiff = Math.abs(((a - 0 + Math.PI) % (Math.PI * 2)) - Math.PI);
    if (angleDiff < 0.3) continue;
    circleObstacles.push({ x: sx + Math.cos(a) * 17, z: sz + Math.sin(a) * 17, radius: 0.35, id: `${s.id}-pal-${i}` });
  }

  // Gallows at [-8, 0, 8]
  circleObstacles.push({ x: sx - 8, z: sz + 8, radius: 0.3, id: `${s.id}-gallows` });
}

// === OUTPOST ===
function addOutpostCollision(s: SettlementDef, sx: number, sz: number) {
  boxObstacles.push({ cx: sx, cz: sz, halfW: 2.5, halfD: 3, rotation: 0, id: `${s.id}-main` });
  boxObstacles.push({ cx: sx - 9, cz: sz + 3, halfW: 1.75, halfD: 2, rotation: 0.5, id: `${s.id}-cabin` });
  boxObstacles.push({ cx: sx + 7, cz: sz + 2, halfW: 1.5, halfD: 1.25, rotation: 0, id: `${s.id}-shed` });
  circleObstacles.push({ x: sx + 5, z: sz - 5, radius: 0.8, id: `${s.id}-shrine` });
  circleObstacles.push({ x: sx + 3, z: sz - 3, radius: 0.8, id: `${s.id}-well` });
}

// === MONASTERY ===
function addMonasteryCollision(s: SettlementDef, sx: number, sz: number) {
  // Chapel nave: box [7, 7, 13]
  boxObstacles.push({ cx: sx, cz: sz, halfW: 3.5, halfD: 6.5, rotation: 0, id: `${s.id}-nave` });
  // Apse at [0, 0, -7.5]: cylinder r=3.5
  circleObstacles.push({ x: sx, z: sz - 7.5, radius: 3.5, id: `${s.id}-apse` });
  // Bell tower at [0, 0, -11]: box [3,14,3]
  boxObstacles.push({ cx: sx, cz: sz - 11, halfW: 1.5, halfD: 1.5, rotation: 0, id: `${s.id}-tower` });
  // East wing at [8, 0, 0]
  boxObstacles.push({ cx: sx + 8, cz: sz, halfW: 2, halfD: 5, rotation: Math.PI / 2, id: `${s.id}-wing-e` });
  // West wing at [-8, 0, 0]
  boxObstacles.push({ cx: sx - 8, cz: sz, halfW: 2, halfD: 5, rotation: -Math.PI / 2, id: `${s.id}-wing-w` });

  // Walls at ±14 with south gate gap
  boxObstacles.push({ cx: sx, cz: sz - 14, halfW: 14, halfD: 0.6, rotation: 0, id: `${s.id}-wall-n` });
  boxObstacles.push({ cx: sx - 14, cz: sz, halfW: 0.6, halfD: 14, rotation: 0, id: `${s.id}-wall-w` });
  boxObstacles.push({ cx: sx + 14, cz: sz, halfW: 0.6, halfD: 14, rotation: 0, id: `${s.id}-wall-e` });
  boxObstacles.push({ cx: sx + 8.5, cz: sz + 14, halfW: 5.5, halfD: 0.6, rotation: 0, id: `${s.id}-wall-s-r` });
  boxObstacles.push({ cx: sx - 8.5, cz: sz + 14, halfW: 5.5, halfD: 0.6, rotation: 0, id: `${s.id}-wall-s-l` });

  circleObstacles.push({ x: sx + 3, z: sz + 10, radius: 0.8, id: `${s.id}-well` });
}

// ========== POI OBSTACLES ==========
// Add collision for inns, camps, supply depots, etc. (not decorative shrines/milestones)
function addPOIObstacles() {
  for (const poi of SMALL_POIS) {
    const [px, pz] = poi.position;
    switch (poi.type) {
      case 'inn':
        // Inn footprint: 7x6 building
        boxObstacles.push({ cx: px, cz: pz, halfW: 3.5, halfD: 3, rotation: 0, id: `poi-${poi.id}` });
        break;
      case 'watchtower':
        // Tower base
        circleObstacles.push({ x: px, z: pz, radius: 1.5, id: `poi-${poi.id}` });
        break;
      case 'supply_depot':
        // Depot shelter — matches visual 4x3 footprint
        boxObstacles.push({ cx: px, cz: pz, halfW: 2, halfD: 1.5, rotation: 0, id: `poi-${poi.id}` });
        break;
      case 'hunter_camp':
        // Tent
        circleObstacles.push({ x: px, z: pz, radius: 1.2, id: `poi-${poi.id}` });
        break;
      case 'ruined_house':
        // Foundation footprint
        boxObstacles.push({ cx: px, cz: pz, halfW: 2.5, halfD: 2, rotation: 0, id: `poi-${poi.id}` });
        break;
      case 'cave':
        // Rock mass
        circleObstacles.push({ x: px, z: pz, radius: 2, id: `poi-${poi.id}` });
        break;
      case 'stone_circle':
        // Central altar only (stones are passable between)
        circleObstacles.push({ x: px, z: pz, radius: 1.2, id: `poi-${poi.id}` });
        break;
      case 'burned_village':
        // Passable - charred remains don't block
        break;
      case 'wagon':
        // Wagon body — matches visual 1.5x3 footprint
        boxObstacles.push({ cx: px, cz: pz, halfW: 0.75, halfD: 1.5, rotation: Math.sin(px) * 0.5, id: `poi-${poi.id}` });
        break;
      // Decorative POIs - no collision (shrines, milestones, crosses, lanterns, graves, ponds, clearings, crossroads)
      default:
        break;
    }
  }
}

// ========== TOWN DISTRICT OBSTACLES ==========
function addTownDistrictObstacles() {
  for (const b of TOWN_BUILDINGS) {
    boxObstacles.push({
      cx: b.x, cz: b.z,
      halfW: b.w / 2, halfD: b.d / 2,
      rotation: b.rot,
      id: `town-${b.x}-${b.z}`,
    });
  }
}

// ========== WILDERNESS STRUCTURE OBSTACLES ==========
function addWildernessObstacles() {
  for (const b of WILDERNESS_BUILDINGS) {
    if (b.type === 'camp') {
      // Camps are mostly passable, just tent
      circleObstacles.push({ x: b.x, z: b.z, radius: 0.8, id: `wild-${b.x}-${b.z}` });
    } else if (b.type === 'shrine_hut') {
      circleObstacles.push({ x: b.x, z: b.z, radius: 0.6, id: `wild-${b.x}-${b.z}` });
    } else {
      boxObstacles.push({
        cx: b.x, cz: b.z,
        halfW: b.w / 2, halfD: b.d / 2,
        rotation: b.rot,
        id: `wild-${b.x}-${b.z}`,
      });
    }
  }
}

// ========== NEW KINGDOM COLLISION ==========
function addFortifiedCityCollision(s: SettlementDef, sx: number, sz: number) {
  // Walls at ±45
  boxObstacles.push({ cx: sx, cz: sz - 45, halfW: 45, halfD: 1, rotation: 0, id: `${s.id}-wall-n` });
  boxObstacles.push({ cx: sx + 45, cz: sz, halfW: 1, halfD: 45, rotation: 0, id: `${s.id}-wall-e` });
  boxObstacles.push({ cx: sx - 22, cz: sz + 45, halfW: 22, halfD: 1, rotation: 0, id: `${s.id}-wall-s-l` });
  boxObstacles.push({ cx: sx + 22, cz: sz + 45, halfW: 22, halfD: 1, rotation: 0, id: `${s.id}-wall-s-r` });
  boxObstacles.push({ cx: sx - 45, cz: sz, halfW: 1, halfD: 45, rotation: 0, id: `${s.id}-wall-w` });
  // Corner towers
  for (const [tx, tz] of [[-45, -45], [45, -45], [45, 45], [-45, 45]]) {
    circleObstacles.push({ x: sx + tx, z: sz + tz, radius: 3.5, id: `${s.id}-tower-${tx}-${tz}` });
  }
  // Gate towers
  circleObstacles.push({ x: sx - 5, z: sz + 45, radius: 2, id: `${s.id}-gate-l` });
  circleObstacles.push({ x: sx + 5, z: sz + 45, radius: 2, id: `${s.id}-gate-r` });
  // Citadel
  boxObstacles.push({ cx: sx, cz: sz - 10, halfW: 7, halfD: 7, rotation: 0, id: `${s.id}-citadel` });
}

function addRiverTownCollision(s: SettlementDef, sx: number, sz: number) {
  // Town hall
  boxObstacles.push({ cx: sx, cz: sz, halfW: 4, halfD: 5, rotation: 0, id: `${s.id}-hall` });
  // Clock tower
  boxObstacles.push({ cx: sx, cz: sz - 5, halfW: 1.5, halfD: 1.5, rotation: 0, id: `${s.id}-tower` });
  // Dock platform
  boxObstacles.push({ cx: sx, cz: sz - 30, halfW: 20, halfD: 4, rotation: 0, id: `${s.id}-dock` });
  // Lighthouse
  circleObstacles.push({ x: sx + 25, z: sz - 28, radius: 1.5, id: `${s.id}-light` });
}

function addMountainHoldCollision(s: SettlementDef, sx: number, sz: number) {
  // Platform
  boxObstacles.push({ cx: sx, cz: sz, halfW: 25, halfD: 25, rotation: 0, id: `${s.id}-platform` });
  // Great hall
  boxObstacles.push({ cx: sx, cz: sz, halfW: 8, halfD: 10, rotation: 0, id: `${s.id}-hall` });
  // Walls
  boxObstacles.push({ cx: sx, cz: sz - 25, halfW: 25, halfD: 1, rotation: 0, id: `${s.id}-wall-n` });
  boxObstacles.push({ cx: sx + 25, cz: sz, halfW: 1, halfD: 25, rotation: 0, id: `${s.id}-wall-e` });
  boxObstacles.push({ cx: sx - 15, cz: sz + 25, halfW: 10, halfD: 1, rotation: 0, id: `${s.id}-wall-s-l` });
  boxObstacles.push({ cx: sx + 15, cz: sz + 25, halfW: 10, halfD: 1, rotation: 0, id: `${s.id}-wall-s-r` });
  boxObstacles.push({ cx: sx - 25, cz: sz, halfW: 1, halfD: 25, rotation: 0, id: `${s.id}-wall-w` });
  for (const [tx, tz] of [[-25, -25], [25, -25], [25, 25], [-25, 25]]) {
    circleObstacles.push({ x: sx + tx, z: sz + tz, radius: 2.5, id: `${s.id}-tower-${tx}-${tz}` });
  }
}

function addFrontierCampCollision(s: SettlementDef, sx: number, sz: number) {
  // Ruined walls
  boxObstacles.push({ cx: sx - 30, cz: sz - 15, halfW: 1, halfD: 10, rotation: 0, id: `${s.id}-rwall-w` });
  boxObstacles.push({ cx: sx + 25, cz: sz - 13, halfW: 1, halfD: 7.5, rotation: 0, id: `${s.id}-rwall-e` });
  boxObstacles.push({ cx: sx, cz: sz - 30, halfW: 15, halfD: 1, rotation: 0, id: `${s.id}-rwall-n` });
  // Palisade - circle
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const angleDiff = Math.abs(((a - 0 + Math.PI) % (Math.PI * 2)) - Math.PI);
    if (angleDiff < 0.3) continue;
    circleObstacles.push({ x: sx + Math.cos(a) * 25, z: sz + Math.sin(a) * 25, radius: 0.35, id: `${s.id}-pal-${i}` });
  }
}

function addTradeCityCollision(s: SettlementDef, sx: number, sz: number) {
  // Walls at ±40/±35
  boxObstacles.push({ cx: sx, cz: sz - 35, halfW: 40, halfD: 1, rotation: 0, id: `${s.id}-wall-n` });
  boxObstacles.push({ cx: sx + 40, cz: sz, halfW: 1, halfD: 35, rotation: 0, id: `${s.id}-wall-e` });
  boxObstacles.push({ cx: sx - 22, cz: sz + 35, halfW: 18, halfD: 1, rotation: 0, id: `${s.id}-wall-s-l` });
  boxObstacles.push({ cx: sx + 22, cz: sz + 35, halfW: 18, halfD: 1, rotation: 0, id: `${s.id}-wall-s-r` });
  boxObstacles.push({ cx: sx - 40, cz: sz, halfW: 1, halfD: 35, rotation: 0, id: `${s.id}-wall-w` });
  for (const [tx, tz] of [[-40, -35], [40, -35], [40, 35], [-40, 35]]) {
    circleObstacles.push({ x: sx + tx, z: sz + tz, radius: 2.5, id: `${s.id}-tower-${tx}-${tz}` });
  }
  circleObstacles.push({ x: sx - 4, z: sz + 35, radius: 1.8, id: `${s.id}-gate-l` });
  circleObstacles.push({ x: sx + 4, z: sz + 35, radius: 1.8, id: `${s.id}-gate-r` });
  // Trade hall
  boxObstacles.push({ cx: sx, cz: sz - 10, halfW: 7, halfD: 6, rotation: 0, id: `${s.id}-hall` });
}

// ========== COLLISION RESOLUTION ==========

export function resolveCollision(px: number, pz: number, playerRadius: number): { x: number; z: number } {
  let x = px;
  let z = pz;

  // Multi-pass resolution: 2 iterations to handle chain push-out in dense areas
  for (let pass = 0; pass < 2; pass++) {
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
  }

  return { x, z };
}

export function isPlacementBlocked(px: number, pz: number, buildRadius: number): boolean {
  for (const obs of circleObstacles) {
    const dx = px - obs.x;
    const dz = pz - obs.z;
    if (dx * dx + dz * dz < (buildRadius + obs.radius) ** 2) return true;
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
