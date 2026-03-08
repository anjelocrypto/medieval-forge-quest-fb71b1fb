import { getTerrainHeight } from '../components/Terrain';
import { WORLD_SIZE, POIS } from '../constants';
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

function isNearPOI(x: number, z: number, minDist: number): boolean {
  for (const poi of Object.values(POIS)) {
    const d = Math.sqrt((x - poi.x) ** 2 + (z - poi.z) ** 2);
    if (d < minDist) return true;
  }
  return false;
}

export function generateWorldResources(): WorldResource[] {
  const resources: WorldResource[] = [];
  const rand = seededRandom(12345);

  // TREES
  for (let i = 0; i < 350; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.9;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.9;
    const y = getTerrainHeight(x, z);
    if (y < 0) continue;

    const distToForest = Math.sqrt((x + 80) ** 2 + (z - 60) ** 2);
    const inForest = distToForest < 60;
    if (!inForest && rand() > 0.4) continue;

    const distCenter = Math.sqrt(x * x + z * z);
    if (distCenter < 12) continue;
    if (isNearPOI(x, z, 8)) continue;

    const scale = 0.8 + rand() * 0.6;
    const variant = rand() > 0.5 ? 0 : 1;
    const trunkHeight = 2 + rand() * 2;
    const crownRadius = 1.5 + rand() * 1.5;
    const gatherable = distCenter < 160 && rand() > 0.35;

    resources.push({
      id: `tree-${i}`, type: 'tree',
      position: [x, y, z], health: 3, maxHealth: 3,
      depleted: false, scale, variant, gatherable, trunkHeight, crownRadius,
    });
  }

  // ROCKS
  for (let i = 0; i < 150; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.85;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.85;
    const y = getTerrainHeight(x, z);
    if (y < -0.3) continue;

    const distCenter = Math.sqrt(x * x + z * z);
    const scale = 0.3 + rand() * 1.5;
    const gatherable = distCenter < 160 && scale > 0.5 && rand() > 0.3;

    resources.push({
      id: `rock-${i}`, type: 'rock',
      position: [x, y + scale * 0.3, z], health: 3, maxHealth: 3,
      depleted: false, scale, variant: Math.floor(rand() * 3),
      gatherable, trunkHeight: 0, crownRadius: 0,
    });
  }

  // BERRY BUSHES — near village and forest edges
  const berrySpots = [
    { cx: POIS.village.x, cz: POIS.village.z, count: 5, spread: 25 },
    { cx: POIS.forest.x + 30, cz: POIS.forest.z - 20, count: 4, spread: 20 },
    { cx: 20, cz: -20, count: 3, spread: 30 },
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

  // LOOTABLE CRATES — near camps and ruins
  const crateSpots = [
    { cx: POIS.camp.x, cz: POIS.camp.z, count: 3, spread: 10 },
    { cx: POIS.ruins.x, cz: POIS.ruins.z, count: 2, spread: 15 },
    { cx: POIS.castle.x, cz: POIS.castle.z, count: 3, spread: 18 },
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

// Generate enemy loot drops
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