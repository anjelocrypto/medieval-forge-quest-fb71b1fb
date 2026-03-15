/**
 * RailwayTrack — Renders rails, sleepers, ballast along v3 spline.
 * Optimized: minimal allocations, LOD culled, updates every 10 frames.
 */
import { useRef, useMemo, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LINE_A_WAYPOINTS, LINE_B_WAYPOINTS, RailwayWaypoint } from '../world/RailwayData';
import { getTerrainHeight } from './Terrain';

const GAUGE = 1.2;
const BALLAST_H = 0.15;
const SLEEPER_H = 0.12;
const RAIL_H = 0.15;
const RAIL_Y_OFF = BALLAST_H + SLEEPER_H + RAIL_H / 2;
const SLP_Y_OFF = BALLAST_H + SLEEPER_H / 2;
const SLEEPER_SPACING = 2.0;
const VIEW_DIST_SQ = 160 * 160;

const railMat = new THREE.MeshLambertMaterial({ color: '#3a3a3a' });
const sleeperMat = new THREE.MeshLambertMaterial({ color: '#5a3a1a' });
const ballastMat = new THREE.MeshLambertMaterial({ color: '#6a6050' });
const railGeo = new THREE.BoxGeometry(0.12, RAIL_H, 1);
const sleeperGeo = new THREE.BoxGeometry(2.0, SLEEPER_H, 0.3);
const ballastGeo = new THREE.BoxGeometry(3.0, BALLAST_H, 1);

const TRACK_HEIGHT_OFFSET = 0.35;

// Build lightweight spline points from waypoints — minimal allocations
function buildPoints(wps: RailwayWaypoint[]): Float32Array {
  // Simple linear interpolation between waypoints with subdivision
  const SUBDIV = 4; // points per segment
  const total = (wps.length - 1) * SUBDIV + 1;
  const arr = new Float32Array(total * 3); // x, y, z packed
  let idx = 0;
  for (let i = 0; i < wps.length - 1; i++) {
    for (let s = 0; s < SUBDIV; s++) {
      const t = s / SUBDIV;
      const x = wps[i].x + (wps[i + 1].x - wps[i].x) * t;
      const z = wps[i].z + (wps[i + 1].z - wps[i].z) * t;
      const y = getTerrainHeight(x, z) + TRACK_HEIGHT_OFFSET;
      arr[idx++] = x; arr[idx++] = y; arr[idx++] = z;
    }
  }
  // Last point
  const last = wps[wps.length - 1];
  arr[idx++] = last.x;
  arr[idx++] = getTerrainHeight(last.x, last.z) + TRACK_HEIGHT_OFFSET;
  arr[idx++] = last.z;
  return arr;
}

// Pre-computed flat arrays for segment and sleeper data
interface TrackArrays {
  // Segments: mx, mz, lx,ly,lz, rx,ry,rz, bx,by,bz, qx,qy,qz,qw, len (16 floats each)
  segs: Float32Array;
  segCount: number;
  // Sleepers: x,y,z, mx,mz, qx,qy,qz,qw (9 floats each)
  slps: Float32Array;
  slpCount: number;
}

const _dir = new THREE.Vector3();
const _cross = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m4 = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _zero = new THREE.Vector3(0, 0, 0);
const _obj = new THREE.Object3D();

function buildTrackArrays(wps: RailwayWaypoint[]): TrackArrays {
  const pts = buildPoints(wps);
  const numPts = pts.length / 3;
  const maxSegs = numPts - 1;
  const segs = new Float32Array(maxSegs * 16);
  let segCount = 0;

  for (let i = 0; i < maxSegs; i++) {
    const i3 = i * 3, n3 = (i + 1) * 3;
    const dx = pts[n3] - pts[i3], dy = pts[n3 + 1] - pts[i3 + 1], dz = pts[n3 + 2] - pts[i3 + 2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 0.01) continue;

    const mx = (pts[i3] + pts[n3]) * 0.5;
    const my = (pts[i3 + 1] + pts[n3 + 1]) * 0.5;
    const mz = (pts[i3 + 2] + pts[n3 + 2]) * 0.5;

    _dir.set(dx / len, dy / len, dz / len);
    _cross.set(-_dir.z, 0, _dir.x);
    _m4.lookAt(_zero, _dir, _up);
    _q.setFromRotationMatrix(_m4);

    const off = segCount * 16;
    segs[off] = mx; segs[off + 1] = mz;
    segs[off + 2] = mx + _cross.x * (GAUGE / 2); segs[off + 3] = my + RAIL_Y_OFF; segs[off + 4] = mz + _cross.z * (GAUGE / 2);
    segs[off + 5] = mx - _cross.x * (GAUGE / 2); segs[off + 6] = my + RAIL_Y_OFF; segs[off + 7] = mz - _cross.z * (GAUGE / 2);
    segs[off + 8] = mx; segs[off + 9] = my + BALLAST_H / 2; segs[off + 10] = mz;
    segs[off + 11] = _q.x; segs[off + 12] = _q.y; segs[off + 13] = _q.z; segs[off + 14] = _q.w;
    segs[off + 15] = len;
    segCount++;
  }

  // Sleepers
  const maxSlp = Math.ceil(numPts * 3); // upper bound
  const slps = new Float32Array(maxSlp * 9);
  let slpCount = 0;
  let acc = 0, nextDist = 0;

  for (let i = 1; i < numPts; i++) {
    const i3 = i * 3, p3 = (i - 1) * 3;
    const dx = pts[i3] - pts[p3], dy = pts[i3 + 1] - pts[p3 + 1], dz = pts[i3 + 2] - pts[p3 + 2];
    const segLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (segLen < 0.01) { acc += segLen; continue; }

    _dir.set(dx / segLen, dy / segLen, dz / segLen);
    _m4.lookAt(_zero, _dir, _up);
    _q.setFromRotationMatrix(_m4);

    while (nextDist <= acc + segLen && slpCount < maxSlp) {
      const t = Math.max(0, Math.min(1, (nextDist - acc) / segLen));
      const soff = slpCount * 9;
      slps[soff] = pts[p3] + dx * t;
      slps[soff + 1] = pts[p3 + 1] + dy * t + SLP_Y_OFF - TRACK_HEIGHT_OFFSET;
      slps[soff + 2] = pts[p3 + 2] + dz * t;
      slps[soff + 3] = slps[soff]; // mx
      slps[soff + 4] = slps[soff + 2]; // mz
      slps[soff + 5] = _q.x; slps[soff + 6] = _q.y; slps[soff + 7] = _q.z; slps[soff + 8] = _q.w;
      slpCount++;
      nextDist += SLEEPER_SPACING;
    }
    acc += segLen;
  }

  return { segs, segCount, slps, slpCount };
}

const MAX_VIS = 150;
const MAX_VIS_SLP = 250;
const UPDATE_INTERVAL = 10;

const TrackLine = memo(function TrackLine({
  waypoints, name, playerPositionRef,
}: {
  waypoints: RailwayWaypoint[]; name: string;
  playerPositionRef: React.RefObject<THREE.Vector3>;
}) {
  const data = useMemo(() => buildTrackArrays(waypoints), [waypoints]);
  const railLRef = useRef<THREE.InstancedMesh>(null);
  const railRRef = useRef<THREE.InstancedMesh>(null);
  const ballRef = useRef<THREE.InstancedMesh>(null);
  const slpRef = useRef<THREE.InstancedMesh>(null);
  const frame = useRef(0);

  useFrame(() => {
    if (++frame.current % UPDATE_INTERVAL !== 0) return;
    const px = playerPositionRef.current?.x ?? 0;
    const pz = playerPositionRef.current?.z ?? 0;

    let sc = 0;
    for (let i = 0; i < data.segCount && sc < MAX_VIS; i++) {
      const off = i * 16;
      const ddx = data.segs[off] - px, ddz = data.segs[off + 1] - pz;
      if (ddx * ddx + ddz * ddz > VIEW_DIST_SQ) continue;

      _q.set(data.segs[off + 11], data.segs[off + 12], data.segs[off + 13], data.segs[off + 14]);
      const len = data.segs[off + 15];

      // Left rail
      _obj.position.set(data.segs[off + 2], data.segs[off + 3], data.segs[off + 4]);
      _obj.quaternion.copy(_q); _obj.scale.set(1, 1, len); _obj.updateMatrix();
      railLRef.current?.setMatrixAt(sc, _obj.matrix);
      // Right rail
      _obj.position.set(data.segs[off + 5], data.segs[off + 6], data.segs[off + 7]);
      _obj.updateMatrix();
      railRRef.current?.setMatrixAt(sc, _obj.matrix);
      // Ballast
      _obj.position.set(data.segs[off + 8], data.segs[off + 9], data.segs[off + 10]);
      _obj.updateMatrix();
      ballRef.current?.setMatrixAt(sc, _obj.matrix);
      sc++;
    }
    if (railLRef.current) { railLRef.current.count = sc; railLRef.current.instanceMatrix.needsUpdate = true; }
    if (railRRef.current) { railRRef.current.count = sc; railRRef.current.instanceMatrix.needsUpdate = true; }
    if (ballRef.current) { ballRef.current.count = sc; ballRef.current.instanceMatrix.needsUpdate = true; }

    let slc = 0;
    for (let i = 0; i < data.slpCount && slc < MAX_VIS_SLP; i++) {
      const soff = i * 9;
      const ddx = data.slps[soff + 3] - px, ddz = data.slps[soff + 4] - pz;
      if (ddx * ddx + ddz * ddz > VIEW_DIST_SQ) continue;
      _obj.position.set(data.slps[soff], data.slps[soff + 1], data.slps[soff + 2]);
      _q.set(data.slps[soff + 5], data.slps[soff + 6], data.slps[soff + 7], data.slps[soff + 8]);
      _obj.quaternion.copy(_q); _obj.scale.set(1, 1, 1); _obj.updateMatrix();
      slpRef.current?.setMatrixAt(slc, _obj.matrix);
      slc++;
    }
    if (slpRef.current) { slpRef.current.count = slc; slpRef.current.instanceMatrix.needsUpdate = true; }
  });

  return (
    <group name={`track-${name}`}>
      <instancedMesh ref={railLRef} args={[railGeo, railMat, MAX_VIS]} castShadow frustumCulled={false} />
      <instancedMesh ref={railRRef} args={[railGeo, railMat, MAX_VIS]} castShadow frustumCulled={false} />
      <instancedMesh ref={ballRef} args={[ballastGeo, ballastMat, MAX_VIS]} frustumCulled={false} />
      <instancedMesh ref={slpRef} args={[sleeperGeo, sleeperMat, MAX_VIS_SLP]} castShadow frustumCulled={false} />
    </group>
  );
});

interface Props { playerPositionRef: React.RefObject<THREE.Vector3>; }

export const RailwayTrack = memo(function RailwayTrack({ playerPositionRef }: Props) {
  return (
    <group name="railway-tracks">
      <TrackLine waypoints={LINE_A_WAYPOINTS} name="line-A" playerPositionRef={playerPositionRef} />
      <TrackLine waypoints={LINE_B_WAYPOINTS} name="line-B" playerPositionRef={playerPositionRef} />
    </group>
  );
});
