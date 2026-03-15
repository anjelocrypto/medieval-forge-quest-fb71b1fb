/**
 * Railway Route Re-Validation (v2 corrected coordinates)
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
  { position: [0, 0], size: 'large' },
  { position: [-155, -125], size: 'medium' },
  { position: [185, -155], size: 'medium' },
  { position: [195, 95], size: 'large' },
  { position: [5, -205], size: 'medium' },
  { position: [-185, 135], size: 'small' },
  { position: [155, 195], size: 'small' },
  { position: [160, 50], size: 'small' },
  { position: [-110, -80], size: 'small' },
  { position: [-500, -450], size: 'large' },
  { position: [450, 350], size: 'large' },
  { position: [-400, 500], size: 'large' },
  { position: [550, -400], size: 'large' },
  { position: [-550, 100], size: 'large' },
  { position: [-440, -400], size: 'small' },
  { position: [400, 300], size: 'small' },
  { position: [-350, 450], size: 'small' },
  { position: [500, -350], size: 'medium' },
  { position: [-500, 150], size: 'small' },
] as const;

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
  let height = rawHeight;
  if (settleFlatten < 0.3) {
    const stepStrength = 1 - settleFlatten / 0.3;
    const stepped = Math.round(rawHeight * 2.5) / 2.5;
    height = rawHeight + (stepped - rawHeight) * stepStrength * 0.7;
  }
  return Math.max(-1, height);
}

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

function distToRiverSegment(x: number, z: number, river: typeof RIVERS[0]): number {
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

// v2 corrected waypoints
const LINE_A = [
  { x: -455, z: -500, label: 'Thornwall Station' },
  { x: -430, z: -440, label: 'A2' },
  { x: -400, z: -400, label: 'A3' },
  { x: -360, z: -370, label: 'A4' },
  { x: -320, z: -330, label: 'A5' },
  { x: -280, z: -280, label: 'A6 Western Marches' },
  { x: -240, z: -240, label: 'A7' },
  { x: -190, z: -200, label: 'A8' },
  { x: -150, z: -170, label: 'Greenmeadow Station' },
  { x: -110, z: -120, label: 'A10' },
  { x: -70, z: -50, label: 'A11' },
  { x: -50, z: 25, label: 'A12 Heartland' },
  { x: -25, z: 90, label: 'Ironhold Central' },
  { x: 30, z: 100, label: 'A14' },
  { x: 90, z: 110, label: 'A15' },
  { x: 160, z: 115, label: 'A16 Frostmere Bypass' },
  { x: 220, z: 120, label: 'A17' },
  { x: 280, z: 160, label: 'A18' },
  { x: 330, z: 220, label: 'A19' },
  { x: 350, z: 260, label: 'A20 Rivermoor approach' },
  { x: 370, z: 285, label: 'Rivermoor Bridge' },
  { x: 390, z: 290, label: 'Rivermoor Station' },
];

const LINE_B = [
  { x: -500, z: 130, label: 'Goldenvale Station' },
  { x: -460, z: 120, label: 'B2' },
  { x: -380, z: 95, label: 'B3' },
  { x: -280, z: 75, label: 'B4' },
  { x: -180, z: 60, label: 'B5' },
  { x: -100, z: 65, label: 'B6' },
  { x: -5, z: 80, label: 'Great River Bridge' },
  { x: -25, z: 90, label: 'Ironhold Central' },
  { x: 5, z: 50, label: 'B9' },
  { x: 40, z: 10, label: 'B10' },
  { x: 90, z: -50, label: 'B11' },
  { x: 130, z: -100, label: 'B12' },
  { x: 185, z: -130, label: 'Blackthorn Halt' },
  { x: 230, z: -170, label: 'B14' },
  { x: 290, z: -220, label: 'B15' },
  { x: 340, z: -260, label: 'B16' },
  { x: 420, z: -330, label: 'Darkhollow Bridge' },
  { x: 500, z: -375, label: 'Darkhollow Station' },
];

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

describe('Railway v2 Re-Validation', () => {
  it('terrain heights at all waypoints', () => {
    console.log('===== LINE A TERRAIN (v2) =====');
    for (const wp of LINE_A) {
      const h = getTerrainHeight(wp.x, wp.z);
      const flag = Math.abs(h) > 8 ? ' ⚠️ STEEP' : h > 5 ? ' ⚠️ HIGH' : h < -0.5 ? ' ⚠️ LOW' : ' ✅';
      console.log(`${wp.label}: [${wp.x}, ${wp.z}] → y=${h.toFixed(2)}${flag}`);
    }
    console.log('\n===== LINE B TERRAIN (v2) =====');
    for (const wp of LINE_B) {
      const h = getTerrainHeight(wp.x, wp.z);
      const flag = Math.abs(h) > 8 ? ' ⚠️ STEEP' : h > 5 ? ' ⚠️ HIGH' : h < -0.5 ? ' ⚠️ LOW' : ' ✅';
      console.log(`${wp.label}: [${wp.x}, ${wp.z}] → y=${h.toFixed(2)}${flag}`);
    }
    expect(true).toBe(true);
  });

  it('grades between consecutive waypoints', () => {
    const checkGrades = (wps: typeof LINE_A, name: string) => {
      console.log(`\n===== ${name} GRADES (v2) =====`);
      for (let i = 0; i < wps.length - 1; i++) {
        const a = wps[i], b = wps[i + 1];
        const ha = getTerrainHeight(a.x, a.z), hb = getTerrainHeight(b.x, b.z);
        const dist = Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
        const grade = dist > 0 ? Math.abs(hb - ha) / dist * 100 : 0;
        const flag = grade > 5 ? ' ⚠️ STEEP' : grade > 3 ? ' ⚠️ MOD' : ' ✅';
        console.log(`${a.label} → ${b.label}: dist=${dist.toFixed(0)} Δy=${(hb-ha).toFixed(2)} grade=${grade.toFixed(1)}%${flag}`);
      }
    };
    checkGrades(LINE_A, 'LINE A');
    checkGrades(LINE_B, 'LINE B');
    expect(true).toBe(true);
  });

  it('wall collision check', () => {
    console.log('\n===== WALL COLLISION (v2) =====');
    const allWps = [...LINE_A.map(w => ({ ...w, line: 'A' })), ...LINE_B.map(w => ({ ...w, line: 'B' }))];
    let issues = 0;
    for (const wp of allWps) {
      for (const s of SETTLEMENT_WALLS) {
        const dist = Math.sqrt((wp.x - s.x) ** 2 + (wp.z - s.z) ** 2);
        if (dist < s.wallR + 5) {
          console.log(`⚠️ ${wp.line} ${wp.label} [${wp.x},${wp.z}] is ${dist.toFixed(0)}u from ${s.name} (wall ${s.wallR}) — TOO CLOSE`);
          issues++;
        }
      }
    }
    if (issues === 0) console.log('✅ No wall collisions found');
    expect(true).toBe(true);
  });

  it('river and lake check', () => {
    console.log('\n===== RIVER/LAKE (v2) =====');
    const allWps = [...LINE_A.map(w => ({ ...w, line: 'A' })), ...LINE_B.map(w => ({ ...w, line: 'B' }))];
    for (const wp of allWps) {
      for (const river of RIVERS) {
        const dist = distToRiverSegment(wp.x, wp.z, river);
        if (dist < river.width / 2 + 3) {
          const isBridge = wp.label.includes('Bridge');
          console.log(`${isBridge ? '🌉' : '⚠️'} ${wp.line} ${wp.label} [${wp.x},${wp.z}] riverDist=${dist.toFixed(1)} (hw=${river.width/2})${isBridge ? ' EXPECTED' : ' UNPLANNED'}`);
        }
      }
      for (const lake of LAKES) {
        const nx = (wp.x - lake.position[0]) / lake.radiusX;
        const nz = (wp.z - lake.position[2]) / lake.radiusZ;
        if (nx * nx + nz * nz <= 1.2) {
          console.log(`⚠️ ${wp.line} ${wp.label} [${wp.x},${wp.z}] IN/NEAR lake at [${lake.position[0]},${lake.position[2]}]`);
        }
      }
    }
    expect(true).toBe(true);
  });

  it('Frostmere bypass safety', () => {
    console.log('\n===== FROSTMERE BYPASS (v2) =====');
    const frostCenter = { x: 160, z: 200 };
    const bypassWps = LINE_A.filter(w => w.x >= 30 && w.x <= 330);
    for (const wp of bypassWps) {
      const dist = Math.sqrt((wp.x - frostCenter.x) ** 2 + (wp.z - frostCenter.z) ** 2);
      const h = getTerrainHeight(wp.x, wp.z);
      const flag = dist < 60 ? ' ⚠️ TOO CLOSE' : dist < 80 ? ' ⚠️ CLOSE' : ' ✅';
      console.log(`${wp.label}: frostDist=${dist.toFixed(0)}u y=${h.toFixed(2)}${flag}`);
    }
    expect(true).toBe(true);
  });

  it('interpolated steep spot check', () => {
    console.log('\n===== MAX LOCAL GRADES (v2) =====');
    const checkLine = (waypoints: typeof LINE_A, lineName: string) => {
      for (let i = 0; i < waypoints.length - 1; i++) {
        const a = waypoints[i], b = waypoints[i + 1];
        const dist = Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
        const steps = Math.max(2, Math.floor(dist / 8));
        let maxGrade = 0;
        let worstSpot = '';
        for (let s = 0; s < steps; s++) {
          const t1 = s / steps, t2 = (s + 1) / steps;
          const x1 = a.x + (b.x - a.x) * t1, z1 = a.z + (b.z - a.z) * t1;
          const x2 = a.x + (b.x - a.x) * t2, z2 = a.z + (b.z - a.z) * t2;
          const h1 = getTerrainHeight(x1, z1), h2 = getTerrainHeight(x2, z2);
          const segDist = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
          const grade = segDist > 0 ? Math.abs(h2 - h1) / segDist * 100 : 0;
          if (grade > maxGrade) { maxGrade = grade; worstSpot = `[${x1.toFixed(0)},${z1.toFixed(0)}]`; }
        }
        const flag = maxGrade > 15 ? ' ⚠️ STEEP' : maxGrade > 8 ? ' ⚠️ MOD' : ' ✅';
        console.log(`${lineName} ${a.label}→${b.label}: maxLocalGrade=${maxGrade.toFixed(1)}%${flag} at ${worstSpot}`);
      }
    };
    checkLine(LINE_A, 'A');
    checkLine(LINE_B, 'B');
    expect(true).toBe(true);
  });

  it('Ironhold river avoidance', () => {
    console.log('\n===== IRONHOLD RIVER (v2) =====');
    const ironRiver = RIVERS[0];
    const nearWps = [...LINE_A, ...LINE_B].filter(w => Math.abs(w.x) < 60 && Math.abs(w.z) < 100);
    for (const wp of nearWps) {
      const dist = distToRiverSegment(wp.x, wp.z, ironRiver);
      const flag = dist < ironRiver.width / 2 ? ' ⚠️ IN RIVER' : dist < ironRiver.width / 2 + 5 ? ' ⚠️ CLOSE' : ' ✅';
      console.log(`${wp.label} [${wp.x},${wp.z}]: ironRiverDist=${dist.toFixed(1)}${flag}`);
    }
    expect(true).toBe(true);
  });
});
