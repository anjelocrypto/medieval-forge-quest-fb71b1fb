import * as THREE from 'three';

// World
export const WORLD_SIZE = 500;
export const HALF_WORLD = WORLD_SIZE / 2;

// Player
export const PLAYER_SPEED = 8;
export const PLAYER_RUN_SPEED = 14;
export const PLAYER_JUMP_FORCE = 12;
export const PLAYER_HEIGHT = 1.8;
export const GRAVITY = 30;

// Camera
export const CAMERA_OFFSET = new THREE.Vector3(0, 6, 10);
export const CAMERA_LERP_SPEED = 5;

// Survival
export const MAX_HEALTH = 100;
export const MAX_STAMINA = 100;
export const MAX_HUNGER = 100;
export const MAX_TEMPERATURE = 100;
export const HUNGER_DRAIN = 0.3; // per second
export const STAMINA_DRAIN = 15; // per second while running
export const STAMINA_REGEN = 8; // per second while not running

// Colors (medieval palette)
export const COLORS = {
  grass: '#4a7c3f',
  grassDark: '#3d6634',
  dirt: '#8b7355',
  road: '#6b5b47',
  water: '#2e5c7a',
  waterDeep: '#1a3d5c',
  stone: '#7a7a7a',
  stoneDark: '#5a5a5a',
  wood: '#8b6914',
  woodDark: '#6b4f10',
  leaves: '#2d5a1e',
  leavesDark: '#1e4010',
  castle: '#a0a0a0',
  roof: '#8b3a3a',
  sand: '#c2b280',
  fog: '#8a9a7a',
  sky: '#6b8fa3',
};

// POI positions
export const POIS = {
  castle: { x: 80, z: -80, label: 'Castle Ruins' },
  village: { x: -60, z: -50, label: 'Village' },
  ruins: { x: 50, z: 70, label: 'Ancient Ruins' },
  forest: { x: -80, z: 60, label: 'Dark Forest' },
  camp: { x: 0, z: -100, label: 'Bandit Camp' },
};
