/**
 * RailwayTrack — Renders visible track geometry (rails, sleepers, ballast)
 * along the v3 spline for both Line A and Line B.
 * Uses instanced meshes for performance.
 */
import { useMemo, memo } from 'react';
import * as THREE from 'three';
import { LINE_A_WAYPOINTS, LINE_B_WAYPOINTS } from '../world/RailwayData';
import { buildRailwaySpline } from '../systems/RailwaySpline';

const GAUGE = 1.2;        // rail-to-rail distance
const RAIL_W = 0.12;      // rail width
const RAIL_H = 0.15;      // rail height
const SLEEPER_W = 2.0;    // sleeper length (cross-track)
const SLEEPER_H = 0.12;   // sleeper height
const SLEEPER_D = 0.3;    // sleeper depth (along track)
const SLEEPER_SPACING = 1.8; // meters between sleepers
const BALLAST_W = 3.0;    // ballast bed width
const BALLAST_H = 0.15;   // ballast height

// Materials
const railMat = new THREE.MeshLambertMaterial({ color: '#3a3a3a' }); // dark iron
const sleeperMat = new THREE.MeshLambertMaterial({ color: '#5a3a1a' }); // dark wood
const ballastMat = new THREE.MeshLambertMaterial({ color: '#6a6050' }); // gravel

// Shared geos
const railGeo = new THREE.BoxGeometry(RAIL_W, RAIL_H, 1);
const sleeperGeo = new THREE.BoxGeometry(SLEEPER_W, SLEEPER_H, SLEEPER_D);
const ballastGeo = new THREE.BoxGeometry(BALLAST_W, BALLAST_H, 1);

const _obj = new THREE.Object3D();
const _up = new THREE.Vector3(0, 1, 0);

function TrackLine({ waypoints, name }: { waypoints: typeof LINE_A_WAYPOINTS; name: string }) {
  const { railCount, sleeperCount, railMatricesL, railMatricesR, sleeperMatrices, ballastMatrices } = useMemo(() => {
    const points = buildRailwaySpline(waypoints, 14);

    // Build rail segments — one instanced box per segment between consecutive points
    const segCount = points.length - 1;
    const railLArr: THREE.Matrix4[] = [];
    const railRArr: THREE.Matrix4[] = [];
    const ballArr: THREE.Matrix4[] = [];

    for (let i = 0; i < segCount; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(p1, p0);
      const segLen = dir.length();
      dir.normalize();

      // Cross direction (perpendicular to track direction on XZ plane)
      const cross = new THREE.Vector3(-dir.z, 0, dir.x);
      
      const quat = new THREE.Quaternion();
      const mat4 = new THREE.Matrix4();

      // Look rotation for rail direction
      const lookTarget = new THREE.Vector3().addVectors(mid, dir);
      _obj.position.copy(mid);
      _obj.lookAt(lookTarget);

      // Left rail
      const leftPos = mid.clone().add(cross.clone().multiplyScalar(GAUGE / 2));
      leftPos.y += BALLAST_H + SLEEPER_H + RAIL_H / 2;
      _obj.position.copy(leftPos);
      _obj.lookAt(leftPos.clone().add(dir));
      _obj.scale.set(1, 1, segLen);
      _obj.updateMatrix();
      railLArr.push(_obj.matrix.clone());

      // Right rail
      const rightPos = mid.clone().add(cross.clone().multiplyScalar(-GAUGE / 2));
      rightPos.y += BALLAST_H + SLEEPER_H + RAIL_H / 2;
      _obj.position.copy(rightPos);
      _obj.lookAt(rightPos.clone().add(dir));
      _obj.scale.set(1, 1, segLen);
      _obj.updateMatrix();
      railRArr.push(_obj.matrix.clone());

      // Ballast
      _obj.position.copy(mid);
      _obj.position.y += BALLAST_H / 2;
      _obj.lookAt(mid.clone().add(dir));
      _obj.scale.set(1, 1, segLen);
      _obj.updateMatrix();
      ballArr.push(_obj.matrix.clone());
    }

    // Build sleepers — placed at regular intervals along the path
    const slpArr: THREE.Matrix4[] = [];
    let distAccum = 0;
    let nextSleeper = 0;
    for (let i = 1; i < points.length; i++) {
      const segLen = points[i].distanceTo(points[i - 1]);
      const dir = new THREE.Vector3().subVectors(points[i], points[i - 1]).normalize();
      
      while (nextSleeper <= distAccum + segLen) {
        const t = (nextSleeper - distAccum) / segLen;
        const pos = new THREE.Vector3().lerpVectors(points[i - 1], points[i], t);
        pos.y += BALLAST_H + SLEEPER_H / 2;
        
        _obj.position.copy(pos);
        _obj.lookAt(pos.clone().add(dir));
        _obj.scale.set(1, 1, 1);
        _obj.updateMatrix();
        slpArr.push(_obj.matrix.clone());
        
        nextSleeper += SLEEPER_SPACING;
      }
      distAccum += segLen;
    }

    return {
      railCount: railLArr.length,
      sleeperCount: slpArr.length,
      railMatricesL: railLArr,
      railMatricesR: railRArr,
      sleeperMatrices: slpArr,
      ballastMatrices: ballArr,
    };
  }, [waypoints]);

  return (
    <group name={`track-${name}`}>
      {/* Left Rail */}
      <instancedMesh args={[railGeo, railMat, railCount]} castShadow>
        {useMemo(() => {
          const mesh = new THREE.InstancedMesh(railGeo, railMat, railCount);
          railMatricesL.forEach((m, i) => mesh.setMatrixAt(i, m));
          mesh.instanceMatrix.needsUpdate = true;
          return null;
        }, [railCount, railMatricesL])}
        <primitive object={(() => {
          const mesh = new THREE.InstancedMesh(railGeo, railMat, railCount);
          railMatricesL.forEach((m, i) => mesh.setMatrixAt(i, m));
          mesh.instanceMatrix.needsUpdate = true;
          return mesh;
        })()} />
      </instancedMesh>
    </group>
  );
}

// Simpler approach: use a single component that renders all track geometry
const TrackLineSimple = memo(function TrackLineSimple({ waypoints, name }: { waypoints: typeof LINE_A_WAYPOINTS; name: string }) {
  const meshData = useMemo(() => {
    const points = buildRailwaySpline(waypoints, 14);
    const segCount = points.length - 1;

    // Pre-compute all transforms
    const railL: { pos: THREE.Vector3; quat: THREE.Quaternion; len: number }[] = [];
    const railR: { pos: THREE.Vector3; quat: THREE.Quaternion; len: number }[] = [];
    const ballast: { pos: THREE.Vector3; quat: THREE.Quaternion; len: number }[] = [];
    const sleepers: { pos: THREE.Vector3; quat: THREE.Quaternion }[] = [];

    for (let i = 0; i < segCount; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(p1, p0);
      const segLen = dir.length();
      if (segLen < 0.01) continue;
      dir.normalize();
      const cross = new THREE.Vector3(-dir.z, 0, dir.x);

      // Quaternion from direction
      const quat = new THREE.Quaternion();
      const lookMat = new THREE.Matrix4().lookAt(
        new THREE.Vector3(0, 0, 0), dir, _up
      );
      quat.setFromRotationMatrix(lookMat);

      const lp = mid.clone().add(cross.clone().multiplyScalar(GAUGE / 2));
      lp.y += BALLAST_H + SLEEPER_H + RAIL_H / 2;
      railL.push({ pos: lp, quat: quat.clone(), len: segLen });

      const rp = mid.clone().add(cross.clone().multiplyScalar(-GAUGE / 2));
      rp.y += BALLAST_H + SLEEPER_H + RAIL_H / 2;
      railR.push({ pos: rp, quat: quat.clone(), len: segLen });

      const bp = mid.clone();
      bp.y += BALLAST_H / 2;
      ballast.push({ pos: bp, quat: quat.clone(), len: segLen });
    }

    // Sleepers at regular intervals
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
        sleepers.push({ pos, quat });
        nextSleeperDist += SLEEPER_SPACING;
      }
      distAccum += segLen;
    }

    return { railL, railR, ballast, sleepers };
  }, [waypoints]);

  // Use instanced meshes via refs
  const railLRef = useMemo(() => {
    const count = meshData.railL.length;
    const mesh = new THREE.InstancedMesh(railGeo, railMat, count);
    meshData.railL.forEach((d, i) => {
      _obj.position.copy(d.pos);
      _obj.quaternion.copy(d.quat);
      _obj.scale.set(1, 1, d.len);
      _obj.updateMatrix();
      mesh.setMatrixAt(i, _obj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    return mesh;
  }, [meshData]);

  const railRRef = useMemo(() => {
    const count = meshData.railR.length;
    const mesh = new THREE.InstancedMesh(railGeo, railMat, count);
    meshData.railR.forEach((d, i) => {
      _obj.position.copy(d.pos);
      _obj.quaternion.copy(d.quat);
      _obj.scale.set(1, 1, d.len);
      _obj.updateMatrix();
      mesh.setMatrixAt(i, _obj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    return mesh;
  }, [meshData]);

  const ballastRef = useMemo(() => {
    const count = meshData.ballast.length;
    const mesh = new THREE.InstancedMesh(ballastGeo, ballastMat, count);
    meshData.ballast.forEach((d, i) => {
      _obj.position.copy(d.pos);
      _obj.quaternion.copy(d.quat);
      _obj.scale.set(1, 1, d.len);
      _obj.updateMatrix();
      mesh.setMatrixAt(i, _obj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [meshData]);

  const sleeperRef = useMemo(() => {
    const count = meshData.sleepers.length;
    const mesh = new THREE.InstancedMesh(sleeperGeo, sleeperMat, count);
    meshData.sleepers.forEach((d, i) => {
      _obj.position.copy(d.pos);
      _obj.quaternion.copy(d.quat);
      _obj.scale.set(1, 1, 1);
      _obj.updateMatrix();
      mesh.setMatrixAt(i, _obj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    return mesh;
  }, [meshData]);

  return (
    <group name={`track-${name}`}>
      <primitive object={railLRef} />
      <primitive object={railRRef} />
      <primitive object={ballastRef} />
      <primitive object={sleeperRef} />
    </group>
  );
});

export const RailwayTrack = memo(function RailwayTrack() {
  return (
    <group name="railway-tracks">
      <TrackLineSimple waypoints={LINE_A_WAYPOINTS} name="line-A" />
      <TrackLineSimple waypoints={LINE_B_WAYPOINTS} name="line-B" />
    </group>
  );
});
