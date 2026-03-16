// Preload the most common remote character GLBs after game scene mounts.
// Uses useGLTF.preload which is non-blocking and caches for later use.
import { useGLTF } from '@react-three/drei';

// Soldier GLBs
import standingUrl from '@/assets/standing.glb?url';
import soldierWalkUrl from '@/assets/soldierwalking.glb?url';
import runUrl from '@/assets/run.glb?url';

// Goblin GLBs
import goblinStandingUrl from '@/assets/goblinstanding.glb?url';
import goblinWalkingUrl from '@/assets/goblinwalking.glb?url';
import goblinRunningUrl from '@/assets/goblinrunning.glb?url';

// Octopus GLBs
import octopusStandingUrl from '@/assets/octopusstanding.glb?url';
import octopusWalkingUrl from '@/assets/octopuswalking.glb?url';

// NemoClaw GLBs
import nemoStandingUrl from '@/assets/nemostanding.glb?url';
import nemoWalkingUrl from '@/assets/nemowalking.glb?url';

// Horse GLBs (needed for mounted remote players)
import horseStandUrl from '@/assets/mainhorsestanding.glb?url';
import horseWalkUrl from '@/assets/mainhorsewalking.glb?url';

let preloaded = false;

/**
 * Call once after game scene mounts to warm the GLB cache for remote players.
 * Only preloads idle/walk/run (the most common states) — not all animation GLBs.
 * Non-blocking: uses drei's built-in preload which fetches in background.
 */
export function preloadRemoteCharacterModels() {
  if (preloaded) return;
  preloaded = true;
  console.log('[MP-Audit] Preloading remote character GLBs (idle/walk/run)');

  // Soldier
  useGLTF.preload(standingUrl);
  useGLTF.preload(soldierWalkUrl);
  useGLTF.preload(runUrl);

  // Goblin
  useGLTF.preload(goblinStandingUrl);
  useGLTF.preload(goblinWalkingUrl);
  useGLTF.preload(goblinRunningUrl);

  // Octopus
  useGLTF.preload(octopusStandingUrl);
  useGLTF.preload(octopusWalkingUrl);

  // NemoClaw
  useGLTF.preload(nemoStandingUrl);
  useGLTF.preload(nemoWalkingUrl);

  // Horse (for mounted remote players)
  useGLTF.preload(horseStandUrl);
  useGLTF.preload(horseWalkUrl);
}
