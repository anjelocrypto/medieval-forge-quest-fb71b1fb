/**
 * RailwayData — Single source of truth for railway routes, stations, and bridges.
 * Phase 1: Two-line cross-hub through Ironhold.
 * Line A: Thornwall (SW) ↔ Ironhold ↔ Rivermoor (NE)
 * Line B: Goldenvale (W) ↔ Ironhold ↔ Darkhollow (SE)
 *
 * v2 — corrected after programmatic route validation audit.
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
  position: [number, number]; // [x, z]
  side: string;
  stationType: 'capital' | 'large' | 'medium' | 'small';
  line: 'A' | 'B' | 'AB';
}

export interface RailwayBridge {
  id: string;
  position: [number, number, number]; // [x, y, z]
  line: 'A' | 'B';
  crosses: string;
  length: number;
}

// ========== LINE A: Thornwall → Ironhold → Rivermoor (v2 corrected) ==========
export const LINE_A_WAYPOINTS: RailwayWaypoint[] = [
  { x: -455, z: -500, label: 'Thornwall Station', type: 'station' },
  { x: -430, z: -440, label: 'Thornwall departure', type: 'track' },
  { x: -400, z: -400, label: 'Thornwall outskirts', type: 'track' },
  // Western Marches — routed further south to avoid hills at [-360,-340] (was y=11.6)
  { x: -360, z: -370, type: 'track' },
  { x: -320, z: -330, type: 'track' },
  { x: -280, z: -280, label: 'Western Marches', type: 'track' },
  { x: -240, z: -240, type: 'track' },
  // Greenmeadow approach — smoother gradient
  { x: -190, z: -200, type: 'track' },
  { x: -150, z: -170, label: 'Greenmeadow Station', type: 'station' },
  // Heartland corridor toward Ironhold — flat
  { x: -110, z: -120, type: 'track' },
  { x: -70, z: -50, type: 'track' },
  { x: -50, z: 25, label: 'Heartland approach', type: 'track' },
  { x: -25, z: 90, label: 'Ironhold Central', type: 'station' },
  // NE departure — Frostmere bypass routed MUCH further south (was [200,180] y=11.6)
  { x: 30, z: 100, type: 'track' },
  { x: 90, z: 110, type: 'track' },
  { x: 160, z: 115, label: 'Frostmere Bypass south', type: 'track' },
  { x: 220, z: 120, type: 'track' },
  { x: 280, z: 160, type: 'track' },
  { x: 330, z: 220, type: 'track' },
  { x: 350, z: 260, label: 'Rivermoor approach', type: 'track' },
  { x: 370, z: 285, label: 'Rivermoor River Bridge', type: 'bridge' },
  { x: 390, z: 290, label: 'Rivermoor Station', type: 'station' },
];

// ========== LINE B: Goldenvale → Ironhold → Darkhollow (v2 corrected) ==========
export const LINE_B_WAYPOINTS: RailwayWaypoint[] = [
  { x: -500, z: 130, label: 'Goldenvale Station', type: 'station' },
  { x: -460, z: 120, type: 'track' },
  { x: -380, z: 95, type: 'track' },
  { x: -280, z: 75, type: 'track' },
  // Routed south to avoid Ashwood elevation bleed at [-180,85] (was y=8.0)
  { x: -180, z: 60, type: 'track' },
  { x: -100, z: 65, type: 'track' },
  { x: -5, z: 80, label: 'Great River Bridge', type: 'bridge' },
  { x: -25, z: 90, label: 'Ironhold Central', type: 'station' },
  // SE departure — west of Ironhold river
  { x: 5, z: 50, type: 'track' },
  { x: 40, z: 10, type: 'track' },
  // Blackthorn corridor — routed further south to avoid 62-84% grade hills
  { x: 90, z: -50, type: 'track' },
  { x: 130, z: -100, type: 'track' },
  { x: 185, z: -130, label: 'Blackthorn Halt', type: 'station' },
  // SE continuation
  { x: 230, z: -170, type: 'track' },
  { x: 290, z: -220, type: 'track' },
  { x: 340, z: -260, type: 'track' },
  { x: 420, z: -330, label: 'Darkhollow Creek Bridge', type: 'bridge' },
  { x: 500, z: -375, label: 'Darkhollow Station', type: 'station' },
];

// ========== STATIONS (v2 corrected) ==========
export const RAILWAY_STATIONS: RailwayStation[] = [
  { id: 'stn-thornwall', name: 'Thornwall', position: [-455, -500], side: 'south', stationType: 'large', line: 'A' },
  { id: 'stn-greenmeadow', name: 'Greenmeadow', position: [-150, -170], side: 'south', stationType: 'small', line: 'A' },
  { id: 'stn-ironhold', name: 'Ironhold Central', position: [-25, 90], side: 'south', stationType: 'capital', line: 'AB' },
  { id: 'stn-goldenvale', name: 'Goldenvale', position: [-500, 130], side: 'northeast', stationType: 'medium', line: 'B' },
  { id: 'stn-blackthorn', name: 'Blackthorn Halt', position: [185, -130], side: 'north', stationType: 'small', line: 'B' },
  { id: 'stn-rivermoor', name: 'Rivermoor', position: [390, 290], side: 'south', stationType: 'medium', line: 'A' },
  { id: 'stn-darkhollow', name: 'Darkhollow', position: [500, -375], side: 'west', stationType: 'small', line: 'B' },
];

// ========== RAILWAY BRIDGES (v2 — Rivermoor bridge approach adjusted) ==========
export const RAILWAY_BRIDGES: RailwayBridge[] = [
  { id: 'rail-bridge-great-river', position: [-5, 0.5, 80], line: 'B', crosses: 'Great River', length: 24 },
  { id: 'rail-bridge-rivermoor', position: [370, 0.8, 285], line: 'A', crosses: 'Rivermoor River', length: 22 },
  { id: 'rail-bridge-darkhollow', position: [420, 0.3, -330], line: 'B', crosses: 'Darkhollow Creek', length: 16 },
];
