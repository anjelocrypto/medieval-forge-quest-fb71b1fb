import { getTerrainHeight } from '../components/Terrain';
import { WORLD_SIZE } from '../constants';
import { REGIONS, SETTLEMENTS, SMALL_POIS, ROADS } from '../world/RegionData';
import { LootPickup } from '../types';

export interface WorldResource {
  id: string;
  type: 'tree' | 'rock' | 'berry_bush' | 'crate';
  position: [number, number, number];
  health: number;
  maxHealth: number;
  depleted: boolean;
  scale: number;
  variant: number;
  gatherable: boolean;
  trunkHeight: number;
  crownRadius: number;
  respawnTimer?: number;
}

// ========== FOREST BIOMES ==========
interface ForestZone {
  cx: number;
  cz: number;
  radius: number;
  density: number; // trees per ~100 sq units
  type: 'dense' | 'light' | 'scattered' | 'grove';
  name: string;
}

const FOREST_ZONES: ForestZone[] = [
  // === CENTRAL WORLD (original) ===
  { cx: -210, cz: 165, radius: 70, density: 2.2, type: 'dense', name: 'Ashwood Deep' },
  { cx: -240, cz: 200, radius: 45, density: 1.8, type: 'dense', name: 'Ashwood North' },
  { cx: -175, cz: 115, radius: 35, density: 1.2, type: 'light', name: 'Ashwood Edge' },
  { cx: -260, cz: 40, radius: 50, density: 1.3, type: 'light', name: 'Western Woodland' },
  { cx: -280, cz: 130, radius: 35, density: 1.0, type: 'scattered', name: 'Far West Grove' },
  { cx: -220, cz: 250, radius: 45, density: 1.5, type: 'dense', name: 'Northern Pines' },
  { cx: 90, cz: 220, radius: 40, density: 0.9, type: 'scattered', name: 'Highland Thicket' },
  { cx: 60, cz: 260, radius: 45, density: 1.1, type: 'light', name: 'Northern Frontier' },
  { cx: 230, cz: 260, radius: 35, density: 0.7, type: 'scattered', name: 'Frostmere Pines' },
  { cx: -70, cz: 45, radius: 25, density: 0.5, type: 'grove', name: 'Capital Grove East' },
  { cx: -115, cz: 130, radius: 30, density: 0.7, type: 'light', name: 'Midland Woods' },
  { cx: 70, cz: 100, radius: 22, density: 0.5, type: 'grove', name: 'Veyra Trail Grove' },
  { cx: -230, cz: -100, radius: 40, density: 1.0, type: 'light', name: 'Greenmeadow West Woods' },
  { cx: -200, cz: -210, radius: 45, density: 0.9, type: 'scattered', name: 'Southern Wilderness' },
  { cx: -100, cz: -200, radius: 30, density: 0.6, type: 'grove', name: 'Ravenwatch Approach' },
  { cx: 260, cz: -210, radius: 40, density: 0.8, type: 'scattered', name: 'Blackthorn Frontier' },
  { cx: 160, cz: -240, radius: 35, density: 0.6, type: 'grove', name: 'Eastern Badlands Edge' },
  { cx: 115, cz: -180, radius: 28, density: 0.5, type: 'scattered', name: 'Frontier Copse' },
  { cx: 250, cz: 50, radius: 35, density: 0.6, type: 'scattered', name: 'Veyra Dead Woods' },
  { cx: 270, cz: 150, radius: 30, density: 0.5, type: 'grove', name: 'Ancient Grove' },
  { cx: -280, cz: -200, radius: 45, density: 0.9, type: 'light', name: 'SW Border Forest' },
  { cx: 285, cz: 110, radius: 35, density: 0.6, type: 'scattered', name: 'Eastern Edge' },
  { cx: 0, cz: 285, radius: 40, density: 0.8, type: 'light', name: 'Northern Border' },
  { cx: 0, cz: -285, radius: 40, density: 0.7, type: 'scattered', name: 'Southern Border' },
  { cx: 140, cz: 70, radius: 28, density: 0.6, type: 'grove', name: 'Veyra Road Grove' },
  { cx: 110, cz: 25, radius: 22, density: 0.5, type: 'scattered', name: 'Eastern Meadow Trees' },
  { cx: -30, cz: -130, radius: 30, density: 0.7, type: 'light', name: 'Southern Heartland Woods' },
  { cx: 25, cz: -160, radius: 25, density: 0.6, type: 'scattered', name: 'Badlands Approach Trees' },
  { cx: -180, cz: -30, radius: 35, density: 0.8, type: 'light', name: 'Western Trail Forest' },
  { cx: -165, cz: 50, radius: 30, density: 0.7, type: 'light', name: 'Ashwood Southern Reach' },
  { cx: 100, cz: -165, radius: 28, density: 0.5, type: 'scattered', name: 'Frontier Brush' },
  { cx: 140, cz: -200, radius: 25, density: 0.4, type: 'grove', name: 'Southern Frontier Grove' },
  { cx: -30, cz: 120, radius: 25, density: 0.6, type: 'grove', name: 'Northern Capital Grove' },
  { cx: 40, cz: 160, radius: 30, density: 0.7, type: 'light', name: 'Northern Meadow Woods' },
  { cx: -250, cz: 260, radius: 35, density: 0.6, type: 'scattered', name: 'NW Deep Forest' },
  { cx: 250, cz: -260, radius: 30, density: 0.5, type: 'scattered', name: 'SE Frontier Pines' },
  { cx: -150, cz: 250, radius: 30, density: 0.6, type: 'light', name: 'Far Northern Woods' },
  { cx: 150, cz: -270, radius: 25, density: 0.4, type: 'scattered', name: 'Deep South Trees' },

  // === EXPANDED WORLD FORESTS ===
  // Thornwall region (SW) — sparse frontier forests
  { cx: -450, cz: -500, radius: 50, density: 0.8, type: 'scattered', name: 'Thornwall Frontier Woods' },
  { cx: -550, cz: -400, radius: 40, density: 0.7, type: 'light', name: 'Thornwall Western Forest' },
  { cx: -400, cz: -380, radius: 35, density: 0.6, type: 'grove', name: 'Thornwall Approach Grove' },

  // Goldenvale region (W) — lush trading grounds
  { cx: -600, cz: 50, radius: 55, density: 1.2, type: 'dense', name: 'Goldenvale Great Forest' },
  { cx: -580, cz: 180, radius: 45, density: 1.0, type: 'light', name: 'Vale Northern Woods' },
  { cx: -480, cz: 30, radius: 35, density: 0.8, type: 'light', name: 'Trade Road Forest' },

  // Rivermoor region (NE) — wetland groves
  { cx: 500, cz: 400, radius: 45, density: 0.9, type: 'light', name: 'Rivermoor Wetland Trees' },
  { cx: 420, cz: 420, radius: 35, density: 0.7, type: 'grove', name: 'Riverside Grove' },
  { cx: 380, cz: 280, radius: 40, density: 0.8, type: 'scattered', name: 'Reed Village Copse' },

  // Stonepeak region (NW) — highland pines
  { cx: -450, cz: 550, radius: 50, density: 1.3, type: 'dense', name: 'Highland Pine Forest' },
  { cx: -350, cz: 520, radius: 40, density: 1.0, type: 'light', name: 'Mountain Approach Woods' },
  { cx: -300, cz: 400, radius: 35, density: 0.7, type: 'scattered', name: 'Peak Trail Trees' },

  // Darkhollow region (SE) — dead/sparse trees
  { cx: 600, cz: -350, radius: 40, density: 0.5, type: 'scattered', name: 'Darkhollow Dead Forest' },
  { cx: 500, cz: -450, radius: 35, density: 0.4, type: 'grove', name: 'Wasteland Copse' },
  { cx: 480, cz: -300, radius: 30, density: 0.6, type: 'scattered', name: 'Hollow Edge Trees' },

  // Travel corridor forests
  { cx: -350, cz: -280, radius: 40, density: 0.7, type: 'light', name: 'Western March Forest' },
  { cx: -300, cz: 300, radius: 45, density: 0.9, type: 'light', name: 'NW Corridor Forest' },
  { cx: 350, cz: -200, radius: 40, density: 0.6, type: 'scattered', name: 'SE Corridor Trees' },
  { cx: 300, cz: 250, radius: 35, density: 0.7, type: 'light', name: 'NE Corridor Forest' },
  { cx: -200, cz: 500, radius: 40, density: 0.8, type: 'light', name: 'Northern Route Woods' },
  { cx: 100, cz: 500, radius: 35, density: 0.7, type: 'scattered', name: 'Northern Route East' },
  { cx: 500, cz: 100, radius: 30, density: 0.5, type: 'scattered', name: 'Eastern Wilds Trees' },
  { cx: -400, cz: -150, radius: 35, density: 0.6, type: 'light', name: 'Connector Forest W' },

  // World edge fill
  { cx: -700, cz: 0, radius: 50, density: 0.5, type: 'scattered', name: 'Far West Edge' },
  { cx: 700, cz: 0, radius: 50, density: 0.4, type: 'scattered', name: 'Far East Edge' },
  { cx: 0, cz: 700, radius: 50, density: 0.6, type: 'light', name: 'Far North Edge' },
  { cx: 0, cz: -700, radius: 50, density: 0.5, type: 'scattered', name: 'Far South Edge' },
];

// ========== ROCK FORMATIONS ==========
interface RockZone {
  cx: number;
  cz: number;
  radius: number;
  density: number;
  type: 'field' | 'outcrop' | 'scattered' | 'boulders';
  name: string;
}

const ROCK_ZONES: RockZone[] = [
  // === CENTRAL WORLD (original) ===
  { cx: 180, cz: 230, radius: 50, density: 1.5, type: 'outcrop', name: 'Frostmere Crags' },
  { cx: 220, cz: 260, radius: 40, density: 1.2, type: 'field', name: 'Highland Stones' },
  { cx: 130, cz: 245, radius: 30, density: 0.9, type: 'scattered', name: 'Mountain Pass Rocks' },
  { cx: 210, cz: -175, radius: 40, density: 1.2, type: 'field', name: 'Fort Approach Stones' },
  { cx: 250, cz: -130, radius: 35, density: 1.0, type: 'outcrop', name: 'Eastern Frontier Rocks' },
  { cx: 265, cz: -230, radius: 40, density: 0.8, type: 'scattered', name: 'Badlands Boulders' },
  { cx: 220, cz: 115, radius: 40, density: 1.3, type: 'outcrop', name: 'Veyra Rubble' },
  { cx: 255, cz: 30, radius: 35, density: 1.0, type: 'field', name: 'Ancient Stones' },
  { cx: 205, cz: 158, radius: 28, density: 0.7, type: 'scattered', name: 'Veyra Path Rocks' },
  { cx: 30, cz: -225, radius: 35, density: 1.1, type: 'field', name: 'Ravenwatch Rocks' },
  { cx: 60, cz: -250, radius: 35, density: 0.8, type: 'outcrop', name: 'Southern Crags' },
  { cx: -50, cz: -245, radius: 30, density: 0.7, type: 'scattered', name: 'Bandit Stones' },
  { cx: 50, cz: 50, radius: 18, density: 0.4, type: 'scattered', name: 'Heartland Stones' },
  { cx: -40, cz: -110, radius: 22, density: 0.4, type: 'scattered', name: 'Road Boulders' },
  { cx: -270, cz: 260, radius: 40, density: 0.7, type: 'boulders', name: 'NW Corner Rocks' },
  { cx: 270, cz: 270, radius: 40, density: 0.8, type: 'outcrop', name: 'NE Mountain Edge' },
  { cx: -270, cz: -260, radius: 38, density: 0.6, type: 'scattered', name: 'SW Wilderness Stones' },
  { cx: 270, cz: -270, radius: 38, density: 0.5, type: 'boulders', name: 'SE Border Rocks' },
  { cx: 130, cz: 50, radius: 22, density: 0.5, type: 'scattered', name: 'Eastern Road Rocks' },
  { cx: 160, cz: 15, radius: 20, density: 0.6, type: 'field', name: 'Veyra Approach Stones' },
  { cx: -20, cz: -150, radius: 25, density: 0.6, type: 'scattered', name: 'Southern Heartland Rocks' },
  { cx: 40, cz: -180, radius: 22, density: 0.5, type: 'field', name: 'Ravenwatch Road Rocks' },
  { cx: -200, cz: -50, radius: 25, density: 0.5, type: 'scattered', name: 'Western Wilderness Rocks' },
  { cx: 30, cz: 145, radius: 20, density: 0.4, type: 'scattered', name: 'Northern Meadow Stones' },
  { cx: -70, cz: -160, radius: 22, density: 0.5, type: 'field', name: 'Greenmeadow-Ravenwatch Rocks' },
  { cx: 120, cz: -60, radius: 18, density: 0.4, type: 'scattered', name: 'Blackthorn Approach Rocks' },

  // === EXPANDED WORLD ROCKS ===
  // Thornwall — rugged frontier stone
  { cx: -480, cz: -480, radius: 45, density: 1.0, type: 'outcrop', name: 'Thornwall Crags' },
  { cx: -530, cz: -420, radius: 35, density: 0.8, type: 'field', name: 'Frontier Stones' },
  // Stonepeak — very rocky mountain terrain
  { cx: -420, cz: 520, radius: 55, density: 1.8, type: 'outcrop', name: 'Stonepeak Crags' },
  { cx: -380, cz: 480, radius: 40, density: 1.3, type: 'boulders', name: 'Mountain Boulders' },
  { cx: -340, cz: 540, radius: 35, density: 1.0, type: 'field', name: 'Peak Road Stones' },
  // Darkhollow — wasteland rubble
  { cx: 580, cz: -420, radius: 45, density: 1.2, type: 'field', name: 'Darkhollow Rubble' },
  { cx: 520, cz: -380, radius: 40, density: 0.9, type: 'scattered', name: 'Wasteland Stones' },
  // Rivermoor — river stones
  { cx: 470, cz: 300, radius: 30, density: 0.6, type: 'scattered', name: 'River Stones' },
  // Goldenvale — decorative stones
  { cx: -580, cz: 120, radius: 30, density: 0.5, type: 'scattered', name: 'Vale Stones' },
  // Travel corridors
  { cx: -380, cz: -300, radius: 35, density: 0.7, type: 'scattered', name: 'March Road Rocks' },
  { cx: 380, cz: -280, radius: 35, density: 0.8, type: 'field', name: 'Eastern Corridor Rocks' },
  { cx: -280, cz: 380, radius: 30, density: 0.6, type: 'scattered', name: 'NW Corridor Rocks' },
  { cx: 280, cz: 300, radius: 30, density: 0.5, type: 'scattered', name: 'NE Corridor Rocks' },
  // World edges
  { cx: -650, cz: -50, radius: 40, density: 0.4, type: 'scattered', name: 'Far West Rocks' },
  { cx: 650, cz: -50, radius: 40, density: 0.4, type: 'scattered', name: 'Far East Rocks' },
];

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function isNearSettlement(x: number, z: number, minDist: number): boolean {
  for (const s of SETTLEMENTS) {
    const d = Math.sqrt((x - s.position[0]) ** 2 + (z - s.position[1]) ** 2);
    if (d < minDist) return true;
  }
  return false;
}

function isNearRoad(x: number, z: number, minDist: number): boolean {
  for (const road of ROADS) {
    const dx = road.to[0] - road.from[0];
    const dz = road.to[1] - road.from[1];
    const len2 = dx * dx + dz * dz;
    if (len2 < 1) continue;
    const t = Math.max(0, Math.min(1, ((x - road.from[0]) * dx + (z - road.from[1]) * dz) / len2));
    const px = road.from[0] + t * dx;
    const pz = road.from[1] + t * dz;
    const dist = Math.sqrt((x - px) ** 2 + (z - pz) ** 2);
    if (dist < minDist + road.width) return true;
  }
  return false;
}

function isNearPOI(x: number, z: number, minDist: number): boolean {
  for (const poi of SMALL_POIS) {
    const d = Math.sqrt((x - poi.position[0]) ** 2 + (z - poi.position[1]) ** 2);
    if (d < minDist) return true;
  }
  return false;
}

function getForestDensityAt(x: number, z: number): { density: number; type: ForestZone['type'] } {
  let best = { density: 0, type: 'scattered' as ForestZone['type'] };
  for (const zone of FOREST_ZONES) {
    const d = Math.sqrt((x - zone.cx) ** 2 + (z - zone.cz) ** 2);
    if (d < zone.radius) {
      // Smooth falloff from center to edge
      const factor = 1 - (d / zone.radius) ** 0.7;
      const effectiveDensity = zone.density * factor;
      if (effectiveDensity > best.density) {
        best = { density: effectiveDensity, type: zone.type };
      }
    }
  }
  return best;
}

function getRockDensityAt(x: number, z: number): { density: number; type: RockZone['type'] } {
  let best = { density: 0, type: 'scattered' as RockZone['type'] };
  for (const zone of ROCK_ZONES) {
    const d = Math.sqrt((x - zone.cx) ** 2 + (z - zone.cz) ** 2);
    if (d < zone.radius) {
      const factor = 1 - (d / zone.radius) ** 0.8;
      const effectiveDensity = zone.density * factor;
      if (effectiveDensity > best.density) {
        best = { density: effectiveDensity, type: zone.type };
      }
    }
  }
  return best;
}

export function generateWorldResources(): WorldResource[] {
  const resources: WorldResource[] = [];
  const rand = seededRandom(12345);
  const half = WORLD_SIZE / 2;

  // ========== TREES ==========
  // Generate trees using forest zone density system
  const treeAttempts = 8000; // Increased for 1800x1800 world
  for (let i = 0; i < treeAttempts; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.95;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.95;
    const y = getTerrainHeight(x, z);
    
    // Skip water
    if (y < -0.3) continue;
    
    // Skip too close to center (capital area - larger exclusion)
    const distCenter = Math.sqrt(x * x + z * z);
    if (distCenter < 50) continue;
    
    // Skip near settlements (larger buffer for gates/approaches)
    if (isNearSettlement(x, z, 25)) continue;
    
    // Skip on roads (wider buffer to keep roads visible)
    if (isNearRoad(x, z, 5)) continue;
    
    // Skip near POIs (preserve visibility)
    if (isNearPOI(x, z, 6)) continue;
    
    // Get local forest density
    const forest = getForestDensityAt(x, z);
    
    // Base spawn chance depends on density
    let spawnChance = forest.density * 0.35;
    
    // Add minimum scatter everywhere (except near settlements)
    if (distCenter > 60) {
      spawnChance = Math.max(spawnChance, 0.05);
    }
    
    if (rand() > spawnChance) continue;
    
    // Variant based on forest type
    let variant = rand() > 0.5 ? 0 : 1;
    let scale = 0.7 + rand() * 0.6;
    
    if (forest.type === 'dense') {
      scale = 0.9 + rand() * 0.8;
      variant = rand() > 0.3 ? 1 : 0; // More conifers in dense
    } else if (forest.type === 'light') {
      scale = 0.8 + rand() * 0.5;
    } else if (forest.type === 'grove') {
      scale = 0.6 + rand() * 0.4;
      variant = 0; // More deciduous in groves
    }
    
    const trunkHeight = 2 + rand() * 2.5;
    const crownRadius = 1.2 + rand() * 1.8;
    const gatherable = rand() > 0.25;

    resources.push({
      id: `tree-${i}`, type: 'tree',
      position: [x, y, z], health: 3, maxHealth: 3,
      depleted: false, scale, variant, gatherable, trunkHeight, crownRadius,
    });
  }

  // ========== ROCKS ==========
  const rockAttempts = 3000; // Increased for expanded world
  for (let i = 0; i < rockAttempts; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.94;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.94;
    const y = getTerrainHeight(x, z);
    
    if (y < -0.5) continue;
    if (isNearSettlement(x, z, 20)) continue;
    if (isNearRoad(x, z, 4)) continue;
    if (isNearPOI(x, z, 5)) continue;
    
    const rock = getRockDensityAt(x, z);
    
    // Base spawn chance
    let spawnChance = rock.density * 0.3;
    
    // Higher terrain = more rocks
    if (y > 5) spawnChance += 0.1;
    if (y > 10) spawnChance += 0.15;
    
    // Minimum scatter
    spawnChance = Math.max(spawnChance, 0.03);
    
    if (rand() > spawnChance) continue;
    
    // Scale based on zone type
    let scale = 0.3 + rand() * 1.2;
    if (rock.type === 'outcrop') {
      scale = 0.8 + rand() * 2.0;
    } else if (rock.type === 'boulders') {
      scale = 1.2 + rand() * 1.5;
    } else if (rock.type === 'field') {
      scale = 0.4 + rand() * 1.0;
    }
    
    const gatherable = scale > 0.5 && rand() > 0.35;

    resources.push({
      id: `rock-${i}`, type: 'rock',
      position: [x, y + scale * 0.25, z], health: 3, maxHealth: 3,
      depleted: false, scale, variant: Math.floor(rand() * 3),
      gatherable, trunkHeight: 0, crownRadius: 0,
    });
  }

  // ========== BERRY BUSHES ==========
  // Near villages, forest edges, and groves
  const berrySpots = [
    // Near villages (NOT inside walled settlements)
    { cx: -155, cz: -125, count: 8, spread: 35 },
    { cx: -110, cz: -80, count: 5, spread: 25 },
    // Forest edges
    { cx: -160, cz: 120, count: 6, spread: 30 },
    { cx: -140, cz: 90, count: 4, spread: 20 },
    { cx: -100, cz: 60, count: 3, spread: 25 },
    // Scattered wilderness
    { cx: -80, cz: -50, count: 3, spread: 20 },
    { cx: 50, cz: -80, count: 2, spread: 20 },
    { cx: 80, cz: 120, count: 3, spread: 25 },
    { cx: -200, cz: -60, count: 4, spread: 30 },
    { cx: 100, cz: 200, count: 3, spread: 25 },
    // Trail food
    { cx: -40, cz: 0, count: 2, spread: 15 },
    { cx: 30, cz: -120, count: 2, spread: 15 },
  ];
  
  let berryId = 0;
  for (const spot of berrySpots) {
    for (let i = 0; i < spot.count; i++) {
      const angle = rand() * Math.PI * 2;
      const r = 5 + rand() * spot.spread;
      const x = spot.cx + Math.cos(angle) * r;
      const z = spot.cz + Math.sin(angle) * r;
      const y = getTerrainHeight(x, z);
      if (y < -0.2) continue;
      if (isNearSettlement(x, z, 25)) continue;
      if (isNearRoad(x, z, 2)) continue;
      
      resources.push({
        id: `berry-${berryId++}`, type: 'berry_bush',
        position: [x, y, z], health: 2, maxHealth: 2,
        depleted: false, scale: 0.5 + rand() * 0.35, variant: 0,
        gatherable: true, trunkHeight: 0, crownRadius: 0.8,
      });
    }
  }

  // ========== LOOTABLE CRATES ==========
  // Near camps, ruins, forts, and along trade routes
  const crateSpots = [
    // Near POIs
    { cx: 5, cz: -205, count: 5, spread: 15 },
    { cx: 195, cz: 95, count: 6, spread: 22 },
    { cx: 185, cz: -155, count: 5, spread: 18 },
    { cx: 160, cz: 50, count: 3, spread: 12 },
    { cx: 155, cz: 195, count: 3, spread: 15 },
    // Supply depots and camps
    { cx: 60, cz: -50, count: 3, spread: 8 },
    { cx: 130, cz: -110, count: 2, spread: 10 },
    // Roadside finds
    { cx: -70, cz: -55, count: 2, spread: 10 },
    { cx: 90, cz: -75, count: 2, spread: 8 },
    { cx: -90, cz: 65, count: 2, spread: 10 },
    { cx: 100, cz: 45, count: 2, spread: 10 },
    // Scattered wilderness
    { cx: -180, cz: 135, count: 2, spread: 15 },
    { cx: 0, cz: 0, count: 2, spread: 40 },
  ];
  
  let crateId = 0;
  for (const spot of crateSpots) {
    for (let i = 0; i < spot.count; i++) {
      const angle = rand() * Math.PI * 2;
      const r = 2 + rand() * spot.spread;
      const x = spot.cx + Math.cos(angle) * r;
      const z = spot.cz + Math.sin(angle) * r;
      const y = getTerrainHeight(x, z);
      if (y < -0.3) continue;
      if (isNearSettlement(x, z, 20)) continue;
      
      resources.push({
        id: `crate-${crateId++}`, type: 'crate',
        position: [x, y, z], health: 2, maxHealth: 2,
        depleted: false, scale: 0.45 + rand() * 0.35, variant: 0,
        gatherable: true, trunkHeight: 0, crownRadius: 0,
      });
    }
  }

  return resources;
}

export function generateLootDrop(pos: [number, number, number], enemyType: string): LootPickup[] {
  const drops: LootPickup[] = [];
  const id = `loot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  if (enemyType === 'bandit') {
    drops.push({ id: id + '-w', type: 'wood', position: [...pos], amount: 2, collected: false });
    if (Math.random() > 0.5) {
      drops.push({ id: id + '-s', type: 'stone', position: [pos[0] + 0.3, pos[1], pos[2] + 0.3], amount: 1, collected: false });
    }
    if (Math.random() > 0.7) {
      drops.push({ id: id + '-f', type: 'food', position: [pos[0] - 0.3, pos[1], pos[2] - 0.3], amount: 1, collected: false });
    }
  } else if (enemyType === 'wolf') {
    drops.push({ id: id + '-f', type: 'food', position: [...pos], amount: 2, collected: false });
  }

  return drops;
}

export const INTERACTION_RANGE = 4;
export const GATHER_COOLDOWN = 0.5;
export const TREE_WOOD_REWARD = 2;
export const ROCK_STONE_REWARD = 2;
export const BERRY_FOOD_REWARD = 2;
export const CRATE_REWARDS = { wood: 3, stone: 2, food: 1 };
