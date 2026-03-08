import { getTerrainHeight } from '../components/Terrain';
import { WORLD_SIZE, POIS } from '../constants';

export interface WorldResource {
  id: string;
  type: 'tree' | 'rock';
  position: [number, number, number];
  health: number;
  maxHealth: number;
  depleted: boolean;
  scale: number;
  variant: number; // 0=oak/grey, 1=pine/dark, 2=pine-tall (trees only)
  gatherable: boolean; // true = interactive, false = decoration only
  trunkHeight: number;
  crownRadius: number;
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

  // ---- TREES ----
  for (let i = 0; i < 350; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.9;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.9;
    const y = getTerrainHeight(x, z);
    if (y < 0) continue;

    // Cluster in forest
    const distToForest = Math.sqrt((x + 80) ** 2 + (z - 60) ** 2);
    const inForest = distToForest < 60;
    if (!inForest && rand() > 0.4) continue;

    const distCenter = Math.sqrt(x * x + z * z);
    if (distCenter < 12) continue;
    if (isNearPOI(x, z, 8)) continue;

    const scale = 0.8 + rand() * 0.6;
    const variant = rand() > 0.5 ? 0 : 1; // 0=oak, 1=pine
    const trunkHeight = 2 + rand() * 2;
    const crownRadius = 1.5 + rand() * 1.5;

    // ~60% gatherable, rest decorative (far ones become deco)
    const gatherable = distCenter < 160 && rand() > 0.35;

    resources.push({
      id: `tree-${i}`,
      type: 'tree',
      position: [x, y, z],
      health: 3,
      maxHealth: 3,
      depleted: false,
      scale,
      variant,
      gatherable,
      trunkHeight,
      crownRadius,
    });
  }

  // ---- ROCKS ----
  for (let i = 0; i < 150; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.85;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.85;
    const y = getTerrainHeight(x, z);
    if (y < -0.3) continue;

    const distCenter = Math.sqrt(x * x + z * z);
    const scale = 0.3 + rand() * 1.5;
    const gatherable = distCenter < 160 && scale > 0.5 && rand() > 0.3;

    resources.push({
      id: `rock-${i}`,
      type: 'rock',
      position: [x, y + scale * 0.3, z],
      health: 3,
      maxHealth: 3,
      depleted: false,
      scale,
      variant: Math.floor(rand() * 3),
      gatherable,
      trunkHeight: 0,
      crownRadius: 0,
    });
  }

  return resources;
}

export const INTERACTION_RANGE = 4;
export const GATHER_COOLDOWN = 0.5;
export const TREE_WOOD_REWARD = 2;
export const ROCK_STONE_REWARD = 2;
