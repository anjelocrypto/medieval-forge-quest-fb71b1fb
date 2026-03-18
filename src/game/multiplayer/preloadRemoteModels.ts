// Preload ALL remote character GLBs after game scene mounts.
// Uses useGLTF.preload which is non-blocking and caches for later use.
// This ensures remote player models render immediately instead of showing
// gray capsule fallbacks while individual GLBs load.
import { useGLTF } from '@react-three/drei';

// Soldier GLBs
import standingUrl from '@/assets/standing.glb?url';
import soldierWalkUrl from '@/assets/soldierwalking.glb?url';
import runUrl from '@/assets/run.glb?url';
import gethitUrl from '@/assets/gethit.glb?url';
import fightUrl from '@/assets/fight.glb?url';
import jumpUrl from '@/assets/jump.glb?url';
import waveUrl from '@/assets/wave.glb?url';
import agreeUrl from '@/assets/agreegesture.glb?url';

// Goblin GLBs
import goblinStandingUrl from '@/assets/goblinstanding.glb?url';
import goblinWalkingUrl from '@/assets/goblinwalking.glb?url';
import goblinRunningUrl from '@/assets/goblinrunning.glb?url';
import goblinGetHitUrl from '@/assets/goblingethit.glb?url';
import goblinFightUrl from '@/assets/goblinfight.glb?url';
import goblinDeadUrl from '@/assets/goblindead.glb?url';
import goblinJumpUrl from '@/assets/goblinjump.glb?url';
import hiphopUrl from '@/assets/hiphop.glb?url';
import gangnamUrl from '@/assets/gangnam.glb?url';

// Octopus GLBs
import octopusStandingUrl from '@/assets/octopusstanding.glb?url';
import octopusWalkingUrl from '@/assets/octopuswalking.glb?url';
import octopusRunningUrl from '@/assets/octopusrunning.glb?url';
import octopusJumpUrl from '@/assets/octopusjump.glb?url';
import octopusGetHitUrl from '@/assets/octopusgethit.glb?url';
import octopusDieUrl from '@/assets/octopusdie.glb?url';
import octopusDanceUrl from '@/assets/octopusdance.glb?url';
import octopusKickUrl from '@/assets/octopuskick.glb?url';

// NemoClaw GLBs
import nemoStandingUrl from '@/assets/nemostanding.glb?url';
import nemoWalkingUrl from '@/assets/nemowalking.glb?url';
import nemoRunningUrl from '@/assets/nemorunning.glb?url';
import nemoGetHitUrl from '@/assets/nemogethit.glb?url';
import nemoFightUrl from '@/assets/nemofight.glb?url';
import nemoJumpUrl from '@/assets/nemojump.glb?url';
import nemoDance1Url from '@/assets/nemodance1.glb?url';
import nemoDance2Url from '@/assets/nemodance2.glb?url';

// Chillhouse GLBs
import chillhouseStandingUrl from '@/assets/chillhousestanding.glb?url';
import chillhouseWalkingUrl from '@/assets/chillhousewalking.glb?url';
import chillhouseRunningUrl from '@/assets/chillhouserunning.glb?url';
import chillhouseGetHitUrl from '@/assets/chillhousegethit.glb?url';
import chillhouseFightUrl from '@/assets/chillhousefight.glb?url';
import chillhouseDeadUrl from '@/assets/chillhousedead.glb?url';
import chillhouseJumpUrl from '@/assets/chillhousejump.glb?url';

// Horse GLBs (needed for mounted remote players)
import horseStandUrl from '@/assets/mainhorsestanding.glb?url';
import horseWalkUrl from '@/assets/mainhorsewalking.glb?url';

let preloaded = false;

/**
 * Call once after game scene mounts to warm the GLB cache for remote players.
 * Preloads ALL animation GLBs so Suspense resolves instantly when remote
 * player components mount — preventing gray capsule fallback flicker.
 * Non-blocking: uses drei's built-in preload which fetches in background.
 */
export function preloadRemoteCharacterModels() {
  if (preloaded) return;
  preloaded = true;
  console.log('[MP-Audit] Preloading ALL remote character GLBs');

  // Soldier (8 GLBs)
  useGLTF.preload(standingUrl);
  useGLTF.preload(soldierWalkUrl);
  useGLTF.preload(runUrl);
  useGLTF.preload(gethitUrl);
  useGLTF.preload(fightUrl);
  useGLTF.preload(jumpUrl);
  useGLTF.preload(waveUrl);
  useGLTF.preload(agreeUrl);

  // Goblin (9 GLBs)
  useGLTF.preload(goblinStandingUrl);
  useGLTF.preload(goblinWalkingUrl);
  useGLTF.preload(goblinRunningUrl);
  useGLTF.preload(goblinGetHitUrl);
  useGLTF.preload(goblinFightUrl);
  useGLTF.preload(goblinDeadUrl);
  useGLTF.preload(goblinJumpUrl);
  useGLTF.preload(hiphopUrl);
  useGLTF.preload(gangnamUrl);

  // Octopus (8 GLBs)
  useGLTF.preload(octopusStandingUrl);
  useGLTF.preload(octopusWalkingUrl);
  useGLTF.preload(octopusRunningUrl);
  useGLTF.preload(octopusJumpUrl);
  useGLTF.preload(octopusGetHitUrl);
  useGLTF.preload(octopusDieUrl);
  useGLTF.preload(octopusDanceUrl);
  useGLTF.preload(octopusKickUrl);

  // NemoClaw (8 GLBs)
  useGLTF.preload(nemoStandingUrl);
  useGLTF.preload(nemoWalkingUrl);
  useGLTF.preload(nemoRunningUrl);
  useGLTF.preload(nemoGetHitUrl);
  useGLTF.preload(nemoFightUrl);
  useGLTF.preload(nemoJumpUrl);
  useGLTF.preload(nemoDance1Url);
  useGLTF.preload(nemoDance2Url);

  // Chillhouse (9 GLBs — shares hiphop/gangnam with goblin, already preloaded)
  useGLTF.preload(chillhouseStandingUrl);
  useGLTF.preload(chillhouseWalkingUrl);
  useGLTF.preload(chillhouseRunningUrl);
  useGLTF.preload(chillhouseGetHitUrl);
  useGLTF.preload(chillhouseFightUrl);
  useGLTF.preload(chillhouseDeadUrl);
  useGLTF.preload(chillhouseJumpUrl);

  // Horse (2 GLBs)
  useGLTF.preload(horseStandUrl);
  useGLTF.preload(horseWalkUrl);
}
