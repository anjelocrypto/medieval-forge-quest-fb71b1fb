import { describe, it, expect } from 'vitest';
import { LINE_A_WAYPOINTS, LINE_B_WAYPOINTS, RAILWAY_STATIONS } from '@/game/world/RailwayData';
import { rebuildObstacles, getBoxObstacles, getCircleObstacles } from '@/game/systems/CollisionSystem';
import { BRIDGES } from '@/game/world/BridgeData';

const CLEARANCE = 15;

interface Segment {
  line: 'A' | 'B';
  index: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

interface AuditViolation {
  line: 'A' | 'B';
  segment: string;
  from: [number, number];
  to: [number, number];
  obstacleId: string;
  obstacleType: string;
  minDistance: number;
  failReason: string;
}

function classifyObstacle(id: string): { type: string; failReason: string } {
  if (id.includes('-wall-') || id.includes('-tower-') || id.includes('-gate-') || id.includes('-pal-')) {
    return { type: 'wall/fortification', failReason: 'inside wall zone or too close to fortification' };
  }
  if (id.includes('-house-') || id.startsWith('town-') || id.startsWith('wild-')) {
    return { type: 'building/house footprint', failReason: 'inside house/building footprint or too close' };
  }
  if (id.includes('-hall') || id.includes('-keep') || id.includes('-citadel') || id.includes('-barracks') || id.includes('-cmd') || id.includes('-mine') || id.includes('-nave') || id.includes('-wing')) {
    return { type: 'major structure', failReason: 'inside settlement structure footprint or too close' };
  }
  if (id.startsWith('poi-')) {
    return { type: 'poi structure', failReason: 'inside POI structure footprint or too close' };
  }
  if (id.startsWith('bridge-') || id.startsWith('world-bridge-')) {
    return { type: 'bridge deck/approach', failReason: 'too close to bridge structure/approach' };
  }
  return { type: 'structure', failReason: 'too close to rendered/collision structure' };
}

function pointToAabbDist(px: number, pz: number, minX: number, maxX: number, minZ: number, maxZ: number): number {
  const dx = px < minX ? minX - px : px > maxX ? px - maxX : 0;
  const dz = pz < minZ ? minZ - pz : pz > maxZ ? pz - maxZ : 0;
  return Math.hypot(dx, dz);
}

function segSegDist(
  ax: number, az: number, bx: number, bz: number,
  cx: number, cz: number, dx: number, dz: number,
): number {
  // 2D segment distance via projection sampling (robust enough for audit)
  const samples = [0, 0.25, 0.5, 0.75, 1];
  let best = Infinity;

  for (const t of samples) {
    const px = ax + (bx - ax) * t;
    const pz = az + (bz - az) * t;
    best = Math.min(best, pointToSegmentDist(px, pz, cx, cz, dx, dz));
  }
  for (const t of samples) {
    const px = cx + (dx - cx) * t;
    const pz = cz + (dz - cz) * t;
    best = Math.min(best, pointToSegmentDist(px, pz, ax, az, bx, bz));
  }

  return best;
}

function pointToSegmentDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax;
  const vz = bz - az;
  const len2 = vx * vx + vz * vz;
  if (len2 < 1e-9) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len2));
  const qx = ax + vx * t;
  const qz = az + vz * t;
  return Math.hypot(px - qx, pz - qz);
}

function segmentIntersectsAabb(ax: number, az: number, bx: number, bz: number, minX: number, maxX: number, minZ: number, maxZ: number): boolean {
  // Liang-Barsky clipping in 2D
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;

  const checks: [number, number][] = [
    [-dx, ax - minX],
    [dx, maxX - ax],
    [-dz, az - minZ],
    [dz, maxZ - az],
  ];

  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }
  return true;
}

function segmentToRotBoxDist(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  rotation: number,
): number {
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);

  const lax = cos * (ax - cx) + sin * (az - cz);
  const laz = -sin * (ax - cx) + cos * (az - cz);
  const lbx = cos * (bx - cx) + sin * (bz - cz);
  const lbz = -sin * (bx - cx) + cos * (bz - cz);

  const minX = -halfW;
  const maxX = halfW;
  const minZ = -halfD;
  const maxZ = halfD;

  if (segmentIntersectsAabb(lax, laz, lbx, lbz, minX, maxX, minZ, maxZ)) return 0;

  let best = Infinity;
  best = Math.min(best, pointToAabbDist(lax, laz, minX, maxX, minZ, maxZ));
  best = Math.min(best, pointToAabbDist(lbx, lbz, minX, maxX, minZ, maxZ));

  // Edges of AABB in local space
  const edges: Array<[number, number, number, number]> = [
    [minX, minZ, maxX, minZ],
    [maxX, minZ, maxX, maxZ],
    [maxX, maxZ, minX, maxZ],
    [minX, maxZ, minX, minZ],
  ];
  for (const [ex1, ez1, ex2, ez2] of edges) {
    best = Math.min(best, segSegDist(lax, laz, lbx, lbz, ex1, ez1, ex2, ez2));
  }

  return best;
}

function buildSegments(): Segment[] {
  const segs: Segment[] = [];
  const add = (line: 'A' | 'B', wps: typeof LINE_A_WAYPOINTS) => {
    for (let i = 0; i < wps.length - 1; i++) {
      segs.push({
        line,
        index: i,
        ax: wps[i].x,
        az: wps[i].z,
        bx: wps[i + 1].x,
        bz: wps[i + 1].z,
      });
    }
  };
  add('A', LINE_A_WAYPOINTS);
  add('B', LINE_B_WAYPOINTS);
  return segs;
}

describe('railway strict route intrusion audit', () => {
  it('reports every segment under 15u clearance from rendered/collision structures', () => {
    rebuildObstacles([], [], [], null);

    const circles = getCircleObstacles().map((c) => ({ ...c }));
    const boxes = getBoxObstacles().map((b) => ({ ...b }));

    // Add world bridge decks as audited structures
    for (const b of BRIDGES) {
      boxes.push({
        cx: b.position[0],
        cz: b.position[2],
        halfW: b.width / 2,
        halfD: b.length / 2,
        rotation: b.rotation,
        id: `world-bridge-${b.id}`,
      });
    }

    const violations: AuditViolation[] = [];
    const segments = buildSegments();

    for (const seg of segments) {
      let worst: AuditViolation | null = null;

      for (const c of circles) {
        const centerDist = pointToSegmentDist(c.x, c.z, seg.ax, seg.az, seg.bx, seg.bz);
        const surfaceDist = centerDist - c.radius;
        if (surfaceDist < CLEARANCE) {
          const cls = classifyObstacle(c.id);
          const v: AuditViolation = {
            line: seg.line,
            segment: `${seg.index}: [${seg.ax}, ${seg.az}] -> [${seg.bx}, ${seg.bz}]`,
            from: [seg.ax, seg.az],
            to: [seg.bx, seg.bz],
            obstacleId: c.id,
            obstacleType: cls.type,
            minDistance: Number(surfaceDist.toFixed(2)),
            failReason: cls.failReason,
          };
          if (!worst || v.minDistance < worst.minDistance) worst = v;
        }
      }

      for (const b of boxes) {
        const surfaceDist = segmentToRotBoxDist(seg.ax, seg.az, seg.bx, seg.bz, b.cx, b.cz, b.halfW, b.halfD, b.rotation);
        if (surfaceDist < CLEARANCE) {
          const cls = classifyObstacle(b.id);
          const v: AuditViolation = {
            line: seg.line,
            segment: `${seg.index}: [${seg.ax}, ${seg.az}] -> [${seg.bx}, ${seg.bz}]`,
            from: [seg.ax, seg.az],
            to: [seg.bx, seg.bz],
            obstacleId: b.id,
            obstacleType: cls.type,
            minDistance: Number(surfaceDist.toFixed(2)),
            failReason: cls.failReason,
          };
          if (!worst || v.minDistance < worst.minDistance) worst = v;
        }
      }

      if (worst) violations.push(worst);
    }

    const stationViolations = RAILWAY_STATIONS.flatMap((s) => {
      const [sx, sz] = s.position;
      const found: Array<{ station: string; obstacleId: string; minDistance: number }> = [];

      for (const c of circles) {
        const d = Math.hypot(sx - c.x, sz - c.z) - c.radius;
        if (d < CLEARANCE) found.push({ station: s.name, obstacleId: c.id, minDistance: Number(d.toFixed(2)) });
      }
      for (const b of boxes) {
        const d = segmentToRotBoxDist(sx, sz, sx, sz, b.cx, b.cz, b.halfW, b.halfD, b.rotation);
        if (d < CLEARANCE) found.push({ station: s.name, obstacleId: b.id, minDistance: Number(d.toFixed(2)) });
      }
      return found;
    });

    const sorted = [...violations].sort((a, b) => a.minDistance - b.minDistance || a.line.localeCompare(b.line));
    console.log('\n=== RAILWAY CLEARANCE VIOLATIONS (<15u) ===');
    console.table(sorted);

    console.log('\n=== STATION CLEARANCE VIOLATIONS (<15u) ===');
    console.table(stationViolations.sort((a, b) => a.minDistance - b.minDistance));

    expect(Array.isArray(violations)).toBe(true);
  });
});
