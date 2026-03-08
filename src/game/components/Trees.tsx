import { useMemo } from 'react';
import * as THREE from 'three';
import { COLORS, WORLD_SIZE } from '../constants';
import { getTerrainHeight } from './Terrain';

interface TreeData {
  position: [number, number, number];
  scale: number;
  trunkHeight: number;
  crownRadius: number;
  type: 'pine' | 'oak';
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function Trees() {
  const trees = useMemo(() => {
    const result: TreeData[] = [];
    const rand = seededRandom(12345);
    const half = WORLD_SIZE / 2;
    
    for (let i = 0; i < 300; i++) {
      const x = (rand() - 0.5) * WORLD_SIZE * 0.9;
      const z = (rand() - 0.5) * WORLD_SIZE * 0.9;
      const y = getTerrainHeight(x, z);
      
      // Skip water areas and roads
      if (y < 0) continue;
      
      // Cluster trees in forest area
      const distToForest = Math.sqrt((x + 80) ** 2 + (z - 60) ** 2);
      const inForest = distToForest < 60;
      if (!inForest && rand() > 0.4) continue;
      
      // Don't place on POIs
      const distToCenter = Math.sqrt(x * x + z * z);
      if (distToCenter < 15) continue;
      
      const scale = 0.8 + rand() * 0.6;
      result.push({
        position: [x, y, z],
        scale,
        trunkHeight: 2 + rand() * 2,
        crownRadius: 1.5 + rand() * 1.5,
        type: rand() > 0.5 ? 'pine' : 'oak',
      });
    }
    return result;
  }, []);

  return (
    <group>
      {trees.map((tree, i) => (
        <group key={i} position={tree.position} scale={tree.scale}>
          {/* Trunk */}
          <mesh position={[0, tree.trunkHeight / 2, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.25, tree.trunkHeight, 6]} />
            <meshLambertMaterial color={COLORS.woodDark} />
          </mesh>
          {/* Crown */}
          {tree.type === 'pine' ? (
            <>
              <mesh position={[0, tree.trunkHeight + 1, 0]} castShadow>
                <coneGeometry args={[tree.crownRadius, 3, 6]} />
                <meshLambertMaterial color={COLORS.leavesDark} />
              </mesh>
              <mesh position={[0, tree.trunkHeight + 2.2, 0]} castShadow>
                <coneGeometry args={[tree.crownRadius * 0.7, 2.2, 6]} />
                <meshLambertMaterial color={COLORS.leaves} />
              </mesh>
            </>
          ) : (
            <mesh position={[0, tree.trunkHeight + tree.crownRadius * 0.6, 0]} castShadow>
              <dodecahedronGeometry args={[tree.crownRadius, 1]} />
              <meshLambertMaterial color={COLORS.leaves} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
