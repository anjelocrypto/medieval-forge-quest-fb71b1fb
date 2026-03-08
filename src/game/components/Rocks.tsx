import { useMemo } from 'react';
import { COLORS, WORLD_SIZE } from '../constants';
import { getTerrainHeight } from './Terrain';

interface RockData {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
}

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function Rocks() {
  const rocks = useMemo(() => {
    const result: RockData[] = [];
    const rand = seededRandom(67890);
    
    for (let i = 0; i < 120; i++) {
      const x = (rand() - 0.5) * WORLD_SIZE * 0.85;
      const z = (rand() - 0.5) * WORLD_SIZE * 0.85;
      const y = getTerrainHeight(x, z);
      if (y < -0.3) continue;
      
      const s = 0.3 + rand() * 1.5;
      result.push({
        position: [x, y + s * 0.3, z],
        scale: [s * (0.8 + rand() * 0.4), s * (0.6 + rand() * 0.8), s * (0.8 + rand() * 0.4)],
        rotation: [rand() * 0.3, rand() * Math.PI * 2, rand() * 0.3],
      });
    }
    return result;
  }, []);

  return (
    <group>
      {rocks.map((rock, i) => (
        <mesh key={i} position={rock.position} scale={rock.scale} rotation={rock.rotation} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshLambertMaterial color={i % 3 === 0 ? COLORS.stoneDark : COLORS.stone} />
        </mesh>
      ))}
    </group>
  );
}
