/**
 * RailwayStations — Medieval station structures at all 7 approved positions.
 * Stone platform + timber shelter + name sign.
 */
import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { RAILWAY_STATIONS, RailwayStation, LINE_A_WAYPOINTS, LINE_B_WAYPOINTS } from '../world/RailwayData';
import { getTerrainHeight } from './Terrain';
import { GEO, MAT } from '../world/SettlementPieces';

// Station sizes by type
const STATION_DIMS: Record<string, { platW: number; platL: number; shelterW: number; shelterL: number }> = {
  capital: { platW: 8, platL: 16, shelterW: 5, shelterL: 10 },
  large:   { platW: 6, platL: 12, shelterW: 4, shelterL: 8 },
  medium:  { platW: 5, platL: 10, shelterW: 3.5, shelterL: 6 },
  small:   { platW: 4, platL: 8, shelterW: 3, shelterL: 5 },
};

// Additional materials for railway
const platformMat = new THREE.MeshLambertMaterial({ color: '#7a7068' });
const roofMat = new THREE.MeshLambertMaterial({ color: '#5a2222' });
const signMat = new THREE.MeshLambertMaterial({ color: '#3a2810' });
const lampMat = new THREE.MeshLambertMaterial({ color: '#2a2a2a' });
const lampGlowMat = new THREE.MeshLambertMaterial({ color: '#ffdd66', emissive: '#ffdd66', emissiveIntensity: 0.4 });

function getTrackDirectionAtStation(station: RailwayStation): number {
  const wps = station.line === 'B' ? LINE_B_WAYPOINTS : LINE_A_WAYPOINTS;
  // Find nearest waypoint
  let bestIdx = 0, bestD = Infinity;
  for (let i = 0; i < wps.length; i++) {
    const dx = wps[i].x - station.position[0];
    const dz = wps[i].z - station.position[1];
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; bestIdx = i; }
  }
  // Direction from prev to next waypoint
  const prev = wps[Math.max(0, bestIdx - 1)];
  const next = wps[Math.min(wps.length - 1, bestIdx + 1)];
  return Math.atan2(next.x - prev.x, next.z - prev.z);
}

const StationRenderer = memo(function StationRenderer({ station }: { station: RailwayStation }) {
  const { position, dims, rotation, sideOffset } = useMemo(() => {
    const [sx, sz] = station.position;
    const y = getTerrainHeight(sx, sz);
    const dims = STATION_DIMS[station.stationType] || STATION_DIMS.small;
    const rotation = getTrackDirectionAtStation(station);

    // Offset platform to the correct side of the track
    const sideAngle = rotation + Math.PI / 2;
    const sideDir = station.side === 'south' || station.side === 'west' ? -1 : 1;
    const offset = 3; // distance from track center
    const ox = Math.sin(sideAngle) * offset * sideDir;
    const oz = Math.cos(sideAngle) * offset * sideDir;

    return {
      position: new THREE.Vector3(sx + ox, y, sz + oz),
      dims,
      rotation,
      sideOffset: sideDir,
    };
  }, [station]);

  const { platW, platL, shelterW, shelterL } = dims;

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Stone Platform */}
      <mesh geometry={GEO.box} scale={[platW, 0.5, platL]}
        position={[0, 0.25, 0]} material={platformMat} castShadow receiveShadow />

      {/* Platform edge stones */}
      <mesh geometry={GEO.box} scale={[platW + 0.3, 0.15, platL + 0.3]}
        position={[0, 0.05, 0]} material={MAT.stoneDark} receiveShadow />

      {/* Timber Shelter */}
      <group position={[sideOffset * (platW / 2 - shelterW / 2 - 0.3), 0.5, 0]}>
        {/* Shelter walls - back and two sides */}
        <mesh geometry={GEO.box} scale={[shelterW, 2.5, 0.25]}
          position={[0, 1.25, -shelterL / 2]} material={MAT.timber} castShadow />
        <mesh geometry={GEO.box} scale={[0.25, 2.5, shelterL]}
          position={[-shelterW / 2, 1.25, 0]} material={MAT.timber} castShadow />
        <mesh geometry={GEO.box} scale={[0.25, 2.5, shelterL]}
          position={[shelterW / 2, 1.25, 0]} material={MAT.timber} castShadow />

        {/* Timber frame posts */}
        {[-shelterW / 2 + 0.15, shelterW / 2 - 0.15].map((xp, i) => (
          <mesh key={`post-${i}`} geometry={GEO.box} scale={[0.2, 2.8, 0.2]}
            position={[xp, 1.4, shelterL / 2 - 0.1]} material={MAT.woodDark} castShadow />
        ))}

        {/* Roof — slanted */}
        <mesh geometry={GEO.box} scale={[shelterW + 0.8, 0.2, shelterL + 0.6]}
          position={[0, 2.7, 0]} material={roofMat} castShadow />
        {/* Roof ridge */}
        <mesh geometry={GEO.box} scale={[shelterW + 0.9, 0.1, 0.4]}
          position={[0, 2.85, 0]} material={MAT.roofDark} castShadow />

        {/* Bench inside shelter */}
        <mesh geometry={GEO.box} scale={[shelterW * 0.7, 0.15, 0.5]}
          position={[0, 0.5, -shelterL / 2 + 0.5]} material={MAT.woodLight} />
      </group>

      {/* Platform lamps */}
      {[-platL / 2 + 1.5, platL / 2 - 1.5].map((zp, i) => (
        <group key={`lamp-${i}`} position={[-sideOffset * (platW / 2 - 0.5), 0.5, zp]}>
          <mesh geometry={GEO.cyl8} scale={[0.08, 2.5, 0.08]}
            position={[0, 1.25, 0]} material={lampMat} castShadow />
          <mesh geometry={GEO.box} scale={[0.3, 0.3, 0.3]}
            position={[0, 2.6, 0]} material={lampGlowMat} />
          <pointLight position={[0, 2.6, 0]} color="#ffdd66" intensity={0.3} distance={8} />
        </group>
      ))}

      {/* Station name sign */}
      <group position={[0, 0.5, platL / 2 + 0.3]}>
        {/* Sign post */}
        <mesh geometry={GEO.cyl8} scale={[0.06, 2, 0.06]}
          position={[0, 1, 0]} material={MAT.woodDark} castShadow />
        {/* Sign board */}
        <mesh geometry={GEO.box} scale={[2.5, 0.6, 0.1]}
          position={[0, 2.2, 0]} material={signMat} castShadow />
      </group>

      {/* Decorative elements for capital station */}
      {station.stationType === 'capital' && (
        <>
          {/* Clock tower */}
          <group position={[sideOffset * (platW / 2 - 1), 0.5, 0]}>
            <mesh geometry={GEO.box} scale={[1.5, 4, 1.5]}
              position={[0, 2, 0]} material={MAT.stoneWarm} castShadow />
            <mesh geometry={GEO.cone4} scale={[1.2, 1.5, 1.2]}
              position={[0, 4.75, 0]} material={MAT.roofSlate} castShadow />
            {/* Clock face */}
            <mesh geometry={GEO.cyl12} scale={[0.5, 0.05, 0.5]}
              position={[0, 3.5, 0.76]} rotation={[Math.PI / 2, 0, 0]}
              material={MAT.plaster} />
          </group>
          {/* Extra benches */}
          {[-3, 3].map((zp, i) => (
            <mesh key={`bench-${i}`} geometry={GEO.box} scale={[1.2, 0.15, 0.4]}
              position={[-sideOffset * (platW / 2 - 1), 0.6, zp]} material={MAT.woodLight} />
          ))}
        </>
      )}
    </group>
  );
});

interface Props {
  playerPositionRef: React.RefObject<THREE.Vector3>;
}

export const RailwayStations = memo(function RailwayStations({ playerPositionRef }: Props) {
  const playerPos = playerPositionRef.current;
  return (
    <group name="railway-stations">
      {RAILWAY_STATIONS.map(station => {
        // LOD: skip stations far from player
        if (playerPos) {
          const dx = playerPos.x - station.position[0];
          const dz = playerPos.z - station.position[1];
          if (dx * dx + dz * dz > 300 * 300) return null;
        }
        return <StationRenderer key={station.id} station={station} />;
      })}
    </group>
  );
});
