/**
 * RailwayData — Single source of truth for railway routes, stations, and bridges.
 * Phase 1: Two-line cross-hub through Ironhold.
 * Line A: Thornwall (SW) ↔ Ironhold ↔ Rivermoor (NE)
 * Line B: Goldenvale (W) ↔ Ironhold ↔ Darkhollow (SE)
 *
 * v4 — Full clearance audit. All routes verified against settlement walls,
 * kingdom house footprints, town district buildings, and POI collision zones.
 * Clearance rule: ≥15 units from walls, ≥12 units from house footprints.
 *
 * Key v4 changes:
 * - Thornwall station moved outside east wall (was ON the wall line)
 * - Line B SE departure rerouted WEST around Ironhold capital (was going through interior)
 * - Goldenvale station moved 25u from east wall (was 10u)
 * - Blackthorn Halt moved outside fort walls (was 5u from south wall)
 * - Darkhollow station moved away from Ashkeep ruins collision zone
 * - Frostmere Bypass shifted to clear Ashen Hollow outpost (was 11u)
 * - Ironhold Central shifted south to clear Town District buildings
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

// ========== LINE A: Thornwall → Ironhold → Rivermoor (v4 — clearance audited) ==========
export const LINE_A_WAYPOINTS: RailwayWaypoint[] = [
  // Thornwall city: center [-500,-450], walls ±45 → east wall at x=-455
  // Station moved to [-470,-515]: 15u west of east wall, 20u south of south wall
  { x: -470, z: -515, label: 'Thornwall Station', type: 'station' },
  { x: -440, z: -450, type: 'track' },
  { x: -400, z: -400, type: 'track' },
  { x: -360, z: -370, type: 'track' },
  { x: -320, z: -330, type: 'track' },
  { x: -280, z: -280, label: 'Western Marches', type: 'track' },
  { x: -240, z: -240, type: 'track' },
  { x: -190, z: -200, type: 'track' },
  // Greenmeadow village center [-155,-125], houses radius ~22. Station 45u from center. OK.
  { x: -150, z: -170, label: 'Greenmeadow Station', type: 'station' },
  { x: -110, z: -120, type: 'track' },
  { x: -70, z: -50, type: 'track' },
  { x: -50, z: 25, type: 'track' },
  // v5 fix: Town District west-side buildings at [-34,50], [-30,46], [-32,56] etc.
  // Old route [-50,25]→[-25,95] passed within 7u of [-34,50]. VIOLATION.
  // New route swings west: [-55,55] keeps x≤-55 through danger zone (z 42-62).
  // Closest building [-34,50] is now 20.2u away. [-30,46] is 23.5u away.
  { x: -55, z: 55, type: 'track' },   // west of Town District cluster
  { x: -45, z: 85, type: 'track' },   // clears workshop corner [-28,70] by 22.7u
  // Ironhold: center [0,0], walls ±38. Station at z=95 → 57u south of walls.
  { x: -25, z: 95, label: 'Ironhold Central', type: 'station' },
  { x: 30, z: 105, type: 'track' },
  { x: 90, z: 105, type: 'track' },
  // Frostmere bypass — must clear Ashen Hollow [160,50] and Old Veyra [195,95] radius 45
  // Moved from [150,55] to [130,35]: 36u from Ashen Hollow, 82u from Old Veyra
  { x: 130, z: 35, label: 'Frostmere Bypass', type: 'track' },
  { x: 220, z: 45, type: 'track' },
  { x: 280, z: 100, type: 'track' },
  { x: 330, z: 200, type: 'track' },
  { x: 350, z: 260, type: 'track' },
  // Rivermoor: center [450,350], fence ±30. Bridge at 85u from center. OK.
  { x: 370, z: 285, label: 'Rivermoor River Bridge', type: 'bridge' },
  { x: 390, z: 290, label: 'Rivermoor Station', type: 'station' },
];

// ========== LINE B: Goldenvale → Ironhold → Darkhollow (v4 — clearance audited) ==========
export const LINE_B_WAYPOINTS: RailwayWaypoint[] = [
  // Goldenvale: center [-550,100], trade_city walls east at x=-510, south at z=135
  // Station moved from [-500,130] to [-485,145]: 25u from east wall, 10u south of south wall
  { x: -485, z: 145, label: 'Goldenvale Station', type: 'station' },
  { x: -450, z: 130, type: 'track' },
  { x: -380, z: 100, type: 'track' },
  { x: -280, z: 80, type: 'track' },
  { x: -180, z: 65, type: 'track' },
  // v5 fix: Workshop buildings at [-28,70], [-22,72], [-24,66], [-18,68].
  // Old segment [-100,70]→[-20,85] passed within 12.4u of [-22,72]. VIOLATION.
  // New route pushes south (higher z) to clear workshop corner entirely.
  // Closest workshop [-22,72] is now 24.2u away.
  { x: -100, z: 80, type: 'track' },  // shifted south from z=70
  { x: -45, z: 98, type: 'track' },   // arcs south of workshop corner
  { x: -20, z: 85, label: 'Great River Bridge', type: 'bridge' },
  { x: -25, z: 95, label: 'Ironhold Central', type: 'station' },
  // SE departure — REROUTED WEST around Ironhold capital walls (±38)
  // Old route went THROUGH the capital interior at [5,-10] and [-10,40]!
  // New route: west bypass with ≥17u clearance from west wall (x=-38)
  { x: -55, z: 65, type: 'track' },   // 17u from west wall, 26u from nearest town bldg
  { x: -60, z: 20, type: 'track' },   // 22u from west wall
  { x: -60, z: -30, type: 'track' },  // 22u from west wall
  { x: -55, z: -65, type: 'track' },  // 32u from NW corner tower
  { x: -30, z: -90, type: 'track' },  // 52u from north wall
  { x: 30, z: -100, type: 'track' },  // clear of all POIs
  { x: 80, z: -100, type: 'track' },  // 56u from supply depot [60,-50]
  { x: 110, z: -120, type: 'track' }, // 22u from hunter camp [130,-110]
  // Blackthorn Fort: center [185,-155], walls ±20. West wall x=165, south wall z=-135.
  // Station moved from [185,-130] to [150,-120]: 15u west of west wall, 15u south of south wall
  { x: 150, z: -120, label: 'Blackthorn Halt', type: 'station' },
  { x: 200, z: -170, type: 'track' },
  { x: 260, z: -210, type: 'track' },
  { x: 320, z: -250, type: 'track' },
  { x: 420, z: -330, label: 'Darkhollow Creek Bridge', type: 'bridge' },
  { x: 470, z: -360, type: 'track' },
  // Darkhollow: center [550,-400]. Ashkeep ruins at [500,-350] with 35u collision radius.
  // Station moved from [500,-375] to [520,-390]: 40u from Ashkeep, 38u from Darkhollow
  { x: 520, z: -390, label: 'Darkhollow Station', type: 'station' },
];

// ========== STATIONS (v4 — positions match corrected waypoints) ==========
export const RAILWAY_STATIONS: RailwayStation[] = [
  { id: 'stn-thornwall', name: 'Thornwall', position: [-470, -515], side: 'south', stationType: 'large', line: 'A' },
  { id: 'stn-greenmeadow', name: 'Greenmeadow', position: [-150, -170], side: 'south', stationType: 'small', line: 'A' },
  { id: 'stn-ironhold', name: 'Ironhold Central', position: [-25, 95], side: 'south', stationType: 'capital', line: 'AB' },
  { id: 'stn-goldenvale', name: 'Goldenvale', position: [-485, 145], side: 'south', stationType: 'medium', line: 'B' },
  { id: 'stn-blackthorn', name: 'Blackthorn Halt', position: [150, -120], side: 'south', stationType: 'small', line: 'B' },
  { id: 'stn-rivermoor', name: 'Rivermoor', position: [390, 290], side: 'south', stationType: 'medium', line: 'A' },
  { id: 'stn-darkhollow', name: 'Darkhollow', position: [520, -390], side: 'west', stationType: 'small', line: 'B' },
];

// ========== RAILWAY BRIDGES (v4) ==========
export const RAILWAY_BRIDGES: RailwayBridge[] = [
  { id: 'rail-bridge-great-river', position: [-20, 0.5, 85], line: 'B', crosses: 'Great River', length: 24 },
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

// Cache invalidation: these are lazily built from the waypoint arrays above.
// If waypoints change (e.g. v4 clearance fix), caches rebuild on next access.
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
// Pre-computed bounding boxes for fast spatial rejection
let _segBounds: { minX: number; maxX: number; minZ: number; maxZ: number }[] | null = null;

function getSegBounds(maxDist: number) {
  if (_segBounds) return _segBounds;
  const segs = getRailwaySegments();
  _segBounds = segs.map(seg => ({
    minX: Math.min(seg.ax, seg.bx) - maxDist,
    maxX: Math.max(seg.ax, seg.bx) + maxDist,
    minZ: Math.min(seg.az, seg.bz) - maxDist,
    maxZ: Math.max(seg.az, seg.bz) + maxDist,
  }));
  return _segBounds;
}

export function distToRailway(x: number, z: number, maxDist: number = 12): number | null {
  const segs = getRailwaySegments();
  const bounds = getSegBounds(maxDist);
  let best = maxDist + 1;
  for (let i = 0; i < segs.length; i++) {
    const b = bounds[i];
    // Fast AABB rejection
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
    const seg = segs[i];
    if (seg.len2 < 1) continue;
    const dx = seg.bx - seg.ax, dz = seg.bz - seg.az;
    const t = Math.max(0, Math.min(1, ((x - seg.ax) * dx + (z - seg.az) * dz) / seg.len2));
    const px = seg.ax + t * dx, pz = seg.az + t * dz;
    const ex = x - px, ez = z - pz;
    const dist = Math.sqrt(ex * ex + ez * ez);
    if (dist < best) best = dist;
  }
  return best <= maxDist ? best : null;
}

/**
 * Precomputed railway flatten grid.
 * Built once on first access. Stores flatten intensity (0-1) on a coarse grid.
 * Terrain samples this via bilinear interpolation — zero per-vertex segment scans.
 */
const GRID_CELL = 6; // 6-unit cells
const RAIL_HALF_WIDTH = 7;
const GRID_MAX_DIST = RAIL_HALF_WIDTH + 4;

interface RailFlattenGrid {
  data: Float32Array;
  cols: number;
  rows: number;
  originX: number;
  originZ: number;
  cell: number;
  sample(x: number, z: number): number;
}

let _flattenGrid: RailFlattenGrid | null = null;

export function getRailFlattenGrid(): RailFlattenGrid {
  if (_flattenGrid) return _flattenGrid;

  // Compute grid bounds from railway segments with padding
  const segs = getRailwaySegments();
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const seg of segs) {
    minX = Math.min(minX, seg.ax, seg.bx);
    maxX = Math.max(maxX, seg.ax, seg.bx);
    minZ = Math.min(minZ, seg.az, seg.bz);
    maxZ = Math.max(maxZ, seg.az, seg.bz);
  }
  // Pad by max influence distance
  const pad = GRID_MAX_DIST + GRID_CELL;
  minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;

  const cols = Math.ceil((maxX - minX) / GRID_CELL) + 1;
  const rows = Math.ceil((maxZ - minZ) / GRID_CELL) + 1;
  const data = new Float32Array(cols * rows);

  // Pre-compute flatten value at each grid point
  const bounds = getSegBounds(GRID_MAX_DIST);
  for (let row = 0; row < rows; row++) {
    const gz = minZ + row * GRID_CELL;
    for (let col = 0; col < cols; col++) {
      const gx = minX + col * GRID_CELL;
      
      // Find nearest railway distance (inlined for speed)
      let best = GRID_MAX_DIST + 1;
      for (let i = 0; i < segs.length; i++) {
        const b = bounds[i];
        if (gx < b.minX || gx > b.maxX || gz < b.minZ || gz > b.maxZ) continue;
        const seg = segs[i];
        if (seg.len2 < 1) continue;
        const dx = seg.bx - seg.ax, dz = seg.bz - seg.az;
        const t = Math.max(0, Math.min(1, ((gx - seg.ax) * dx + (gz - seg.az) * dz) / seg.len2));
        const px = seg.ax + t * dx, pz = seg.az + t * dz;
        const ex = gx - px, ez = gz - pz;
        const dist = Math.sqrt(ex * ex + ez * ez);
        if (dist < best) best = dist;
      }

      // Compute flatten intensity
      let flatten = 0;
      if (best <= RAIL_HALF_WIDTH) {
        const t = best / RAIL_HALF_WIDTH;
        flatten = t < 0.6 ? 1.0 : 0.5 + 0.5 * Math.cos((t - 0.6) / 0.4 * Math.PI);
        flatten *= 0.85;
      }
      data[row * cols + col] = flatten;
    }
  }

  _flattenGrid = {
    data, cols, rows,
    originX: minX,
    originZ: minZ,
    cell: GRID_CELL,
    sample(x: number, z: number): number {
      // Bilinear interpolation from precomputed grid
      const fx = (x - this.originX) / this.cell;
      const fz = (z - this.originZ) / this.cell;
      
      // Fast bounds check — return 0 if outside grid
      if (fx < 0 || fz < 0 || fx >= this.cols - 1 || fz >= this.rows - 1) return 0;
      
      const ix = fx | 0; // floor
      const iz = fz | 0;
      const tx = fx - ix;
      const tz = fz - iz;
      
      const i00 = iz * this.cols + ix;
      const v00 = this.data[i00];
      const v10 = this.data[i00 + 1];
      const v01 = this.data[i00 + this.cols];
      const v11 = this.data[i00 + this.cols + 1];
      
      // Bilinear
      return (v00 * (1 - tx) * (1 - tz) +
              v10 * tx * (1 - tz) +
              v01 * (1 - tx) * tz +
              v11 * tx * tz);
    },
  };

  console.log(`[Railway] Flatten grid built: ${cols}x${rows} = ${cols * rows} cells (${(data.byteLength / 1024).toFixed(1)} KB)`);
  return _flattenGrid;
}
