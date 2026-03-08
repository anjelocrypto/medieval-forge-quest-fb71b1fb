export interface PlayerState {
  position: [number, number, number];
  velocity: [number, number, number];
  rotation: number;
  isRunning: boolean;
  isJumping: boolean;
  isGrounded: boolean;
  isMounted: boolean;
}

export interface SurvivalState {
  health: number;
  stamina: number;
  hunger: number;
  temperature: number;
}

export interface ResourceInventory {
  wood: number;
  stone: number;
  food: number;
}

export interface WorldObject {
  id: string;
  type: 'tree' | 'rock' | 'bush' | 'crate';
  position: [number, number, number];
  health: number;
  maxHealth: number;
  depleted: boolean;
}

export interface Enemy {
  id: string;
  type: 'bandit' | 'wolf' | 'guard';
  position: [number, number, number];
  health: number;
  maxHealth: number;
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';
  targetPosition: [number, number, number];
}

export interface PlacedBuilding {
  id: string;
  type: 'campfire' | 'wall' | 'shelter' | 'fence';
  position: [number, number, number];
  rotation: number;
}

export type GameMode = 'explore' | 'combat' | 'build';
