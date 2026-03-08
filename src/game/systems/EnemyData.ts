import { getTerrainHeight } from '../components/Terrain';
import { REGIONS } from '../world/RegionData';

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
  hitFlash: number;
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
        damage: type === 'bandit' ? 6 : 8,
        speed: type === 'bandit' ? 4 : 6,
        detectRange: type === 'bandit' ? 15 : 12,
        attackRange: type === 'bandit' ? 2.5 : 2,
      });
    }
  };

  // Spawn enemies per region
  for (const region of REGIONS) {
    if (region.enemyCount === 0) continue;
    for (const etype of region.enemyTypes) {
      spawn(etype, region.center[0], region.center[1],
        Math.ceil(region.enemyCount / region.enemyTypes.length),
        region.enemySpread);
    }
  }

  // Roaming wolves in wilderness
  spawn('wolf', -30, 30, 2, 15);
  spawn('wolf', 80, -80, 2, 20);
  spawn('bandit', 100, -100, 2, 15);

  return enemies;
}

export const PLAYER_ATTACK_DAMAGE = 15;
export const PLAYER_ATTACK_RANGE = 3;
export const PLAYER_ATTACK_COOLDOWN = 0.5;
export const PLAYER_ATTACK_ARC = Math.PI * 0.6;
export const ENEMY_ATTACK_COOLDOWN = 1.5;
export const ENEMY_DESPAWN_TIME = 3;
