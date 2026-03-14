/**
 * NightLighting — Medieval lamp/torch props placed at settlements, roads, bridges.
 * All lamps are emissive meshes (zero light cost). Only the 1 nearest lamp to the
 * player gets a real non-shadow-casting PointLight for local illumination.
 * Active only at night — zero cost during daytime.
 */
import { useRef, useMemo, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getNightFactor } from '../systems/TimeOfDay';
import { getTerrainHeight } from './Terrain';
import { SETTLEMENTS } from '../world/RegionData';
import { BRIDGES } from '../world/BridgeData';
import { ROADS } from '../world/RegionData';
import { GEO, MAT } from '../world/SettlementPieces';

// ========== LAMP POSITION DATA ==========

interface LampDef {
  x: number;
  z: number;
  id: string;
}

function generateLampPositions(): LampDef[] {
  const lamps: LampDef[] = [];
  let id = 0;

  // --- Settlement lamps: 2-4 per settlement ---
  for (const s of SETTLEMENTS) {
    const [sx, sz] = s.position;
    const isLarge = s.size === 'large';
    const isMedium = s.size === 'medium';

    // Gate area (south side for most settlements)
    if (isLarge || isMedium) {
      const gateOffset = isLarge ? 45 : isMedium ? 25 : 15;
      lamps.push({ x: sx - 6, z: sz + gateOffset + 3, id: `lamp-${id++}` });
      lamps.push({ x: sx + 6, z: sz + gateOffset + 3, id: `lamp-${id++}` });
    }

    // Center area
    lamps.push({ x: sx + 5, z: sz + 3, id: `lamp-${id++}` });

    // Extra lamp for large settlements
    if (isLarge) {
      lamps.push({ x: sx - 8, z: sz - 10, id: `lamp-${id++}` });
    }
  }

  // --- Road junction lamps: selected key crossroads ---
  // Pick road midpoints for longer roads
  for (const road of ROADS) {
    const dx = road.to[0] - road.from[0];
    const dz = road.to[1] - road.from[1];
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 60) {
      // Place lamp at midpoint
      lamps.push({
        x: (road.from[0] + road.to[0]) / 2,
        z: (road.from[1] + road.to[1]) / 2,
        id: `lamp-${id++}`,
      });
    }
    if (len > 150) {
      // Place lamps at quarter points for very long roads
      lamps.push({
        x: road.from[0] + dx * 0.25,
        z: road.from[1] + dz * 0.25,
        id: `lamp-${id++}`,
      });
      lamps.push({
        x: road.from[0] + dx * 0.75,
        z: road.from[1] + dz * 0.75,
        id: `lamp-${id++}`,
      });
    }
  }

  // --- Bridge lamps: one at each end ---
  for (const bridge of BRIDGES) {
    const cos = Math.cos(bridge.rotation);
    const sin = Math.sin(bridge.rotation);
    const halfLen = bridge.length / 2;
    // Near end
    lamps.push({
      x: bridge.position[0] + sin * halfLen,
      z: bridge.position[2] + cos * halfLen,
      id: `lamp-${id++}`,
    });
    // Far end
    lamps.push({
      x: bridge.position[0] - sin * halfLen,
      z: bridge.position[2] - cos * halfLen,
      id: `lamp-${id++}`,
    });
  }

  return lamps;
}

const ALL_LAMPS = generateLampPositions();

// ========== MATERIALS ==========

const emissiveMat = new THREE.MeshBasicMaterial({ color: '#ff9930' });
const emissiveDimMat = new THREE.MeshBasicMaterial({ color: '#553310' });
const postMat = MAT.iron;
const bracketMat = MAT.iron;

// ========== LAMP MESH COMPONENT ==========

function LampPost({ x, z, y, glowIntensity }: { x: number; z: number; y: number; glowIntensity: number }) {
  return (
    <group position={[x, y, z]}>
      {/* Iron post */}
      <mesh position={[0, 1.5, 0]} geometry={GEO.box}
        scale={[0.08, 3, 0.08]} material={postMat} castShadow />
      {/* Bracket arm */}
      <mesh position={[0.2, 2.8, 0]} geometry={GEO.box}
        scale={[0.35, 0.06, 0.06]} material={bracketMat} />
      {/* Lantern housing */}
      <mesh position={[0.35, 2.6, 0]} geometry={GEO.box}
        scale={[0.2, 0.3, 0.2]} material={bracketMat} castShadow />
      {/* Glow core — emissive, always visible at night */}
      <mesh position={[0.35, 2.6, 0]} geometry={GEO.box}
        scale={[0.12, 0.18, 0.12]}
        material={glowIntensity > 0.1 ? emissiveMat : emissiveDimMat} />
      {/* Lantern top cap */}
      <mesh position={[0.35, 2.8, 0]} geometry={GEO.cone4}
        scale={[0.14, 0.12, 0.14]} material={bracketMat} />
    </group>
  );
}

// ========== MAIN COMPONENT ==========

interface NightLightingProps {
  playerPositionRef: React.RefObject<THREE.Vector3>;
}

export const NightLighting = memo(function NightLighting({ playerPositionRef }: NightLightingProps) {
  const pointLightRef = useRef<THREE.PointLight>(null);
  const frameSkip = useRef(0);
  const nearestRef = useRef<{ x: number; z: number; y: number }>({ x: 0, z: 0, y: 0 });

  // Pre-compute terrain heights for all lamps
  const lampData = useMemo(() => {
    return ALL_LAMPS.map(lamp => ({
      ...lamp,
      y: getTerrainHeight(lamp.x, lamp.z),
    }));
  }, []);

  useFrame(({ clock }) => {
    const nightFactor = getNightFactor();

    // Update point light
    if (pointLightRef.current) {
      if (nightFactor < 0.05) {
        // Daytime — disable
        pointLightRef.current.intensity = 0;
        return;
      }

      // Find nearest lamp every 30 frames (~0.5s)
      frameSkip.current++;
      if (frameSkip.current % 30 === 0) {
        const pp = playerPositionRef.current;
        if (pp) {
          let bestDist = Infinity;
          let bestLamp = lampData[0];
          for (const lamp of lampData) {
            const dx = pp.x - lamp.x;
            const dz = pp.z - lamp.z;
            const d2 = dx * dx + dz * dz;
            if (d2 < bestDist) {
              bestDist = d2;
              bestLamp = lamp;
            }
          }
          nearestRef.current = { x: bestLamp.x + 0.35, z: bestLamp.z, y: bestLamp.y + 2.6 };
        }
      }

      // Position light at nearest lamp
      pointLightRef.current.position.set(
        nearestRef.current.x,
        nearestRef.current.y,
        nearestRef.current.z
      );

      // Subtle flicker
      const flicker = 0.9 + Math.sin(clock.elapsedTime * 8.5) * 0.05
        + Math.sin(clock.elapsedTime * 13.2) * 0.05;
      pointLightRef.current.intensity = nightFactor * 1.8 * flicker;
    }
  });

  const nightFactor = getNightFactor();

  return (
    <group>
      {/* Lamp props — distance-culled */}
      {lampData.map(lamp => (
        <LampPost key={lamp.id} x={lamp.x} z={lamp.z} y={lamp.y} glowIntensity={nightFactor} />
      ))}

      {/* Single real PointLight — nearest to player */}
      <pointLight
        ref={pointLightRef}
        color="#ff9930"
        intensity={0}
        distance={18}
        decay={2}
        castShadow={false}
      />
    </group>
  );
});
