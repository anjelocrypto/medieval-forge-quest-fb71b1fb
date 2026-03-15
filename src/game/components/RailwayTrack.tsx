/**
 * RailwayTrack — Static merged BufferGeometry for rails, sleepers, ballast.
 * Built ONCE at mount. Zero per-frame updates. Zero useFrame. Pure static world mesh.
 */
import { useMemo, memo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LINE_A_WAYPOINTS, LINE_B_WAYPOINTS, RailwayWaypoint } from '../world/RailwayData';
import { getTerrainHeight } from './Terrain';

const GAUGE = 1.2;
const BALLAST_H = 0.15;
const SLEEPER_H = 0.12;
const RAIL_H = 0.15;
const RAIL_Y_OFF = BALLAST_H + SLEEPER_H + RAIL_H / 2;
const SLP_Y_OFF = BALLAST_H + SLEEPER_H / 2;
const SLEEPER_SPACING = 2.0;
const TRACK_HEIGHT_OFFSET = 0.35;
const SUBDIV = 4;

const railMat = new THREE.MeshLambertMaterial({ color: '#3a3a3a' });
const sleeperMat = new THREE.MeshLambertMaterial({ color: '#5a3a1a' });
const ballastMat = new THREE.MeshLambertMaterial({ color: '#6a6050' });

// Shared template geometries (cloned + transformed per segment)
const _railTemplate = new THREE.BoxGeometry(0.12, RAIL_H, 1);
const _sleeperTemplate = new THREE.BoxGeometry(2.0, SLEEPER_H, 0.3);
const _ballastTemplate = new THREE.BoxGeometry(3.0, BALLAST_H, 1);

const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _zero = new THREE.Vector3(0, 0, 0);
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _cross = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();

function buildSplinePoints(wps: RailwayWaypoint[]): Float32Array {
  const total = (wps.length - 1) * SUBDIV + 1;
  const arr = new Float32Array(total * 3);
  let idx = 0;
  for (let i = 0; i < wps.length - 1; i++) {
    for (let s = 0; s < SUBDIV; s++) {
      const t = s / SUBDIV;
      const x = wps[i].x + (wps[i + 1].x - wps[i].x) * t;
      const z = wps[i].z + (wps[i + 1].z - wps[i].z) * t;
      arr[idx++] = x;
      arr[idx++] = getTerrainHeight(x, z) + TRACK_HEIGHT_OFFSET;
      arr[idx++] = z;
    }
  }
  const last = wps[wps.length - 1];
  arr[idx++] = last.x;
  arr[idx++] = getTerrainHeight(last.x, last.z) + TRACK_HEIGHT_OFFSET;
  arr[idx++] = last.z;
  return arr;
}

interface StaticTrackGeometry {
  railL: THREE.BufferGeometry;
  railR: THREE.BufferGeometry;
  ballast: THREE.BufferGeometry;
  sleepers: THREE.BufferGeometry;
}

function buildStaticTrackGeometry(wps: RailwayWaypoint[]): StaticTrackGeometry {
  const pts = buildSplinePoints(wps);
  const numPts = pts.length / 3;

  const railLGeos: THREE.BufferGeometry[] = [];
  const railRGeos: THREE.BufferGeometry[] = [];
  const ballastGeos: THREE.BufferGeometry[] = [];
  const sleeperGeos: THREE.BufferGeometry[] = [];

  // Build rail/ballast segments
  for (let i = 0; i < numPts - 1; i++) {
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

    // Left rail
    _pos.set(mx + _cross.x * (GAUGE / 2), my + RAIL_Y_OFF, mz + _cross.z * (GAUGE / 2));
    _scale.set(1, 1, len);
    _m4.compose(_pos, _q, _scale);
    const lGeo = _railTemplate.clone().applyMatrix4(_m4);
    railLGeos.push(lGeo);

    // Right rail
    _pos.set(mx - _cross.x * (GAUGE / 2), my + RAIL_Y_OFF, mz - _cross.z * (GAUGE / 2));
    _m4.compose(_pos, _q, _scale);
    const rGeo = _railTemplate.clone().applyMatrix4(_m4);
    railRGeos.push(rGeo);

    // Ballast
    _pos.set(mx, my + BALLAST_H / 2, mz);
    _m4.compose(_pos, _q, _scale);
    const bGeo = _ballastTemplate.clone().applyMatrix4(_m4);
    ballastGeos.push(bGeo);
  }

  // Build sleepers along path
  let acc = 0, nextDist = 0;
  for (let i = 1; i < numPts; i++) {
    const i3 = i * 3, p3 = (i - 1) * 3;
    const dx = pts[i3] - pts[p3], dy = pts[i3 + 1] - pts[p3 + 1], dz = pts[i3 + 2] - pts[p3 + 2];
    const segLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (segLen < 0.01) { acc += segLen; continue; }

    _dir.set(dx / segLen, dy / segLen, dz / segLen);
    _m4.lookAt(_zero, _dir, _up);
    _q.setFromRotationMatrix(_m4);

    while (nextDist <= acc + segLen) {
      const t = Math.max(0, Math.min(1, (nextDist - acc) / segLen));
      _pos.set(
        pts[p3] + dx * t,
        pts[p3 + 1] + dy * t + SLP_Y_OFF - TRACK_HEIGHT_OFFSET,
        pts[p3 + 2] + dz * t,
      );
      _scale.set(1, 1, 1);
      _m4.compose(_pos, _q, _scale);
      sleeperGeos.push(_sleeperTemplate.clone().applyMatrix4(_m4));
      nextDist += SLEEPER_SPACING;
    }
    acc += segLen;
  }

  const railL = mergeGeometries(railLGeos, false);
  const railR = mergeGeometries(railRGeos, false);
  const ballast = mergeGeometries(ballastGeos, false);
  const sleepers = mergeGeometries(sleeperGeos, false);

  // Dispose intermediate clones
  railLGeos.forEach(g => g.dispose());
  railRGeos.forEach(g => g.dispose());
  ballastGeos.forEach(g => g.dispose());
  sleeperGeos.forEach(g => g.dispose());

  console.log(`[RailwayTrack] Static geometry built: ${railLGeos.length} rail segs, ${sleeperGeos.length} sleepers`);

  return { railL, railR, ballast, sleepers };
}

const StaticTrackLine = memo(function StaticTrackLine({
  waypoints, name,
}: {
  waypoints: RailwayWaypoint[]; name: string;
}) {
  const geo = useMemo(() => buildStaticTrackGeometry(waypoints), [waypoints]);

  return (
    <group name={`track-${name}`}>
      <mesh geometry={geo.railL} material={railMat} castShadow />
      <mesh geometry={geo.railR} material={railMat} castShadow />
      <mesh geometry={geo.ballast} material={ballastMat} />
      <mesh geometry={geo.sleepers} material={sleeperMat} castShadow />
    </group>
  );
});

export const RailwayTrack = memo(function RailwayTrack() {
  return (
    <group name="railway-tracks">
      <StaticTrackLine waypoints={LINE_A_WAYPOINTS} name="line-A" />
      <StaticTrackLine waypoints={LINE_B_WAYPOINTS} name="line-B" />
    </group>
  );
});
