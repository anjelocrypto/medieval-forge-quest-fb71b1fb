import { getTerrainHeight } from '../components/Terrain';
import { POIS } from '../constants';

export interface EnemyData {
  id: string;
  type: 'bandit' | 'wolf';
  position: [number, number, number];
  health: number;
  maxHealth: number;
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';
  patrolCenter: [number, number, number];
  patrolRadius: number;
  patrolAngle: number;
  attackCooldown: number;
  hitFlash: number; // countdown for visual hit flash
  damage: number;
  speed: number;
  detectRange: number;
  attackRange: number;
}

export function generateEnemies(): EnemyData[] {
  const enemies: EnemyData[] = [];
  let id = 0;

  const spawn = (
    type: 'bandit' | 'wolf',
    cx: number, cz: number,
    count: number,
    spread: number,
  ) => {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const r = 3 + Math.random() * spread;
      const x = cx + Math.cos(angle) * r;
      const z = cz + Math.sin(angle) * r;
      const y = getTerrainHeight(x, z);
      enemies.push({
        id: `enemy-${id++}`,
        type,
        position: [x, y + 0.9, z],
        health: type === 'bandit' ? 30 : 20,
        maxHealth: type === 'bandit' ? 30 : 20,
        state: 'idle',
        patrolCenter: [x, y + 0.9, z],
        patrolRadius: 5 + Math.random() * 8,
        patrolAngle: Math.random() * Math.PI * 2,
        attackCooldown: 0,
        hitFlash: 0,
        damage: type === 'bandit' ? 8 : 12,
        speed: type === 'bandit' ? 4 : 6,
        detectRange: type === 'bandit' ? 15 : 12,
        attackRange: type === 'bandit' ? 2.5 : 2,
      });
    }
  };

  // Castle guards
  spawn('bandit', POIS.castle.x, POIS.castle.z, 3, 15);
  // Ruins lurkers
  spawn('bandit', POIS.ruins.x, POIS.ruins.z, 2, 10);
  // Bandit camp
  spawn('bandit', POIS.camp.x, POIS.camp.z, 3, 8);
  // Wolves in forest
  spawn('wolf', POIS.forest.x, POIS.forest.z, 4, 20);
  // Wolves roaming
  spawn('wolf', -30, 30, 2, 15);

  return enemies;
}

export const PLAYER_ATTACK_DAMAGE = 15;
export const PLAYER_ATTACK_RANGE = 3;
export const PLAYER_ATTACK_COOLDOWN = 0.6; // seconds
export const PLAYER_ATTACK_ARC = Math.PI * 0.6; // forward cone half-angle
export const ENEMY_ATTACK_COOLDOWN = 1.2;
export const ENEMY_DESPAWN_TIME = 3; // seconds after death
