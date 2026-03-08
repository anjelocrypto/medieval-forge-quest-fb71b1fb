import { ResourceInventory } from '../types';

export type BuildableType = 'campfire' | 'wall' | 'shelter' | 'fence';

export interface BuildableConfig {
  type: BuildableType;
  label: string;
  cost: Partial<ResourceInventory>;
  size: [number, number, number]; // width, height, depth for collision
  color: string;
  description: string;
}

export const BUILDABLES: BuildableConfig[] = [
  {
    type: 'campfire',
    label: '🔥 Campfire',
    cost: { wood: 3, stone: 2 },
    size: [1.2, 0.6, 1.2],
    color: '#8b6914',
    description: 'Wood: 3, Stone: 2',
  },
  {
    type: 'wall',
    label: '🧱 Wooden Wall',
    cost: { wood: 5 },
    size: [3, 2.5, 0.3],
    color: '#7a5a14',
    description: 'Wood: 5',
  },
  {
    type: 'fence',
    label: '🪵 Fence',
    cost: { wood: 3 },
    size: [4, 1.2, 0.2],
    color: '#6b4f10',
    description: 'Wood: 3',
  },
  {
    type: 'shelter',
    label: '🏠 Shelter',
    cost: { wood: 8, stone: 3 },
    size: [4, 3, 4],
    color: '#5a3a1a',
    description: 'Wood: 8, Stone: 3',
  },
];

export interface PlacedStructure {
  id: string;
  type: BuildableType;
  position: [number, number, number];
  rotation: number;
}

export const MIN_PLACE_DISTANCE = 2; // from player
export const MAX_PLACE_DISTANCE = 8;
export const MIN_STRUCTURE_SPACING = 2;
