/**
 * Road network renderer — creates visible dirt paths between settlements.
 * Uses a single merged geometry for performance.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { ROADS, SMALL_POIS, SmallPOIDef } from '../world/RegionData';
import { GEO, MAT, seededRng } from '../world/SettlementPieces';
import { getTerrainHeight } from './Terrain';

interface Props {
  playerPositionRef: React.RefObject<THREE.Vector3>;
}

// ========== SMALL POI RENDERERS ==========

function SmallPOIRenderer({ poi, playerPos }: { poi: SmallPOIDef; playerPos: THREE.Vector3 | null }) {
  if (playerPos) {
    const dx = playerPos.x - poi.position[0];
    const dz = playerPos.z - poi.position[1];
    if (dx * dx + dz * dz > 140 * 140) return null;
  }

  const [px, pz] = poi.position;
  const y = getTerrainHeight(px, pz);

  switch (poi.type) {
    case 'shrine':
      return (
        <group position={[px, y, pz]}>
          <mesh position={[0, 0.3, 0]} geometry={GEO.box} scale={[1.5, 0.6, 1.5]} material={MAT.stoneDark} castShadow />
          <mesh position={[0, 1.2, 0]} geometry={GEO.box} scale={[0.6, 1.5, 0.3]} material={MAT.stone} castShadow />
          <mesh position={[0, 2.2, 0]} geometry={GEO.cone4} scale={[0.5, 0.6, 0.5]} material={MAT.stone} castShadow />
        </group>
      );
    case 'wagon':
      return (
        <group position={[px, y, pz]} rotation={[0, Math.sin(px) * 2, Math.sin(pz) * 0.15]}>
          <mesh position={[0, 0.4, 0]} geometry={GEO.box} scale={[1.4, 0.5, 2.8]} material={MAT.woodDark} castShadow />
          <mesh position={[-0.7, 0.3, -1.5]} geometry={GEO.box} scale={[0.06, 0.06, 1.2]} material={MAT.woodDark} />
          <mesh position={[0.7, 0.3, -1.5]} geometry={GEO.box} scale={[0.06, 0.06, 1.2]} material={MAT.woodDark} />
          <mesh position={[0, 0.7, 0.3]} geometry={GEO.box} scale={[0.5, 0.5, 0.5]} material={MAT.tent} castShadow />
        </group>
      );
    case 'bridge':
      return (
        <group position={[px, y, pz]}>
          <mesh position={[0, 0.8, 0]} geometry={GEO.box} scale={[4, 0.3, 1.8]} material={MAT.stoneDark} castShadow />
          <mesh position={[-1.8, 1.2, 0]} geometry={GEO.box} scale={[0.3, 1, 1.8]} material={MAT.stone} castShadow />
          <mesh position={[1.8, 1.2, 0]} geometry={GEO.box} scale={[0.3, 1, 1.8]} material={MAT.stone} castShadow />
        </group>
      );
    case 'graveyard':
      return (
        <group position={[px, y, pz]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <group key={i} position={[(i % 3) * 1.5 - 1.5, 0, Math.floor(i / 3) * 2 - 1]}
              rotation={[0, 0, (Math.sin(i * 3.7) * 0.1)]}>
              <mesh position={[0, 0.4, 0]} geometry={GEO.box} scale={[0.5, 0.8, 0.1]} material={MAT.stoneDark} castShadow />
            </group>
          ))}
          <mesh position={[0, 0.02, 0]} geometry={GEO.box} scale={[6, 0.04, 4]} material={MAT.moss} />
        </group>
      );
    case 'hunter_camp':
      return (
        <group position={[px, y, pz]}>
          <mesh position={[0, 0.8, 0]} geometry={GEO.cone6} scale={[1.5, 1.6, 1.5]} material={MAT.tent} castShadow />
          <mesh position={[2, 0.5, 0]} geometry={GEO.box} scale={[0.08, 1, 0.08]} material={MAT.woodDark} castShadow />
          {[0, 1, 2, 3, 4].map(i => {
            const a = (i / 5) * Math.PI * 2;
            return <mesh key={i} position={[Math.cos(a) * 0.4 + 2, 0.08, Math.sin(a) * 0.4]}
              geometry={GEO.box} scale={[0.15, 0.12, 0.15]} material={MAT.stoneDark} castShadow />;
          })}
        </group>
      );
    case 'ruined_house':
      return (
        <group position={[px, y, pz]}>
          <mesh position={[0, 0.8, 0]} geometry={GEO.box} scale={[4, 1.6, 3.5]} material={MAT.stoneRuin} castShadow />
          <mesh position={[1.5, 0.5, 0]} geometry={GEO.box} scale={[1.2, 1, 1]} material={MAT.stoneRuin} castShadow />
        </group>
      );
    case 'watchtower':
      return (
        <group position={[px, y, pz]}>
          <mesh position={[0, 5, 0]} geometry={GEO.box} scale={[2, 10, 2]} material={MAT.woodDark} castShadow />
          <mesh position={[0, 10.5, 0]} geometry={GEO.box} scale={[3, 0.2, 3]} material={MAT.woodDark} castShadow />
          <mesh position={[0, 11.2, 0]} geometry={GEO.box} scale={[0.1, 1.5, 0.1]} material={MAT.woodDark} castShadow />
        </group>
      );
    case 'cave':
      return (
        <group position={[px, y, pz]}>
          <mesh position={[0, 1.2, 0]} geometry={GEO.box} scale={[3, 2.4, 2]} material={MAT.stoneDark} castShadow />
          <mesh position={[0, 0.6, 1.1]} geometry={GEO.box} scale={[1.5, 1.2, 0.3]} material={MAT.dark} />
        </group>
      );
    case 'watchpost':
      return (
        <group position={[px, y, pz]}>
          <mesh position={[0, 2, 0]} geometry={GEO.box} scale={[0.2, 4, 0.2]} material={MAT.woodDark} castShadow />
          <mesh position={[0, 3.5, 0]} geometry={GEO.box} scale={[1.5, 0.1, 1.5]} material={MAT.woodDark} castShadow />
        </group>
      );
    case 'inn':
      return (
        <group position={[px, y, pz]}>
          <mesh position={[0, 0.15, 0]} geometry={GEO.box} scale={[6.4, 0.3, 5.4]} material={MAT.stoneDark} castShadow />
          <mesh position={[0, 1.8, 0]} geometry={GEO.box} scale={[6, 3, 5]} material={MAT.plaster} castShadow />
          <mesh position={[0, 4.3, 0]} geometry={GEO.cone4} scale={[4.5, 2.5, 4]} material={MAT.roof} castShadow />
          <mesh position={[0, 0.7, 2.55]} geometry={GEO.box} scale={[0.9, 1.3, 0.08]} material={MAT.door} castShadow />
          <mesh position={[-2, 5, 0]} geometry={GEO.box} scale={[0.1, 2, 0.1]} material={MAT.woodDark} castShadow />
          <mesh position={[-1.6, 5.5, 0]} geometry={GEO.box} scale={[0.6, 0.8, 0.04]} material={MAT.tent} castShadow />
        </group>
      );
    case 'clearing':
      return (
        <group position={[px, y, pz]}>
          <mesh position={[0, 0.03, 0]} geometry={GEO.box} scale={[8, 0.06, 8]} material={MAT.crop} />
          {[[-2, -2], [2, 2], [-3, 1]].map(([sx, sz], i) => (
            <mesh key={i} position={[sx, 0.15, sz]} geometry={GEO.box}
              scale={[0.8, 0.3, 0.8]} material={MAT.stoneDark} castShadow />
          ))}
        </group>
      );
    case 'stone_circle':
      return (
        <group position={[px, y, pz]}>
          {Array.from({ length: 7 }).map((_, i) => {
            const a = (i / 7) * Math.PI * 2;
            const h = 1.5 + Math.sin(i * 2) * 1;
            return <mesh key={i} position={[Math.cos(a) * 4, h / 2, Math.sin(a) * 4]}
              geometry={GEO.box} scale={[0.8, h, 0.4]} material={MAT.stoneDark} castShadow />;
          })}
        </group>
      );
    case 'pond':
      return (
        <group position={[px, y, pz]}>
          <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}
            geometry={GEO.cyl8} scale={[4, 4, 0.1]} material={MAT.water} />
        </group>
      );
    case 'burned_village':
      return (
        <group position={[px, y, pz]}>
          {[[-3, -2], [2, 1], [-1, 4]].map(([bx, bz], i) => (
            <group key={i} position={[bx, 0, bz]}>
              <mesh position={[0, 0.4, 0]} geometry={GEO.box}
                scale={[2.5, 0.8, 2]} material={MAT.dark} castShadow />
              <mesh position={[0.8, 0.6, 0]} geometry={GEO.box}
                scale={[0.5, 1.2, 0.15]} material={MAT.dark} castShadow />
            </group>
          ))}
        </group>
      );
    case 'supply_depot':
      return (
        <group position={[px, y, pz]}>
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={i} position={[(i % 2) * 1.5 - 0.75, 0.3, Math.floor(i / 2) * 1.5 - 0.75]}
              geometry={GEO.box} scale={[0.7, 0.6, 0.7]} material={MAT.woodDark} castShadow />
          ))}
          <mesh position={[0, 0.7, -2]} geometry={GEO.box} scale={[3, 0.1, 0.1]} material={MAT.woodDark} castShadow />
        </group>
      );
    case 'crossroads':
      return (
        <group position={[px, y, pz]}>
          <mesh position={[0, 1.5, 0]} geometry={GEO.box} scale={[0.12, 3, 0.12]} material={MAT.woodDark} castShadow />
          <mesh position={[0, 2.8, 0]} geometry={GEO.box} scale={[1, 0.3, 0.08]} material={MAT.woodDark} castShadow />
          <mesh position={[0.1, 2.3, 0]} rotation={[0, 0.8, 0]}
            geometry={GEO.box} scale={[0.8, 0.25, 0.07]} material={MAT.woodDark} castShadow />
        </group>
      );
    default:
      return null;
  }
}

export function WorldPOIs({ playerPositionRef }: Props) {
  const playerPos = playerPositionRef.current;

  return (
    <group>
      {SMALL_POIS.map(poi => (
        <SmallPOIRenderer key={poi.id} poi={poi} playerPos={playerPos} />
      ))}
    </group>
  );
}
