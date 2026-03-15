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
  sampleSplineAtDistance,
  findNearestPointIndex,
  pointIndexToDistance,
} from '../systems/RailwaySpline';
import { GEO } from '../world/SettlementPieces';

// Train config
const TRAIN_SPEED = 12; // units per second
const STATION_STOP_TIME = 60; // seconds at each station

// Materials
const bodyMat = new THREE.MeshLambertMaterial({ color: '#2a2a2a' }); // dark iron
const boilerMat = new THREE.MeshLambertMaterial({ color: '#3a3030' }); // dark red-brown
const cabMat = new THREE.MeshLambertMaterial({ color: '#4a3020' }); // wood cab
const chimneyMat = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });
const wheelMat = new THREE.MeshLambertMaterial({ color: '#222222' });
const detailMat = new THREE.MeshLambertMaterial({ color: '#8a7a3a' }); // brass
const carBodyMat = new THREE.MeshLambertMaterial({ color: '#3a2818' }); // dark wood
const carRoofMat = new THREE.MeshLambertMaterial({ color: '#2a1a0a' });
const windowMat = new THREE.MeshLambertMaterial({ color: '#aaccdd', emissive: '#334455', emissiveIntensity: 0.2 });

interface TrainLineConfig {
  points: THREE.Vector3[];
  totalLength: number;
  stationDistances: number[]; // arc-length distances to each station
  cycleLength: number; // total time for one full cycle (travel + stops)
}

function buildTrainConfig(
  waypoints: typeof LINE_A_WAYPOINTS,
  lineId: 'A' | 'B',
): TrainLineConfig {
  const points = buildRailwaySpline(waypoints, 14);
  const totalLength = getSplineLength(points);

  // Find station distances along this line
  const lineStations = RAILWAY_STATIONS.filter(
    s => s.line === lineId || s.line === 'AB'
  );

  // Get distances in order they appear along the path
  const stationDistances: number[] = [];
  for (const stn of lineStations) {
    const idx = findNearestPointIndex(points, stn.position[0], stn.position[1]);
    stationDistances.push(pointIndexToDistance(points, idx));
  }
  stationDistances.sort((a, b) => a - b);

  // Total cycle = forward trip + stops + reverse trip + stops
  // We'll do a simple ping-pong: forward then reverse
  const travelTime = totalLength / TRAIN_SPEED;
  const stopsTime = stationDistances.length * STATION_STOP_TIME;
  const cycleLength = (travelTime + stopsTime) * 2; // forward + reverse

  return { points, totalLength, stationDistances, cycleLength };
}

/**
 * Given a global time, compute the train's distance along the path.
 * The train ping-pongs: travels forward stopping at each station,
 * then reverses back stopping again.
 */
function getTrainDistance(config: TrainLineConfig, globalTime: number): {
  distance: number;
  isStopped: boolean;
  direction: 1 | -1;
} {
  const halfCycle = config.cycleLength / 2;
  const cycleTime = ((globalTime % config.cycleLength) + config.cycleLength) % config.cycleLength;
  const isReverse = cycleTime >= halfCycle;
  const halfTime = isReverse ? cycleTime - halfCycle : cycleTime;

  // In each half-cycle the train must travel totalLength and stop at N stations
  // We simulate step by step
  let elapsed = halfTime;
  let dist = 0;
  const stations = isReverse
    ? [...config.stationDistances].reverse().map(d => config.totalLength - d)
    : [...config.stationDistances];

  let stationIdx = 0;
  let stopped = false;

  while (elapsed > 0 && dist < config.totalLength) {
    // Check if we're approaching a station
    if (stationIdx < stations.length) {
      const nextStation = stations[stationIdx];
      const distToStation = nextStation - dist;

      if (distToStation <= 0) {
        // Already past this station, check next
        stationIdx++;
        continue;
      }

      const travelToStation = distToStation / TRAIN_SPEED;
      if (elapsed < travelToStation) {
        // Still traveling
        dist += elapsed * TRAIN_SPEED;
        elapsed = 0;
      } else {
        // Reach station
        elapsed -= travelToStation;
        dist = nextStation;

        if (elapsed < STATION_STOP_TIME) {
          // Currently stopped at this station
          stopped = true;
          elapsed = 0;
        } else {
          // Depart
          elapsed -= STATION_STOP_TIME;
          stationIdx++;
        }
      }
    } else {
      // No more stations, just travel to end
      dist += elapsed * TRAIN_SPEED;
      elapsed = 0;
    }
  }

  dist = Math.min(dist, config.totalLength - 1);

  const actualDist = isReverse ? config.totalLength - dist : dist;

  return {
    distance: actualDist,
    isStopped: stopped,
    direction: isReverse ? -1 : 1,
  };
}

// Steam locomotive visual
function Locomotive() {
  return (
    <group>
      {/* Boiler */}
      <mesh geometry={GEO.cyl8} scale={[0.7, 3.5, 0.7]}
        position={[0, 1.2, 1.0]} rotation={[Math.PI / 2, 0, 0]}
        material={boilerMat} castShadow />

      {/* Cab */}
      <mesh geometry={GEO.box} scale={[1.8, 1.8, 2.0]}
        position={[0, 1.4, -1.2]} material={cabMat} castShadow />
      {/* Cab roof */}
      <mesh geometry={GEO.box} scale={[2.0, 0.12, 2.2]}
        position={[0, 2.35, -1.2]} material={carRoofMat} castShadow />

      {/* Chimney / smokestack */}
      <mesh geometry={GEO.cyl8} scale={[0.3, 1.0, 0.3]}
        position={[0, 2.0, 2.2]} material={chimneyMat} castShadow />
      {/* Chimney cap */}
      <mesh geometry={GEO.cyl8} scale={[0.4, 0.15, 0.4]}
        position={[0, 2.55, 2.2]} material={chimneyMat} castShadow />

      {/* Cowcatcher / pilot */}
      <mesh geometry={GEO.box} scale={[1.6, 0.3, 0.6]}
        position={[0, 0.3, 3.0]} material={bodyMat} castShadow />

      {/* Steam dome */}
      <mesh geometry={GEO.sphere8} scale={[0.35, 0.35, 0.35]}
        position={[0, 2.0, 0.5]} material={detailMat} castShadow />

      {/* Wheels (simplified) */}
      {[-0.8, 0.8].map((xOff) =>
        [0, 1.5, -1.2].map((zOff, i) => (
          <mesh key={`${xOff}-${i}`} geometry={GEO.cyl8}
            scale={[0.4, 0.1, 0.4]}
            position={[xOff, 0.4, zOff]}
            rotation={[0, 0, Math.PI / 2]}
            material={wheelMat} castShadow />
        ))
      )}

      {/* Headlight */}
      <mesh geometry={GEO.sphere8} scale={[0.15, 0.15, 0.15]}
        position={[0, 1.8, 3.0]} material={detailMat} />
      <pointLight position={[0, 1.8, 3.5]} color="#ffeecc" intensity={0.5} distance={15} />

      {/* Frame / undercarriage */}
      <mesh geometry={GEO.box} scale={[1.6, 0.15, 6.0]}
        position={[0, 0.15, 0.5]} material={bodyMat} />
    </group>
  );
}

// Passenger car
function PassengerCar({ offset }: { offset: number }) {
  return (
    <group position={[0, 0, offset]}>
      {/* Car body */}
      <mesh geometry={GEO.box} scale={[1.8, 1.5, 5.0]}
        position={[0, 1.1, 0]} material={carBodyMat} castShadow />
      {/* Roof */}
      <mesh geometry={GEO.box} scale={[2.0, 0.15, 5.2]}
        position={[0, 1.9, 0]} material={carRoofMat} castShadow />
      {/* Windows */}
      {[-1.5, -0.5, 0.5, 1.5].map((zOff, i) => (
        <group key={i}>
          <mesh geometry={GEO.box} scale={[0.02, 0.5, 0.6]}
            position={[0.91, 1.3, zOff]} material={windowMat} />
          <mesh geometry={GEO.box} scale={[0.02, 0.5, 0.6]}
            position={[-0.91, 1.3, zOff]} material={windowMat} />
        </group>
      ))}
      {/* Wheels */}
      {[-0.8, 0.8].map((xOff) =>
        [-1.5, 1.5].map((zOff, i) => (
          <mesh key={`${xOff}-${i}`} geometry={GEO.cyl8}
            scale={[0.35, 0.08, 0.35]}
            position={[xOff, 0.35, zOff]}
            rotation={[0, 0, Math.PI / 2]}
            material={wheelMat} />
        ))
      )}
      {/* Undercarriage */}
      <mesh geometry={GEO.box} scale={[1.4, 0.12, 5.0]}
        position={[0, 0.12, 0]} material={bodyMat} />
    </group>
  );
}

const _up = new THREE.Vector3(0, 1, 0);

const TrainOnLine = memo(function TrainOnLine({
  lineId,
  config,
}: {
  lineId: string;
  config: TrainLineConfig;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;

    // Deterministic global clock — use Date.now for cross-player consistency
    const globalTime = Date.now() / 1000;
    const { distance, direction } = getTrainDistance(config, globalTime);

    const sample = sampleSplineAtDistance(config.points, config.totalLength, distance);
    const pos = sample.position;
    const tangent = sample.tangent.clone();
    if (direction === -1) tangent.negate();

    groupRef.current.position.copy(pos);

    // Orient train along track direction
    const lookTarget = pos.clone().add(tangent);
    groupRef.current.lookAt(lookTarget);
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
