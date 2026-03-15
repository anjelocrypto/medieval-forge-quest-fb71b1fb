/**
 * RailwayData — Single source of truth for railway routes, stations, and bridges.
 * Phase 1: Two-line cross-hub through Ironhold.
 * Line A: Thornwall (SW) ↔ Ironhold ↔ Rivermoor (NE)
 * Line B: Goldenvale (W) ↔ Ironhold ↔ Darkhollow (SE)
 *
 * v3 — wall collision fixes + terrain flattening support.
 */

export interface RailwayWaypoint {
  x: number;
  z: number;
  label?: string;
  type: 'track' | 'station' | 'bridge';
}

export interface RailwayStation {
  id: string;
  name: string;
  position: [number, number];
  side: string;
  stationType: 'capital' | 'large' | 'medium' | 'small';
  line: 'A' | 'B' | 'AB';
}

export interface RailwayBridge {
  id: string;
  position: [number, number, number];
  line: 'A' | 'B';
  crosses: string;
  length: number;
}

// ========== LINE A: Thornwall → Ironhold → Rivermoor (v3) ==========
export const LINE_A_WAYPOINTS: RailwayWaypoint[] = [
  { x: -455, z: -500, label: 'Thornwall Station', type: 'station' },
  { x: -430, z: -440, type: 'track' },
  { x: -400, z: -400, type: 'track' },
  { x: -360, z: -370, type: 'track' },
  { x: -320, z: -330, type: 'track' },
  { x: -280, z: -280, label: 'Western Marches', type: 'track' },
  { x: -240, z: -240, type: 'track' },
  { x: -190, z: -200, type: 'track' },
  { x: -150, z: -170, label: 'Greenmeadow Station', type: 'station' },
  { x: -110, z: -120, type: 'track' },
  { x: -70, z: -50, type: 'track' },
  { x: -50, z: 25, type: 'track' },
  { x: -25, z: 90, label: 'Ironhold Central', type: 'station' },
  { x: 30, z: 100, type: 'track' },
  { x: 90, z: 110, type: 'track' },
  // Frostmere bypass — shifted south to also avoid Old Veyra walls (center [195,95] r=45)
  { x: 150, z: 105, label: 'Frostmere Bypass', type: 'track' },
  { x: 210, z: 100, type: 'track' },
  { x: 270, z: 140, type: 'track' },
  { x: 330, z: 220, type: 'track' },
  { x: 350, z: 260, type: 'track' },
  { x: 370, z: 285, label: 'Rivermoor River Bridge', type: 'bridge' },
  { x: 390, z: 290, label: 'Rivermoor Station', type: 'station' },
];

// ========== LINE B: Goldenvale → Ironhold → Darkhollow (v3) ==========
export const LINE_B_WAYPOINTS: RailwayWaypoint[] = [
  { x: -500, z: 130, label: 'Goldenvale Station', type: 'station' },
  { x: -460, z: 120, type: 'track' },
  { x: -380, z: 95, type: 'track' },
  { x: -280, z: 75, type: 'track' },
  { x: -180, z: 60, type: 'track' },
  { x: -100, z: 65, type: 'track' },
  { x: -5, z: 80, label: 'Great River Bridge', type: 'bridge' },
  { x: -25, z: 90, label: 'Ironhold Central', type: 'station' },
  // SE departure — shifted west to stay outside Ironhold walls (45u)
  { x: -5, z: 45, type: 'track' },
  { x: 30, z: 0, type: 'track' },
  { x: 80, z: -55, type: 'track' },
  { x: 130, z: -100, type: 'track' },
  { x: 185, z: -130, label: 'Blackthorn Halt', type: 'station' },
  { x: 230, z: -170, type: 'track' },
  { x: 290, z: -220, type: 'track' },
  { x: 340, z: -260, type: 'track' },
  { x: 420, z: -330, label: 'Darkhollow Creek Bridge', type: 'bridge' },
  { x: 490, z: -370, type: 'track' },
  { x: 500, z: -375, label: 'Darkhollow Station', type: 'station' },
];

// ========== STATIONS (v3) ==========
export const RAILWAY_STATIONS: RailwayStation[] = [
  { id: 'stn-thornwall', name: 'Thornwall', position: [-455, -500], side: 'south', stationType: 'large', line: 'A' },
  { id: 'stn-greenmeadow', name: 'Greenmeadow', position: [-150, -170], side: 'south', stationType: 'small', line: 'A' },
  { id: 'stn-ironhold', name: 'Ironhold Central', position: [-25, 90], side: 'south', stationType: 'capital', line: 'AB' },
  { id: 'stn-goldenvale', name: 'Goldenvale', position: [-500, 130], side: 'northeast', stationType: 'medium', line: 'B' },
  { id: 'stn-blackthorn', name: 'Blackthorn Halt', position: [185, -130], side: 'north', stationType: 'small', line: 'B' },
  { id: 'stn-rivermoor', name: 'Rivermoor', position: [390, 290], side: 'south', stationType: 'medium', line: 'A' },
  { id: 'stn-darkhollow', name: 'Darkhollow', position: [500, -375], side: 'west', stationType: 'small', line: 'B' },
];

// ========== RAILWAY BRIDGES (v3) ==========
export const RAILWAY_BRIDGES: RailwayBridge[] = [
  { id: 'rail-bridge-great-river', position: [-5, 0.5, 80], line: 'B', crosses: 'Great River', length: 24 },
  { id: 'rail-bridge-rivermoor', position: [370, 0.8, 285], line: 'A', crosses: 'Rivermoor River', length: 22 },
  { id: 'rail-bridge-darkhollow', position: [420, 0.3, -330], line: 'B', crosses: 'Darkhollow Creek', length: 16 },
];

/**
 * Railway path segments for terrain flattening.
 * Pre-computed from waypoints for efficient distance queries.
 */
export interface RailSegment {
  ax: number; az: number;
  bx: number; bz: number;
  len2: number;
}

let _cachedSegments: RailSegment[] | null = null;

export function getRailwaySegments(): RailSegment[] {
  if (_cachedSegments) return _cachedSegments;
  const segs: RailSegment[] = [];
  const addLine = (wps: RailwayWaypoint[]) => {
    for (let i = 0; i < wps.length - 1; i++) {
      const dx = wps[i + 1].x - wps[i].x;
      const dz = wps[i + 1].z - wps[i].z;
      segs.push({
        ax: wps[i].x, az: wps[i].z,
        bx: wps[i + 1].x, bz: wps[i + 1].z,
        len2: dx * dx + dz * dz,
      });
    }
  };
  addLine(LINE_A_WAYPOINTS);
  addLine(LINE_B_WAYPOINTS);
  _cachedSegments = segs;
  return segs;
}

/**
 * Get distance from point to nearest railway track segment.
 * Returns [distance, interpolatedFraction] or null if > maxDist.
 */
export function distToRailway(x: number, z: number, maxDist: number = 12): number | null {
  const segs = getRailwaySegments();
  let best = maxDist + 1;
  for (const seg of segs) {
    if (seg.len2 < 1) continue;
    const dx = seg.bx - seg.ax, dz = seg.bz - seg.az;
    const t = Math.max(0, Math.min(1, ((x - seg.ax) * dx + (z - seg.az) * dz) / seg.len2));
    const px = seg.ax + t * dx, pz = seg.az + t * dz;
    const dist = Math.sqrt((x - px) ** 2 + (z - pz) ** 2);
    if (dist < best) best = dist;
  }
  return best <= maxDist ? best : null;
}
