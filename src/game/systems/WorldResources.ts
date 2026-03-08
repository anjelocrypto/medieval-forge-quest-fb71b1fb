import { getTerrainHeight } from '../components/Terrain';
import { WORLD_SIZE } from '../constants';
import { REGIONS, SETTLEMENTS, SMALL_POIS } from '../world/RegionData';
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

export function generateWorldResources(): WorldResource[] {
  const resources: WorldResource[] = [];
  const rand = seededRandom(12345);
  const half = WORLD_SIZE / 2;

  // TREES — more in Ashwood, scattered elsewhere
  for (let i = 0; i < 600; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.92;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.92;
    const y = getTerrainHeight(x, z);
    if (y < 0) continue;

    const distCenter = Math.sqrt(x * x + z * z);
    if (distCenter < 15) continue;
    if (isNearSettlement(x, z, 10)) continue;

    // Dense in Ashwood
    const ashDist = Math.sqrt((x + 190) ** 2 + (z - 140) ** 2);
    const inAshwood = ashDist < 75;
    if (!inAshwood && rand() > 0.45) continue;

    const scale = 0.8 + rand() * 0.6;
    const variant = rand() > 0.5 ? 0 : 1;
    const trunkHeight = 2 + rand() * 2;
    const crownRadius = 1.5 + rand() * 1.5;
    const gatherable = rand() > 0.3;

    resources.push({
      id: `tree-${i}`, type: 'tree',
      position: [x, y, z], health: 3, maxHealth: 3,
      depleted: false, scale, variant, gatherable, trunkHeight, crownRadius,
    });
  }

  // ROCKS — more in Frostmere and Blackthorn
  for (let i = 0; i < 250; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.9;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.9;
    const y = getTerrainHeight(x, z);
    if (y < -0.3) continue;
    if (isNearSettlement(x, z, 8)) continue;

    const scale = 0.3 + rand() * 1.5;
    const gatherable = scale > 0.5 && rand() > 0.3;

    resources.push({
      id: `rock-${i}`, type: 'rock',
      position: [x, y + scale * 0.3, z], health: 3, maxHealth: 3,
      depleted: false, scale, variant: Math.floor(rand() * 3),
      gatherable, trunkHeight: 0, crownRadius: 0,
    });
  }

  // BERRY BUSHES — near villages and forest edges
  const berrySpots = [
    { cx: -155, cz: -125, count: 6, spread: 30 },
    { cx: -110, cz: -80, count: 4, spread: 20 },
    { cx: -160, cz: 120, count: 4, spread: 25 },
    { cx: 20, cz: -20, count: 3, spread: 30 },
    { cx: 0, cz: 0, count: 3, spread: 35 },
  ];
  let berryId = 0;
  for (const spot of berrySpots) {
    for (let i = 0; i < spot.count; i++) {
      const angle = rand() * Math.PI * 2;
      const r = 5 + rand() * spot.spread;
      const x = spot.cx + Math.cos(angle) * r;
      const z = spot.cz + Math.sin(angle) * r;
      const y = getTerrainHeight(x, z);
      if (y < 0) continue;
      resources.push({
        id: `berry-${berryId++}`, type: 'berry_bush',
        position: [x, y, z], health: 2, maxHealth: 2,
        depleted: false, scale: 0.6 + rand() * 0.3, variant: 0,
        gatherable: true, trunkHeight: 0, crownRadius: 0.8,
      });
    }
  }

  // LOOTABLE CRATES — near camps, ruins, forts
  const crateSpots = [
    { cx: 5, cz: -205, count: 4, spread: 12 },
    { cx: 195, cz: 95, count: 4, spread: 18 },
    { cx: 185, cz: -155, count: 3, spread: 15 },
    { cx: 160, cz: 50, count: 2, spread: 10 },
    { cx: 0, cz: 0, count: 2, spread: 30 },
  ];
  let crateId = 0;
  for (const spot of crateSpots) {
    for (let i = 0; i < spot.count; i++) {
      const angle = rand() * Math.PI * 2;
      const r = 3 + rand() * spot.spread;
      const x = spot.cx + Math.cos(angle) * r;
      const z = spot.cz + Math.sin(angle) * r;
      const y = getTerrainHeight(x, z);
      if (y < -0.2) continue;
      resources.push({
        id: `crate-${crateId++}`, type: 'crate',
        position: [x, y, z], health: 2, maxHealth: 2,
        depleted: false, scale: 0.5 + rand() * 0.3, variant: 0,
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
