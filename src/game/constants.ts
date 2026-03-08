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
export const HUNGER_DRAIN = 0.4; // per second — slightly faster for pressure
export const STAMINA_DRAIN = 15;
export const STAMINA_REGEN = 8;
export const TEMPERATURE_DRAIN = 0.15; // base temp loss per second (frontier is cold)
export const CAMPFIRE_WARMTH_RANGE = 12;
export const CAMPFIRE_WARMTH_RATE = 8; // temp restore per second near fire
export const SHELTER_EFFECT_RANGE = 8;
export const SHELTER_HUNGER_REDUCTION = 0.5; // multiplier on hunger drain
export const SHELTER_STAMINA_BONUS = 4; // extra regen per sec
export const LOW_HUNGER_THRESHOLD = 20; // below this, stamina regen halved
export const LOW_TEMP_THRESHOLD = 25; // below this, take cold damage
export const COLD_DAMAGE_RATE = 3; // HP per second when freezing
export const FOOD_HUNGER_RESTORE = 25;

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

// POI positions with gameplay metadata
export const POIS = {
  castle: { x: 80, z: -80, label: 'Castle Ruins', danger: 3, tempMod: -0.3, resourceBonus: 2.0 },
  village: { x: -60, z: -50, label: 'Village', danger: 0, tempMod: 0.1, resourceBonus: 1.0 },
  ruins: { x: 50, z: 70, label: 'Ancient Ruins', danger: 2, tempMod: -0.5, resourceBonus: 1.5 },
  forest: { x: -80, z: 60, label: 'Dark Forest', danger: 2, tempMod: -0.2, resourceBonus: 1.3 },
  camp: { x: 0, z: -100, label: 'Bandit Camp', danger: 2, tempMod: 0, resourceBonus: 1.5 },
};

// Zone influence radius
export const POI_ZONE_RADIUS = 40;

// Progression thresholds
export const TIER2_KILLS_REQUIRED = 5;
export const TIER2_STRUCTURES_REQUIRED = 3;