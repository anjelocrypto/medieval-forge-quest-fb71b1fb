/**
 * RailwayTrack — Renders visible track geometry (rails, sleepers, ballast)
 * along the v3 spline for both Line A and Line B.
 * Uses instanced meshes with distance-based LOD. Updates every 10 frames.
 */
import { useRef, useMemo, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LINE_A_WAYPOINTS, LINE_B_WAYPOINTS } from '../world/RailwayData';
import { buildRailwaySpline } from '../systems/RailwaySpline';

const GAUGE = 1.2;
const BALLAST_H = 0.15;
const SLEEPER_H = 0.12;
const RAIL_H = 0.15;
const SLEEPER_SPACING = 1.8;
const VIEW_DIST_SQ = 180 * 180;

const railMat = new THREE.MeshLambertMaterial({ color: '#3a3a3a' });
const sleeperMat = new THREE.MeshLambertMaterial({ color: '#5a3a1a' });
const ballastMat = new THREE.MeshLambertMaterial({ color: '#6a6050' });

const railGeo = new THREE.BoxGeometry(0.12, RAIL_H, 1);
const sleeperGeo = new THREE.BoxGeometry(2.0, SLEEPER_H, 0.3);
const ballastGeo = new THREE.BoxGeometry(3.0, BALLAST_H, 1);

const _obj = new THREE.Object3D();
const _up = new THREE.Vector3(0, 1, 0);

interface SegData {
  mx: number; mz: number;
  lx: number; ly: number; lz: number;
  rx: number; ry: number; rz: number;
  bx: number; by: number; bz: number;
  qx: number; qy: number; qz: number; qw: number;
  len: number;
}

interface SlpData {
  x: number; y: number; z: number; mx: number; mz: number;
  qx: number; qy: number; qz: number; qw: number;
}

function buildTrackData(waypoints: typeof LINE_A_WAYPOINTS) {
  const points = buildRailwaySpline(waypoints, 8);
  const segs: SegData[] = [];
  const slps: SlpData[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i], p1 = points[i + 1];
    const mx = (p0.x + p1.x) * 0.5, mz = (p0.z + p1.z) * 0.5, my = (p0.y + p1.y) * 0.5;
    const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 0.01) continue;

    const dir = new THREE.Vector3(dx / len, dy / len, dz / len);
    const cross = new THREE.Vector3(-dir.z, 0, dir.x);
    const q = new THREE.Quaternion();
    q.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, _up));

    const hOff = BALLAST_H + SLEEPER_H;
    segs.push({
      mx, mz,
      lx: mx + cross.x * (GAUGE / 2), ly: my + hOff + RAIL_H / 2, lz: mz + cross.z * (GAUGE / 2),
      rx: mx - cross.x * (GAUGE / 2), ry: my + hOff + RAIL_H / 2, rz: mz - cross.z * (GAUGE / 2),
      bx: mx, by: my + BALLAST_H / 2, bz: mz,
      qx: q.x, qy: q.y, qz: q.z, qw: q.w,
      len,
    });
  }

  // Sleepers
  let acc = 0, next = 0;
  for (let i = 1; i < points.length; i++) {
    const segLen = points[i].distanceTo(points[i - 1]);
    const dir = new THREE.Vector3().subVectors(points[i], points[i - 1]).normalize();
    const q = new THREE.Quaternion();
    q.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, _up));

    while (next <= acc + segLen) {
      const t = segLen > 0.01 ? (next - acc) / segLen : 0;
      const tt = Math.max(0, Math.min(1, t));
      const x = points[i - 1].x + (points[i].x - points[i - 1].x) * tt;
      const y = points[i - 1].y + (points[i].y - points[i - 1].y) * tt + BALLAST_H + SLEEPER_H / 2;
      const z = points[i - 1].z + (points[i].z - points[i - 1].z) * tt;
      slps.push({ x, y, z, mx: x, mz: z, qx: q.x, qy: q.y, qz: q.z, qw: q.w });
      next += SLEEPER_SPACING;
    }
    acc += segLen;
  }

  return { segs, slps };
}

const MAX_SEGS = 200;
const MAX_SLPS = 350;
const UPDATE_INTERVAL = 8; // update every N frames

const TrackLine = memo(function TrackLine({
  waypoints,
  name,
  playerPositionRef,
}: {
  waypoints: typeof LINE_A_WAYPOINTS;
  name: string;
  playerPositionRef: React.RefObject<THREE.Vector3>;
}) {
  const data = useMemo(() => buildTrackData(waypoints), [waypoints]);
  const railLRef = useRef<THREE.InstancedMesh>(null);
  const railRRef = useRef<THREE.InstancedMesh>(null);
  const ballRef = useRef<THREE.InstancedMesh>(null);
  const slpRef = useRef<THREE.InstancedMesh>(null);
  const frameCount = useRef(0);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % UPDATE_INTERVAL !== 0) return;

    const px = playerPositionRef.current?.x ?? 0;
    const pz = playerPositionRef.current?.z ?? 0;

    let sc = 0;
    for (let i = 0; i < data.segs.length && sc < MAX_SEGS; i++) {
      const s = data.segs[i];
      const ddx = s.mx - px, ddz = s.mz - pz;
      if (ddx * ddx + ddz * ddz > VIEW_DIST_SQ) continue;
      quat.set(s.qx, s.qy, s.qz, s.qw);

      _obj.position.set(s.lx, s.ly, s.lz); _obj.quaternion.copy(quat); _obj.scale.set(1, 1, s.len); _obj.updateMatrix();
      railLRef.current?.setMatrixAt(sc, _obj.matrix);

      _obj.position.set(s.rx, s.ry, s.rz); _obj.updateMatrix();
      railRRef.current?.setMatrixAt(sc, _obj.matrix);

      _obj.position.set(s.bx, s.by, s.bz); _obj.updateMatrix();
      ballRef.current?.setMatrixAt(sc, _obj.matrix);
      sc++;
    }
    if (railLRef.current) { railLRef.current.count = sc; railLRef.current.instanceMatrix.needsUpdate = true; }
    if (railRRef.current) { railRRef.current.count = sc; railRRef.current.instanceMatrix.needsUpdate = true; }
    if (ballRef.current) { ballRef.current.count = sc; ballRef.current.instanceMatrix.needsUpdate = true; }

    let slc = 0;
    for (let i = 0; i < data.slps.length && slc < MAX_SLPS; i++) {
      const s = data.slps[i];
      const ddx = s.mx - px, ddz = s.mz - pz;
      if (ddx * ddx + ddz * ddz > VIEW_DIST_SQ) continue;
      _obj.position.set(s.x, s.y, s.z);
      quat.set(s.qx, s.qy, s.qz, s.qw);
      _obj.quaternion.copy(quat); _obj.scale.set(1, 1, 1); _obj.updateMatrix();
      slpRef.current?.setMatrixAt(slc, _obj.matrix);
      slc++;
    }
    if (slpRef.current) { slpRef.current.count = slc; slpRef.current.instanceMatrix.needsUpdate = true; }
  });

  return (
    <group name={`track-${name}`}>
      <instancedMesh ref={railLRef} args={[railGeo, railMat, MAX_SEGS]} castShadow frustumCulled={false} />
      <instancedMesh ref={railRRef} args={[railGeo, railMat, MAX_SEGS]} castShadow frustumCulled={false} />
      <instancedMesh ref={ballRef} args={[ballastGeo, ballastMat, MAX_SEGS]} frustumCulled={false} />
      <instancedMesh ref={slpRef} args={[sleeperGeo, sleeperMat, MAX_SLPS]} castShadow frustumCulled={false} />
    </group>
  );
});

interface Props {
  playerPositionRef: React.RefObject<THREE.Vector3>;
}

export const RailwayTrack = memo(function RailwayTrack({ playerPositionRef }: Props) {
  return (
    <group name="railway-tracks">
      <TrackLine waypoints={LINE_A_WAYPOINTS} name="line-A" playerPositionRef={playerPositionRef} />
      <TrackLine waypoints={LINE_B_WAYPOINTS} name="line-B" playerPositionRef={playerPositionRef} />
    </group>
  );
});
