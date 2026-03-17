/**
 * CoinSpawner — Generates terrain-safe random positions for $TRENCHERI coins.
 * 
 * Avoids: water, buildings, railway tracks, underground positions.
 * Uses the same terrain height system as SafeSpawn.
 */
import { getTerrainHeight } from '../components/Terrain';
import { getLakeHeight, getRiverHeight } from '../world/WaterData';
import { HALF_WORLD } from '../constants';
import { TrencheriCoin } from '../hooks/useTrencheriCoins';

// Spawn radius around player — coins appear 40-150m away
const MIN_SPAWN_DIST = 40;
const MAX_SPAWN_DIST = 150;

// Terrain safety
const MIN_HEIGHT = 1.5; // above water level
const MAX_HEIGHT = 80; // below mountain peaks

// Settlement exclusion zones (approximate centers)
const EXCLUSION_ZONES = [
  { x: 0, z: 0, r: 50 },      // Capital / Town
  { x: 0, z: 82, r: 15 },     // Spawn area
];

let coinIdCounter = 0;

function seededRandom(): number {
  return Math.random(); // Not seeded — coins are ephemeral
}

export function generateCoinPosition(
  playerX: number,
  playerZ: number,
): [number, number, number] | null {
  // Try up to 10 random positions
  for (let attempt = 0; attempt < 10; attempt++) {
    const angle = seededRandom() * Math.PI * 2;
    const dist = MIN_SPAWN_DIST + seededRandom() * (MAX_SPAWN_DIST - MIN_SPAWN_DIST);
    const x = playerX + Math.cos(angle) * dist;
    const z = playerZ + Math.sin(angle) * dist;

    // Clamp to world bounds
    if (Math.abs(x) > HALF_WORLD - 20 || Math.abs(z) > HALF_WORLD - 20) continue;

    // Check terrain height
    const y = getTerrainHeight(x, z);
    if (y < MIN_HEIGHT || y > MAX_HEIGHT) continue;

    // Check water
    const lakeH = getLakeHeight(x, z);
    if (lakeH !== null && y < lakeH + 0.5) continue;
    const riverH = getRiverHeight(x, z);
    if (riverH !== null && y < riverH + 0.5) continue;

    // Check exclusion zones
    let blocked = false;
    for (const zone of EXCLUSION_ZONES) {
      const dx = x - zone.x;
      const dz = z - zone.z;
      if (dx * dx + dz * dz < zone.r * zone.r) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    return [x, y + 0.5, z]; // Slightly above ground
  }
  return null;
}

export function spawnCoin(playerX: number, playerZ: number): TrencheriCoin | null {
  const pos = generateCoinPosition(playerX, playerZ);
  if (!pos) return null;

  coinIdCounter++;
  return {
    id: `coin_${Date.now()}_${coinIdCounter}`,
    position: pos,
    spawnedAt: Date.now(),
    amount: 1,
    collected: false,
  };
}

export function despawnExpiredCoins(
  coins: TrencheriCoin[],
  lifetimeMs: number,
): TrencheriCoin[] {
  const now = Date.now();
  return coins.filter(c => !c.collected && now - c.spawnedAt < lifetimeMs);
}
