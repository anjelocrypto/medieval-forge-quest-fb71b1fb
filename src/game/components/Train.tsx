/**
 * Train — Deterministic clock-based train that loops along railway lines.
 * One train per line (A and B), each stopping 60s at every station.
 * Position is derived from a global clock so all players see the same state.
 */
import { useRef, useMemo, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  LINE_A_WAYPOINTS, LINE_B_WAYPOINTS,
  RAILWAY_STATIONS,
} from '../world/RailwayData';
import {
  buildRailwaySpline,
  getSplineLength,
  findNearestPointIndex,
  pointIndexToDistance,
} from '../systems/RailwaySpline';
import { GEO } from '../world/SettlementPieces';

const TRAIN_SPEED = 12;
const STATION_STOP_TIME = 60;

// Materials
const boilerMat = new THREE.MeshLambertMaterial({ color: '#3a3030' });
const cabMat = new THREE.MeshLambertMaterial({ color: '#4a3020' });
const chimneyMat = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });
const wheelMat = new THREE.MeshLambertMaterial({ color: '#222222' });
const detailMat = new THREE.MeshLambertMaterial({ color: '#8a7a3a' });
const bodyMat = new THREE.MeshLambertMaterial({ color: '#2a2a2a' });
const carBodyMat = new THREE.MeshLambertMaterial({ color: '#3a2818' });
const carRoofMat = new THREE.MeshLambertMaterial({ color: '#2a1a0a' });
const windowMat = new THREE.MeshLambertMaterial({ color: '#aaccdd', emissive: '#334455', emissiveIntensity: 0.2 });
const railMat = new THREE.MeshLambertMaterial({ color: '#333333' });

interface TrainLineConfig {
  points: THREE.Vector3[];
  totalLength: number;
  stationDistances: number[];
  cycleLength: number;
}

function buildTrainConfig(
  waypoints: typeof LINE_A_WAYPOINTS,
  lineId: 'A' | 'B',
): TrainLineConfig {
  const points = buildRailwaySpline(waypoints, 10);
  const totalLength = getSplineLength(points);

  const lineStations = RAILWAY_STATIONS.filter(s => s.line === lineId || s.line === 'AB');
  const stationDistances: number[] = [];
  for (const stn of lineStations) {
    const idx = findNearestPointIndex(points, stn.position[0], stn.position[1]);
    stationDistances.push(pointIndexToDistance(points, idx));
  }
  stationDistances.sort((a, b) => a - b);

  const travelTime = totalLength / TRAIN_SPEED;
  const stopsTime = stationDistances.length * STATION_STOP_TIME;
  const cycleLength = (travelTime + stopsTime) * 2;

  return { points, totalLength, stationDistances, cycleLength };
}

function getTrainDistance(config: TrainLineConfig, globalTime: number): {
  distance: number;
  isStopped: boolean;
  direction: 1 | -1;
} {
  const halfCycle = config.cycleLength / 2;
  const cycleTime = ((globalTime % config.cycleLength) + config.cycleLength) % config.cycleLength;
  const isReverse = cycleTime >= halfCycle;
  const halfTime = isReverse ? cycleTime - halfCycle : cycleTime;

  let elapsed = halfTime;
  let dist = 0;
  const stations = isReverse
    ? [...config.stationDistances].reverse().map(d => config.totalLength - d)
    : [...config.stationDistances];

  let stationIdx = 0;
  let stopped = false;

  while (elapsed > 0 && dist < config.totalLength) {
    if (stationIdx < stations.length) {
      const nextStation = stations[stationIdx];
      const distToStation = nextStation - dist;
      if (distToStation <= 0) { stationIdx++; continue; }
      const travelToStation = distToStation / TRAIN_SPEED;
      if (elapsed < travelToStation) {
        dist += elapsed * TRAIN_SPEED;
        elapsed = 0;
      } else {
        elapsed -= travelToStation;
        dist = nextStation;
        if (elapsed < STATION_STOP_TIME) {
          stopped = true;
          elapsed = 0;
        } else {
          elapsed -= STATION_STOP_TIME;
          stationIdx++;
        }
      }
    } else {
      dist += elapsed * TRAIN_SPEED;
      elapsed = 0;
    }
  }

  dist = Math.min(dist, config.totalLength - 1);
  const actualDist = isReverse ? config.totalLength - dist : dist;
  return { distance: actualDist, isStopped: stopped, direction: isReverse ? -1 : 1 };
}

/** Cheaply sample position + tangent from pre-built points array at arc distance */
function sampleAtDist(points: THREE.Vector3[], totalLen: number, distance: number, outPos: THREE.Vector3, outTan: THREE.Vector3) {
  const d = ((distance % totalLen) + totalLen) % totalLen;
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const segLen = points[i].distanceTo(points[i - 1]);
    if (acc + segLen >= d) {
      const t = segLen > 0.001 ? (d - acc) / segLen : 0;
      outPos.lerpVectors(points[i - 1], points[i], t);
      outTan.subVectors(points[i], points[i - 1]).normalize();
      return;
    }
    acc += segLen;
  }
  outPos.copy(points[points.length - 1]);
  outTan.subVectors(points[points.length - 1], points[points.length - 2]).normalize();
}

function Locomotive() {
  return (
    <group>
      <mesh geometry={GEO.cyl8} scale={[0.7, 3.5, 0.7]} position={[0, 1.2, 1.0]} rotation={[Math.PI / 2, 0, 0]} material={boilerMat} castShadow />
      <mesh geometry={GEO.box} scale={[1.8, 1.8, 2.0]} position={[0, 1.4, -1.2]} material={cabMat} castShadow />
      <mesh geometry={GEO.box} scale={[2.0, 0.12, 2.2]} position={[0, 2.35, -1.2]} material={carRoofMat} castShadow />
      <mesh geometry={GEO.cyl8} scale={[0.3, 1.0, 0.3]} position={[0, 2.0, 2.2]} material={chimneyMat} castShadow />
      <mesh geometry={GEO.cyl8} scale={[0.4, 0.15, 0.4]} position={[0, 2.55, 2.2]} material={chimneyMat} castShadow />
      <mesh geometry={GEO.box} scale={[1.6, 0.3, 0.6]} position={[0, 0.3, 3.0]} material={bodyMat} castShadow />
      <mesh geometry={GEO.sphere8} scale={[0.35, 0.35, 0.35]} position={[0, 2.0, 0.5]} material={detailMat} castShadow />
      {[-0.8, 0.8].map(xOff =>
        [0, 1.5, -1.2].map((zOff, i) => (
          <mesh key={`${xOff}-${i}`} geometry={GEO.cyl8} scale={[0.4, 0.1, 0.4]} position={[xOff, 0.4, zOff]} rotation={[0, 0, Math.PI / 2]} material={wheelMat} />
        ))
      )}
      <mesh geometry={GEO.box} scale={[1.6, 0.15, 6.0]} position={[0, 0.15, 0.5]} material={bodyMat} />
      {/* Headlight glow — mesh only, no pointLight for performance */}
      <mesh geometry={GEO.sphere8} scale={[0.15, 0.15, 0.15]} position={[0, 1.8, 3.0]} material={detailMat} />
    </group>
  );
}

function PassengerCar({ offset }: { offset: number }) {
  return (
    <group position={[0, 0, offset]}>
      <mesh geometry={GEO.box} scale={[1.8, 1.5, 5.0]} position={[0, 1.1, 0]} material={carBodyMat} castShadow />
      <mesh geometry={GEO.box} scale={[2.0, 0.15, 5.2]} position={[0, 1.9, 0]} material={carRoofMat} castShadow />
      {[-1.5, -0.5, 0.5, 1.5].map((zOff, i) => (
        <group key={i}>
          <mesh geometry={GEO.box} scale={[0.02, 0.5, 0.6]} position={[0.91, 1.3, zOff]} material={windowMat} />
          <mesh geometry={GEO.box} scale={[0.02, 0.5, 0.6]} position={[-0.91, 1.3, zOff]} material={windowMat} />
        </group>
      ))}
      {[-0.8, 0.8].map(xOff =>
        [-1.5, 1.5].map((zOff, i) => (
          <mesh key={`${xOff}-${i}`} geometry={GEO.cyl8} scale={[0.35, 0.08, 0.35]} position={[xOff, 0.35, zOff]} rotation={[0, 0, Math.PI / 2]} material={wheelMat} />
        ))
      )}
      <mesh geometry={GEO.box} scale={[1.4, 0.12, 5.0]} position={[0, 0.12, 0]} material={bodyMat} />
    </group>
  );
}

const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

const TrainOnLine = memo(function TrainOnLine({ lineId, config }: { lineId: string; config: TrainLineConfig }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const globalTime = Date.now() / 1000;
    const { distance, direction } = getTrainDistance(config, globalTime);
    sampleAtDist(config.points, config.totalLength, distance, _pos, _tan);
    if (direction === -1) _tan.negate();

    groupRef.current.position.copy(_pos);
    _lookTarget.copy(_pos).add(_tan);
    groupRef.current.lookAt(_lookTarget);
  });

  return (
    <group ref={groupRef} name={`train-${lineId}`}>
      <Locomotive />
      <PassengerCar offset={-4.5} />
      <PassengerCar offset={-10} />
    </group>
  );
});

export const Train = memo(function Train() {
  const configA = useMemo(() => buildTrainConfig(LINE_A_WAYPOINTS, 'A'), []);
  const configB = useMemo(() => buildTrainConfig(LINE_B_WAYPOINTS, 'B'), []);

  return (
    <group name="trains">
      <TrainOnLine lineId="A" config={configA} />
      <TrainOnLine lineId="B" config={configB} />
    </group>
  );
});
