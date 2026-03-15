/**
 * RailwayData — Single source of truth for railway routes, stations, and bridges.
 * Phase 1: Two-line cross-hub through Ironhold.
 * Line A: Thornwall (SW) ↔ Ironhold ↔ Rivermoor (NE)
 * Line B: Goldenvale (W) ↔ Ironhold ↔ Darkhollow (SE)
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
  side: string; // which side of the kingdom
  stationType: 'capital' | 'large' | 'medium' | 'small';
  line: 'A' | 'B' | 'AB'; // which line(s)
}

export interface RailwayBridge {
  id: string;
  position: [number, number, number]; // [x, y, z]
  line: 'A' | 'B';
  crosses: string;
  length: number;
}

// ========== LINE A: Thornwall → Ironhold → Rivermoor ==========
export const LINE_A_WAYPOINTS: RailwayWaypoint[] = [
  { x: -480, z: -480, label: 'Thornwall Station', type: 'station' },
  { x: -440, z: -420, type: 'track' },
  { x: -360, z: -340, type: 'track' },
  { x: -280, z: -260, label: 'Western Marches', type: 'track' },
  { x: -200, z: -195, type: 'track' },
  { x: -130, z: -140, label: 'Greenmeadow Station', type: 'station' },
  { x: -80,  z: -70, type: 'track' },
  { x: -40,  z: 20, type: 'track' },
  { x: -15,  z: 85, label: 'Ironhold Central', type: 'station' },
  { x: 40,   z: 110, type: 'track' },
  { x: 120,  z: 140, type: 'track' },
  { x: 200,  z: 180, label: 'Frostmere Bypass', type: 'track' },
  { x: 280,  z: 240, type: 'track' },
  { x: 340,  z: 280, type: 'track' },
  { x: 380,  z: 305, label: 'Rivermoor River Bridge', type: 'bridge' },
  { x: 410,  z: 330, label: 'Rivermoor Station', type: 'station' },
];

// ========== LINE B: Goldenvale → Ironhold → Darkhollow ==========
export const LINE_B_WAYPOINTS: RailwayWaypoint[] = [
  { x: -515, z: 110, label: 'Goldenvale Station', type: 'station' },
  { x: -460, z: 105, type: 'track' },
  { x: -380, z: 95, type: 'track' },
  { x: -280, z: 88, type: 'track' },
  { x: -180, z: 85, type: 'track' },
  { x: -5,   z: 83, label: 'Great River Bridge', type: 'bridge' },
  { x: -15,  z: 85, label: 'Ironhold Central', type: 'station' },
  { x: 15,   z: 45, type: 'track' },
  { x: 60,   z: -5, type: 'track' },
  { x: 120,  z: -70, type: 'track' },
  { x: 185,  z: -120, label: 'Blackthorn Halt', type: 'station' },
  { x: 250,  z: -180, type: 'track' },
  { x: 340,  z: -260, type: 'track' },
  { x: 420,  z: -330, label: 'Darkhollow Creek Bridge', type: 'bridge' },
  { x: 500,  z: -370, type: 'track' },
  { x: 520,  z: -390, label: 'Darkhollow Station', type: 'station' },
];

// ========== STATIONS ==========
export const RAILWAY_STATIONS: RailwayStation[] = [
  { id: 'stn-thornwall', name: 'Thornwall', position: [-480, -480], side: 'south', stationType: 'large', line: 'A' },
  { id: 'stn-greenmeadow', name: 'Greenmeadow', position: [-130, -140], side: 'east', stationType: 'small', line: 'A' },
  { id: 'stn-ironhold', name: 'Ironhold Central', position: [-15, 85], side: 'south', stationType: 'capital', line: 'AB' },
  { id: 'stn-goldenvale', name: 'Goldenvale', position: [-515, 110], side: 'east', stationType: 'medium', line: 'B' },
  { id: 'stn-blackthorn', name: 'Blackthorn Halt', position: [185, -120], side: 'north', stationType: 'small', line: 'B' },
  { id: 'stn-rivermoor', name: 'Rivermoor', position: [410, 330], side: 'southwest', stationType: 'medium', line: 'A' },
  { id: 'stn-darkhollow', name: 'Darkhollow', position: [520, -390], side: 'west', stationType: 'small', line: 'B' },
];

// ========== RAILWAY BRIDGES ==========
export const RAILWAY_BRIDGES: RailwayBridge[] = [
  { id: 'rail-bridge-great-river', position: [-5, 0.5, 83], line: 'B', crosses: 'Great River', length: 24 },
  { id: 'rail-bridge-rivermoor', position: [380, 0.8, 305], line: 'A', crosses: 'Rivermoor River', length: 22 },
  { id: 'rail-bridge-darkhollow', position: [420, 0.3, -330], line: 'B', crosses: 'Darkhollow Creek', length: 16 },
];
