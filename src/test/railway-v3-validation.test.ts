/**
 * Railway v3 Re-Validation — with terrain flattening
 */
import { describe, it, expect } from 'vitest';

function noise2D(x: number, z: number, scale: number = 1, seed: number = 0): number {
  const nx = (x + seed) * scale;
  const nz = (z + seed) * scale;
  return (Math.sin(nx * 1.7 + nz * 3.1) * 0.5 +
          Math.sin(nx * 0.8 - nz * 1.3) * 0.3 +
          Math.cos(nx * 2.1 + nz * 0.7) * 0.2);
}

function getRegionalHeight(x: number, z: number): number {
  let mod = 0;
  const frostDist = Math.sqrt((x - 160) ** 2 + (z - 200) ** 2);
  if (frostDist < 100) mod += (1 - frostDist / 100) * 12;
  const ashDist = Math.sqrt((x + 190) ** 2 + (z - 140) ** 2);
  if (ashDist < 80) mod += (1 - ashDist / 80) * 3;
  const greenDist = Math.sqrt((x + 160) ** 2 + (z + 130) ** 2);
  if (greenDist < 70) mod -= (1 - greenDist / 70) * 4;
  const stonepeakDist = Math.sqrt((x + 400) ** 2 + (z - 500) ** 2);
  if (stonepeakDist < 120) mod += (1 - stonepeakDist / 120) * 18;
  const thornDist = Math.sqrt((x + 500) ** 2 + (z + 450) ** 2);
  if (thornDist < 100) mod += (1 - thornDist / 100) * 6;
  const riverDist = Math.sqrt((x - 450) ** 2 + (z - 350) ** 2);
  if (riverDist < 100) mod -= (1 - riverDist / 100) * 3;
  const darkDist = Math.sqrt((x - 550) ** 2 + (z + 400) ** 2);
  if (darkDist < 100) mod += (1 - darkDist / 100) * 2;
  const goldDist = Math.sqrt((x + 550) ** 2 + (z - 100) ** 2);
  if (goldDist < 100) mod -= (1 - goldDist / 100) * 2;
  const northDist = Math.sqrt(x ** 2 + (z - 500) ** 2);
  if (northDist < 100) mod += (1 - northDist / 100) * 8;
  return mod;
}

const SETTLEMENTS = [
  { position: [0, 0], size: 'large' }, { position: [-155, -125], size: 'medium' },
  { position: [185, -155], size: 'medium' }, { position: [195, 95], size: 'large' },
  { position: [5, -205], size: 'medium' }, { position: [-185, 135], size: 'small' },
  { position: [155, 195], size: 'small' }, { position: [160, 50], size: 'small' },
  { position: [-110, -80], size: 'small' }, { position: [-500, -450], size: 'large' },
  { position: [450, 350], size: 'large' }, { position: [-400, 500], size: 'large' },
  { position: [550, -400], size: 'large' }, { position: [-550, 100], size: 'large' },
  { position: [-440, -400], size: 'small' }, { position: [400, 300], size: 'small' },
  { position: [-350, 450], size: 'small' }, { position: [500, -350], size: 'medium' },
  { position: [-500, 150], size: 'small' },
] as const;

// Railway segments for flattening (inline from RailwayData v3)
const LINE_A = [
  { x: -455, z: -500 }, { x: -430, z: -440 }, { x: -400, z: -400 },
  { x: -360, z: -370 }, { x: -320, z: -330 }, { x: -280, z: -280 },
  { x: -240, z: -240 }, { x: -190, z: -200 }, { x: -150, z: -170 },
  { x: -110, z: -120 }, { x: -70, z: -50 }, { x: -50, z: 25 },
  { x: -25, z: 90 }, { x: 30, z: 100 }, { x: 90, z: 110 },
  { x: 150, z: 105 }, { x: 210, z: 100 }, { x: 270, z: 140 },
  { x: 330, z: 220 }, { x: 350, z: 260 }, { x: 370, z: 285 },
  { x: 390, z: 290 },
];
const LINE_B = [
  { x: -500, z: 130 }, { x: -460, z: 120 }, { x: -380, z: 95 },
  { x: -280, z: 75 }, { x: -180, z: 60 }, { x: -100, z: 65 },
  { x: -5, z: 80 }, { x: -25, z: 90 }, { x: -5, z: 45 },
  { x: 30, z: 0 }, { x: 80, z: -55 }, { x: 130, z: -100 },
  { x: 185, z: -130 }, { x: 230, z: -170 }, { x: 290, z: -220 },
  { x: 340, z: -260 }, { x: 420, z: -330 }, { x: 490, z: -370 },
  { x: 500, z: -375 },
];

interface RailSeg { ax: number; az: number; bx: number; bz: number; len2: number; }
let _segs: RailSeg[] | null = null;
function getRailSegs(): RailSeg[] {
  if (_segs) return _segs;
  const s: RailSeg[] = [];
  const add = (wps: typeof LINE_A) => {
    for (let i = 0; i < wps.length - 1; i++) {
      const dx = wps[i+1].x - wps[i].x, dz = wps[i+1].z - wps[i].z;
      s.push({ ax: wps[i].x, az: wps[i].z, bx: wps[i+1].x, bz: wps[i+1].z, len2: dx*dx+dz*dz });
    }
  };
  add(LINE_A); add(LINE_B);
  _segs = s;
  return s;
}

function distToRailway(x: number, z: number, maxDist: number = 12): number | null {
  const segs = getRailSegs();
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

function getTerrainHeight(x: number, z: number): number {
  const h1 = noise2D(x, z, 0.008, 42) * 15;
  const h2 = noise2D(x, z, 0.02, 17) * 5;
  const h3 = noise2D(x, z, 0.05, 99) * 2;
  const distFromCenter = Math.sqrt(x * x + z * z);
  const flattenFactor = Math.max(0, 1 - distFromCenter / 40);
  let settleFlatten = 0;
  for (const s of SETTLEMENTS) {
    const sd = Math.sqrt((x - s.position[0]) ** 2 + (z - s.position[1]) ** 2);
    const flatR = s.size === 'large' ? 70 : s.size === 'medium' ? 35 : 25;
    if (sd < flatR) {
      const t = sd / flatR;
      const f = t < 0.85 ? 1.0 : Math.max(0, 1 - (t - 0.85) / 0.15);
      settleFlatten = Math.max(settleFlatten, f * 0.97);
    }
  }
  const baseHeight = (h1 + h2 + h3) * (1 - flattenFactor * 0.8);
  const regional = getRegionalHeight(x, z) * 1.25;
  const rawHeight = (baseHeight + regional) * (1 - settleFlatten) + regional * settleFlatten * 0.3;

  // Railway corridor flattening
  let railFlatten = 0;
  const RAIL_HALF_WIDTH = 7;
  const railDist = distToRailway(x, z, RAIL_HALF_WIDTH + 4);
  if (railDist !== null && railDist < RAIL_HALF_WIDTH) {
    const t = railDist / RAIL_HALF_WIDTH;
    railFlatten = t < 0.6 ? 1.0 : 0.5 + 0.5 * Math.cos((t - 0.6) / 0.4 * Math.PI);
    railFlatten *= 0.85;
  }
  const railTarget = regional * 0.3;
  let height = rawHeight * (1 - railFlatten) + railTarget * railFlatten;

  const combinedFlatten = Math.max(settleFlatten, railFlatten);
  if (combinedFlatten < 0.3) {
    const stepStrength = 1 - combinedFlatten / 0.3;
    const stepped = Math.round(height * 2.5) / 2.5;
    height = height + (stepped - height) * stepStrength * 0.7;
  }
  return Math.max(-1, height);
}

// River/lake data
const RIVERS = [
  { points: [[40, -0.75, -60], [35, -0.75, -20], [30, -0.75, 20], [25, -0.75, 80]], width: 11 },
  { points: [[-350, -0.5, 350], [-250, -0.5, 250], [-100, -0.6, 150], [50, -0.6, 50], [200, -0.5, -50], [350, -0.5, -200], [450, -0.5, -320]], width: 16 },
  { points: [[350, -0.4, 450], [400, -0.5, 400], [450, -0.6, 350], [480, -0.5, 280], [500, -0.5, 200]], width: 14 },
  { points: [[450, -0.3, -350], [500, -0.4, -380], [550, -0.3, -430], [600, -0.3, -500]], width: 8 },
];
const LAKES = [
  { position: [-50, -0.55, -40], radiusX: 13, radiusZ: 13 },
  { position: [420, -0.6, 320], radiusX: 35, radiusZ: 25 },
  { position: [-380, -0.4, 480], radiusX: 18, radiusZ: 15 },
  { position: [-520, -0.5, 60], radiusX: 20, radiusZ: 14 },
  { position: [530, -0.3, -420], radiusX: 16, radiusZ: 12 },
];

function distToRiverSeg(x: number, z: number, river: typeof RIVERS[0]): number {
  let minDist = Infinity;
  for (let i = 0; i < river.points.length - 1; i++) {
    const ax = river.points[i][0], az = river.points[i][2];
    const bx = river.points[i + 1][0], bz = river.points[i + 1][2];
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz;
    if (len2 < 1) continue;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + t * dx, pz = az + t * dz;
    const dist = Math.sqrt((x - px) ** 2 + (z - pz) ** 2);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

const SETTLEMENT_WALLS = [
  { name: 'Ironhold', x: 0, z: 0, wallR: 45 },
  { name: 'Greenmeadow', x: -155, z: -125, wallR: 20 },
  { name: 'Blackthorn', x: 185, z: -155, wallR: 20 },
  { name: 'Old Veyra', x: 195, z: 95, wallR: 45 },
  { name: 'Thornwall', x: -500, z: -450, wallR: 45 },
  { name: 'Rivermoor', x: 450, z: 350, wallR: 45 },
  { name: 'Darkhollow', x: 550, z: -400, wallR: 45 },
  { name: 'Goldenvale', x: -550, z: 100, wallR: 45 },
  { name: 'Frostmere', x: 155, z: 195, wallR: 10 },
  { name: 'Millbrook', x: -110, z: -80, wallR: 10 },
];

const LABELED_A = [
  { x: -455, z: -500, label: 'Thornwall Stn' },
  { x: -430, z: -440, label: 'A2' }, { x: -400, z: -400, label: 'A3' },
  { x: -360, z: -370, label: 'A4' }, { x: -320, z: -330, label: 'A5' },
  { x: -280, z: -280, label: 'A6' }, { x: -240, z: -240, label: 'A7' },
  { x: -190, z: -200, label: 'A8' }, { x: -150, z: -170, label: 'Greenmeadow Stn' },
  { x: -110, z: -120, label: 'A10' }, { x: -70, z: -50, label: 'A11' },
  { x: -50, z: 25, label: 'A12' }, { x: -25, z: 90, label: 'Ironhold Central' },
  { x: 30, z: 100, label: 'A14' }, { x: 90, z: 110, label: 'A15' },
  { x: 150, z: 105, label: 'A16 Bypass' }, { x: 210, z: 100, label: 'A17' },
  { x: 270, z: 140, label: 'A18' }, { x: 330, z: 220, label: 'A19' },
  { x: 350, z: 260, label: 'A20' }, { x: 370, z: 285, label: 'Rivermoor Bridge' },
  { x: 390, z: 290, label: 'Rivermoor Stn' },
];
const LABELED_B = [
  { x: -500, z: 130, label: 'Goldenvale Stn' },
  { x: -460, z: 120, label: 'B2' }, { x: -380, z: 95, label: 'B3' },
  { x: -280, z: 75, label: 'B4' }, { x: -180, z: 60, label: 'B5' },
  { x: -100, z: 65, label: 'B6' }, { x: -5, z: 80, label: 'Great River Bridge' },
  { x: -25, z: 90, label: 'Ironhold Central' },
  { x: -5, z: 45, label: 'B9' }, { x: 30, z: 0, label: 'B10' },
  { x: 80, z: -55, label: 'B11' }, { x: 130, z: -100, label: 'B12' },
  { x: 185, z: -130, label: 'Blackthorn Halt' },
  { x: 230, z: -170, label: 'B14' }, { x: 290, z: -220, label: 'B15' },
  { x: 340, z: -260, label: 'B16' }, { x: 420, z: -330, label: 'Darkhollow Bridge' },
  { x: 490, z: -370, label: 'B18' }, { x: 500, z: -375, label: 'Darkhollow Stn' },
];

describe('Railway v3 (with flattening)', () => {
  it('terrain heights', () => {
    console.log('===== LINE A TERRAIN (v3 flattened) =====');
    for (const wp of LABELED_A) {
      const h = getTerrainHeight(wp.x, wp.z);
      const flag = Math.abs(h) > 8 ? ' ⚠️ STEEP' : h > 5 ? ' ⚠️ HIGH' : ' ✅';
      console.log(`${wp.label}: [${wp.x},${wp.z}] y=${h.toFixed(2)}${flag}`);
    }
    console.log('\n===== LINE B TERRAIN (v3 flattened) =====');
    for (const wp of LABELED_B) {
      const h = getTerrainHeight(wp.x, wp.z);
      const flag = Math.abs(h) > 8 ? ' ⚠️ STEEP' : h > 5 ? ' ⚠️ HIGH' : ' ✅';
      console.log(`${wp.label}: [${wp.x},${wp.z}] y=${h.toFixed(2)}${flag}`);
    }
    expect(true).toBe(true);
  });

  it('waypoint-to-waypoint grades', () => {
    const check = (wps: typeof LABELED_A, name: string) => {
      console.log(`\n===== ${name} GRADES (v3) =====`);
      for (let i = 0; i < wps.length - 1; i++) {
        const a = wps[i], b = wps[i + 1];
        const ha = getTerrainHeight(a.x, a.z), hb = getTerrainHeight(b.x, b.z);
        const dist = Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
        const grade = dist > 0 ? Math.abs(hb - ha) / dist * 100 : 0;
        const flag = grade > 5 ? ' ⚠️ STEEP' : grade > 3 ? ' ⚠️ MOD' : ' ✅';
        console.log(`${a.label}→${b.label}: dist=${dist.toFixed(0)} Δy=${(hb-ha).toFixed(2)} grade=${grade.toFixed(1)}%${flag}`);
      }
    };
    check(LABELED_A, 'A');
    check(LABELED_B, 'B');
    expect(true).toBe(true);
  });

  it('max local grades (interpolated)', () => {
    console.log('\n===== MAX LOCAL GRADES (v3) =====');
    const checkLine = (wps: typeof LABELED_A, name: string) => {
      for (let i = 0; i < wps.length - 1; i++) {
        const a = wps[i], b = wps[i + 1];
        const dist = Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
        const steps = Math.max(2, Math.floor(dist / 6));
        let maxG = 0;
        for (let s = 0; s < steps; s++) {
          const t1 = s / steps, t2 = (s + 1) / steps;
          const x1 = a.x + (b.x - a.x) * t1, z1 = a.z + (b.z - a.z) * t1;
          const x2 = a.x + (b.x - a.x) * t2, z2 = a.z + (b.z - a.z) * t2;
          const h1 = getTerrainHeight(x1, z1), h2 = getTerrainHeight(x2, z2);
          const sd = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
          const g = sd > 0 ? Math.abs(h2 - h1) / sd * 100 : 0;
          if (g > maxG) maxG = g;
        }
        const flag = maxG > 10 ? ' ⚠️ STEEP' : maxG > 5 ? ' ⚠️ MOD' : ' ✅';
        console.log(`${name} ${a.label}→${b.label}: maxLocal=${maxG.toFixed(1)}%${flag}`);
      }
    };
    checkLine(LABELED_A, 'A');
    checkLine(LABELED_B, 'B');
    expect(true).toBe(true);
  });

  it('wall collisions', () => {
    console.log('\n===== WALL COLLISIONS (v3) =====');
    const all = [...LABELED_A.map(w => ({...w, line: 'A'})), ...LABELED_B.map(w => ({...w, line: 'B'}))];
    let issues = 0;
    for (const wp of all) {
      for (const s of SETTLEMENT_WALLS) {
        const d = Math.sqrt((wp.x - s.x) ** 2 + (wp.z - s.z) ** 2);
        if (d < s.wallR + 5) {
          console.log(`⚠️ ${wp.line} ${wp.label} [${wp.x},${wp.z}] ${d.toFixed(0)}u from ${s.name} (wall ${s.wallR})`);
          issues++;
        }
      }
    }
    if (issues === 0) console.log('✅ No wall collisions');
    expect(true).toBe(true);
  });

  it('river/lake collisions', () => {
    console.log('\n===== RIVER/LAKE (v3) =====');
    const all = [...LABELED_A.map(w => ({...w, line: 'A'})), ...LABELED_B.map(w => ({...w, line: 'B'}))];
    for (const wp of all) {
      for (const r of RIVERS) {
        const d = distToRiverSeg(wp.x, wp.z, r);
        if (d < r.width / 2 + 3) {
          const bridge = wp.label.includes('Bridge');
          console.log(`${bridge ? '🌉' : '⚠️'} ${wp.line} ${wp.label} riverDist=${d.toFixed(1)} (hw=${r.width/2})${bridge ? ' EXPECTED' : ''}`);
        }
      }
      for (const lake of LAKES) {
        const nx = (wp.x - lake.position[0]) / lake.radiusX;
        const nz = (wp.z - lake.position[2]) / lake.radiusZ;
        if (nx * nx + nz * nz <= 1.2) {
          console.log(`⚠️ ${wp.line} ${wp.label} IN/NEAR lake`);
        }
      }
    }
    expect(true).toBe(true);
  });

  it('Frostmere bypass', () => {
    console.log('\n===== FROSTMERE BYPASS (v3) =====');
    const fc = { x: 160, z: 200 };
    for (const wp of LABELED_A.filter(w => w.x >= 30 && w.x <= 330)) {
      const d = Math.sqrt((wp.x - fc.x) ** 2 + (wp.z - fc.z) ** 2);
      const h = getTerrainHeight(wp.x, wp.z);
      console.log(`${wp.label}: frostDist=${d.toFixed(0)}u y=${h.toFixed(2)}${d < 60 ? ' ⚠️' : ' ✅'}`);
    }
    expect(true).toBe(true);
  });
});
