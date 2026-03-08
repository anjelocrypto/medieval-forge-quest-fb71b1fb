import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WORLD_SIZE, COLORS } from '../constants';

// Simple noise function
function noise2D(x: number, z: number, scale: number = 1, seed: number = 0): number {
  const nx = (x + seed) * scale;
  const nz = (z + seed) * scale;
  return (Math.sin(nx * 1.7 + nz * 3.1) * 0.5 + 
          Math.sin(nx * 0.8 - nz * 1.3) * 0.3 +
          Math.cos(nx * 2.1 + nz * 0.7) * 0.2);
}

export function getTerrainHeight(x: number, z: number): number {
  const h1 = noise2D(x, z, 0.008, 42) * 15;
  const h2 = noise2D(x, z, 0.02, 17) * 5;
  const h3 = noise2D(x, z, 0.05, 99) * 2;
  
  // Flatten center area for starting zone
  const distFromCenter = Math.sqrt(x * x + z * z);
  const flattenFactor = Math.max(0, 1 - distFromCenter / 40);
  
  const height = (h1 + h2 + h3) * (1 - flattenFactor * 0.8);
  return Math.max(-1, height);
}

export function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    const segments = 128;
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
    geo.rotateX(-Math.PI / 2);
    
    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const y = getTerrainHeight(x, z);
      positions.setY(i, y);
      
      // Color based on height and position
      const color = new THREE.Color();
      if (y < -0.5) {
        color.set(COLORS.sand);
      } else if (y < 2) {
        color.set(COLORS.grass);
        // Road paths
        const roadNoise = noise2D(x, z, 0.03, 200);
        if (Math.abs(roadNoise) < 0.08) {
          color.set(COLORS.road);
        }
      } else if (y < 8) {
        color.lerpColors(new THREE.Color(COLORS.grass), new THREE.Color(COLORS.grassDark), (y - 2) / 6);
      } else {
        color.lerpColors(new THREE.Color(COLORS.grassDark), new THREE.Color(COLORS.stone), Math.min(1, (y - 8) / 7));
      }
      
      // Slight variation
      const variation = noise2D(x, z, 0.1, 300) * 0.05;
      color.r += variation;
      color.g += variation;
      color.b += variation;
      
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}
