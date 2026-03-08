import { useMemo } from 'react';
import { getTerrainHeight } from '../components/Terrain';
import { WORLD_SIZE } from '../constants';

export interface GatherableResource {
  id: string;
  type: 'tree' | 'rock';
  position: [number, number, number];
  health: number;
  maxHealth: number;
  depleted: boolean;
  scale: number;
  variant: number; // visual variant index
}

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function generateGatherables(): GatherableResource[] {
  const resources: GatherableResource[] = [];
  const rand = seededRandom(55555);

  // Gatherable trees (subset of decorative trees, placed near player paths)
  for (let i = 0; i < 80; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.7;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y < 0) continue;
    const distCenter = Math.sqrt(x * x + z * z);
    if (distCenter < 10) continue;

    resources.push({
      id: `tree-${i}`,
      type: 'tree',
      position: [x, y, z],
      health: 3,
      maxHealth: 3,
      depleted: false,
      scale: 0.9 + rand() * 0.4,
      variant: Math.floor(rand() * 2),
    });
  }

  // Gatherable rocks
  for (let i = 0; i < 50; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.7;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y < -0.3) continue;

    resources.push({
      id: `rock-${i}`,
      type: 'rock',
      position: [x, y, z],
      health: 3,
      maxHealth: 3,
      depleted: false,
      scale: 0.5 + rand() * 0.8,
      variant: Math.floor(rand() * 3),
    });
  }

  return resources;
}

export const INTERACTION_RANGE = 4;
export const GATHER_COOLDOWN = 0.5; // seconds between hits
export const TREE_WOOD_REWARD = 2;
export const ROCK_STONE_REWARD = 2;
