/**
 * RailwayTrack — Renders visible track geometry (rails, sleepers, ballast)
 * along the v3 spline for both Line A and Line B.
 * Uses instanced meshes for performance. LOD culled by player distance.
 */
import { useRef, useMemo, memo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LINE_A_WAYPOINTS, LINE_B_WAYPOINTS } from '../world/RailwayData';
import { buildRailwaySpline } from '../systems/RailwaySpline';

const GAUGE = 1.2;
const RAIL_W = 0.12;
const RAIL_H = 0.15;
const SLEEPER_W = 2.0;
const SLEEPER_H = 0.12;
const SLEEPER_D = 0.3;
const SLEEPER_SPACING = 1.8;
const BALLAST_W = 3.0;
const BALLAST_H = 0.15;
const VIEW_DIST = 200; // only render track within this distance of player
const VIEW_DIST_SQ = VIEW_DIST * VIEW_DIST;

const railMat = new THREE.MeshLambertMaterial({ color: '#3a3a3a' });
const sleeperMat = new THREE.MeshLambertMaterial({ color: '#5a3a1a' });
const ballastMat = new THREE.MeshLambertMaterial({ color: '#6a6050' });

const railGeo = new THREE.BoxGeometry(RAIL_W, RAIL_H, 1);
const sleeperGeo = new THREE.BoxGeometry(SLEEPER_W, SLEEPER_H, SLEEPER_D);
const ballastGeo = new THREE.BoxGeometry(BALLAST_W, BALLAST_H, 1);

const _obj = new THREE.Object3D();
const _up = new THREE.Vector3(0, 1, 0);

interface SegData {
  mx: number; mz: number; // midpoint for culling
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  len: number;
}

interface SleeperData {
  mx: number; mz: number;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
}

interface TrackData {
  railL: SegData[];
  railR: SegData[];
  ballast: SegData[];
  sleepers: SleeperData[];
}

function buildTrackData(waypoints: typeof LINE_A_WAYPOINTS): TrackData {
  const points = buildRailwaySpline(waypoints, 10);
  const segCount = points.length - 1;

  const railL: SegData[] = [];
  const railR: SegData[] = [];
  const ballast: SegData[] = [];
  const sleepers: SleeperData[] = [];

  for (let i = 0; i < segCount; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(p1, p0);
    const segLen = dir.length();
    if (segLen < 0.01) continue;
    dir.normalize();
    const cross = new THREE.Vector3(-dir.z, 0, dir.x);
    const quat = new THREE.Quaternion();
    const lookMat = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), dir, _up);
    quat.setFromRotationMatrix(lookMat);

    const lp = mid.clone().add(cross.clone().multiplyScalar(GAUGE / 2));
    lp.y += BALLAST_H + SLEEPER_H + RAIL_H / 2;
    railL.push({ mx: mid.x, mz: mid.z, pos: lp, quat: quat.clone(), len: segLen });

    const rp = mid.clone().add(cross.clone().multiplyScalar(-GAUGE / 2));
    rp.y += BALLAST_H + SLEEPER_H + RAIL_H / 2;
    railR.push({ mx: mid.x, mz: mid.z, pos: rp, quat: quat.clone(), len: segLen });

    const bp = mid.clone();
    bp.y += BALLAST_H / 2;
    ballast.push({ mx: mid.x, mz: mid.z, pos: bp, quat: quat.clone(), len: segLen });
  }

  let distAccum = 0;
  let nextSleeperDist = 0;
  for (let i = 1; i < points.length; i++) {
    const segLen = points[i].distanceTo(points[i - 1]);
    const dir = new THREE.Vector3().subVectors(points[i], points[i - 1]).normalize();
    while (nextSleeperDist <= distAccum + segLen) {
      const t = segLen > 0.01 ? (nextSleeperDist - distAccum) / segLen : 0;
      const pos = new THREE.Vector3().lerpVectors(points[i - 1], points[i], Math.min(1, Math.max(0, t)));
      pos.y += BALLAST_H + SLEEPER_H / 2;
      const quat = new THREE.Quaternion();
      const lookMat = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), dir, _up);
      quat.setFromRotationMatrix(lookMat);
      sleepers.push({ mx: pos.x, mz: pos.z, pos, quat });
      nextSleeperDist += SLEEPER_SPACING;
    }
    distAccum += segLen;
  }

  return { railL, railR, ballast, sleepers };
}

const MAX_VISIBLE_SEGS = 300;
const MAX_VISIBLE_SLEEPERS = 500;

const TrackLineSimple = memo(function TrackLineSimple({
  waypoints,
  name,
  playerPositionRef,
}: {
  waypoints: typeof LINE_A_WAYPOINTS;
  name: string;
  playerPositionRef: React.RefObject<THREE.Vector3>;
}) {
  const data = useMemo(() => buildTrackData(waypoints), [waypoints]);

  const railLMesh = useRef<THREE.InstancedMesh>(null);
  const railRMesh = useRef<THREE.InstancedMesh>(null);
  const ballastMesh = useRef<THREE.InstancedMesh>(null);
  const sleeperMesh = useRef<THREE.InstancedMesh>(null);

  // Update visible instances each frame based on player distance
  useFrame(() => {
    const px = playerPositionRef.current?.x ?? 0;
    const pz = playerPositionRef.current?.z ?? 0;

    // Rails & ballast
    let visCount = 0;
    for (let i = 0; i < data.railL.length && visCount < MAX_VISIBLE_SEGS; i++) {
      const s = data.railL[i];
      const dx = s.mx - px, dz = s.mz - pz;
      if (dx * dx + dz * dz > VIEW_DIST_SQ) continue;

      // Left rail
      _obj.position.copy(s.pos);
      _obj.quaternion.copy(s.quat);
      _obj.scale.set(1, 1, s.len);
      _obj.updateMatrix();
      railLMesh.current?.setMatrixAt(visCount, _obj.matrix);

      // Right rail
      const r = data.railR[i];
      _obj.position.copy(r.pos);
      _obj.quaternion.copy(r.quat);
      _obj.scale.set(1, 1, r.len);
      _obj.updateMatrix();
      railRMesh.current?.setMatrixAt(visCount, _obj.matrix);

      // Ballast
      const b = data.ballast[i];
      _obj.position.copy(b.pos);
      _obj.quaternion.copy(b.quat);
      _obj.scale.set(1, 1, b.len);
      _obj.updateMatrix();
      ballastMesh.current?.setMatrixAt(visCount, _obj.matrix);

      visCount++;
    }

    if (railLMesh.current) { railLMesh.current.count = visCount; railLMesh.current.instanceMatrix.needsUpdate = true; }
    if (railRMesh.current) { railRMesh.current.count = visCount; railRMesh.current.instanceMatrix.needsUpdate = true; }
    if (ballastMesh.current) { ballastMesh.current.count = visCount; ballastMesh.current.instanceMatrix.needsUpdate = true; }

    // Sleepers
    let slpCount = 0;
    for (let i = 0; i < data.sleepers.length && slpCount < MAX_VISIBLE_SLEEPERS; i++) {
      const s = data.sleepers[i];
      const dx = s.mx - px, dz = s.mz - pz;
      if (dx * dx + dz * dz > VIEW_DIST_SQ) continue;
      _obj.position.copy(s.pos);
      _obj.quaternion.copy(s.quat);
      _obj.scale.set(1, 1, 1);
      _obj.updateMatrix();
      sleeperMesh.current?.setMatrixAt(slpCount, _obj.matrix);
      slpCount++;
    }
    if (sleeperMesh.current) { sleeperMesh.current.count = slpCount; sleeperMesh.current.instanceMatrix.needsUpdate = true; }
  });

  return (
    <group name={`track-${name}`}>
      <instancedMesh ref={railLMesh} args={[railGeo, railMat, MAX_VISIBLE_SEGS]} castShadow frustumCulled={false} />
      <instancedMesh ref={railRMesh} args={[railGeo, railMat, MAX_VISIBLE_SEGS]} castShadow frustumCulled={false} />
      <instancedMesh ref={ballastMesh} args={[ballastGeo, ballastMat, MAX_VISIBLE_SEGS]} frustumCulled={false} />
      <instancedMesh ref={sleeperMesh} args={[sleeperGeo, sleeperMat, MAX_VISIBLE_SLEEPERS]} castShadow frustumCulled={false} />
    </group>
  );
});

interface Props {
  playerPositionRef: React.RefObject<THREE.Vector3>;
}

export const RailwayTrack = memo(function RailwayTrack({ playerPositionRef }: Props) {
  return (
    <group name="railway-tracks">
      <TrackLineSimple waypoints={LINE_A_WAYPOINTS} name="line-A" playerPositionRef={playerPositionRef} />
      <TrackLineSimple waypoints={LINE_B_WAYPOINTS} name="line-B" playerPositionRef={playerPositionRef} />
    </group>
  );
});
