import { getTerrainHeight } from '../components/Terrain';
import { POIS } from '../constants';

export interface HorseData {
  id: string;
  position: [number, number, number];
  rotation: number;
  isMounted: boolean;
}

export const HORSE_SPEED = 22;
export const HORSE_RUN_SPEED = 32;
export const MOUNT_RANGE = 4;
export const DISMOUNT_OFFSET = 2.5;
export const HORSE_CAMERA_DISTANCE_BONUS = 4;
export const HORSE_CAMERA_HEIGHT_BONUS = 1.5;

export function generateHorses(): HorseData[] {
  const horses: HorseData[] = [];

  // Near village
  const vx = POIS.village.x + 12;
  const vz = POIS.village.z + 8;
  horses.push({
    id: 'horse-village',
    position: [vx, getTerrainHeight(vx, vz), vz],
    rotation: Math.PI * 0.3,
    isMounted: false,
  });

  // Near road between camp and castle
  const rx = 40;
  const rz = -40;
  horses.push({
    id: 'horse-road',
    position: [rx, getTerrainHeight(rx, rz), rz],
    rotation: -Math.PI * 0.2,
    isMounted: false,
  });

  // Near player spawn area
  const sx = 15;
  const sz = 10;
  horses.push({
    id: 'horse-spawn',
    position: [sx, getTerrainHeight(sx, sz), sz],
    rotation: 0,
    isMounted: false,
  });

  return horses;
}
