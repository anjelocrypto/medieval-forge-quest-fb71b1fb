import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WORLD_SIZE, COLORS, POIS } from '../constants';

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

  const distFromCenter = Math.sqrt(x * x + z * z);
  const flattenFactor = Math.max(0, 1 - distFromCenter / 40);

  const height = (h1 + h2 + h3) * (1 - flattenFactor * 0.8);
  return Math.max(-1, height);
}

// Road path function — returns 0-1 proximity to road
function getRoadFactor(x: number, z: number): number {
  let best = 0;

  // Roads between POIs
  const poiArr = Object.values(POIS);
  const connections = [
    [0, 1], [1, 2], [0, 3], [1, 3], [0, 4], // castle-village, village-ruins, castle-forest, etc.
  ];

  for (const [a, b] of connections) {
    if (!poiArr[a] || !poiArr[b]) continue;
    const ax = poiArr[a].x, az = poiArr[a].z;
    const bx = poiArr[b].x, bz = poiArr[b].z;
    
    // Distance from point to line segment
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + t * dx, pz = az + t * dz;
    const dist = Math.sqrt((x - px) ** 2 + (z - pz) ** 2);
    
    // Road width varies
    const width = 2.5 + noise2D(px, pz, 0.05, 500) * 1;
    const factor = Math.max(0, 1 - dist / width);
    best = Math.max(best, factor);
  }

  // Roads from center outward
  const centerRoad = 1 - Math.min(1, Math.abs(noise2D(x, z, 0.03, 200)) / 0.06);
  const distCenter = Math.sqrt(x * x + z * z);
  if (distCenter < 80) best = Math.max(best, centerRoad * 0.4);

  return best;
}

export function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const segments = 150;
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    const grassColor = new THREE.Color(COLORS.grass);
    const grassDarkColor = new THREE.Color(COLORS.grassDark);
    const roadColor = new THREE.Color(COLORS.road);
    const sandColor = new THREE.Color(COLORS.sand);
    const stoneColor = new THREE.Color(COLORS.stone);
    const forestFloor = new THREE.Color('#3a5a2a');

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const y = getTerrainHeight(x, z);
      positions.setY(i, y);

      const color = new THREE.Color();

      if (y < -0.5) {
        color.copy(sandColor);
      } else if (y < 2) {
        color.copy(grassColor);
        
        // Forest floor near Dark Forest
        const distToForest = Math.sqrt((x - POIS.forest.x) ** 2 + (z - POIS.forest.z) ** 2);
        if (distToForest < 50) {
          const forestFactor = Math.max(0, 1 - distToForest / 50);
          color.lerp(forestFloor, forestFactor * 0.6);
        }

        // Road paths
        const roadFactor = getRoadFactor(x, z);
        if (roadFactor > 0.1) {
          color.lerp(roadColor, roadFactor * 0.8);
        }

        // Village area - worn grass
        const distVillage = Math.sqrt((x - POIS.village.x) ** 2 + (z - POIS.village.z) ** 2);
        if (distVillage < 20) {
          const villageFactor = Math.max(0, 1 - distVillage / 20);
          color.lerp(new THREE.Color('#7a6a4a'), villageFactor * 0.5);
        }

        // Ruins area - darker earth
        const distRuins = Math.sqrt((x - POIS.ruins.x) ** 2 + (z - POIS.ruins.z) ** 2);
        if (distRuins < 18) {
          const ruinFactor = Math.max(0, 1 - distRuins / 18);
          color.lerp(new THREE.Color('#5a5040'), ruinFactor * 0.4);
        }
      } else if (y < 8) {
        color.lerpColors(grassColor, grassDarkColor, (y - 2) / 6);
      } else {
        color.lerpColors(grassDarkColor, stoneColor, Math.min(1, (y - 8) / 7));
      }

      // Slight variation
      const variation = noise2D(x, z, 0.1, 300) * 0.04;
      color.r = Math.max(0, Math.min(1, color.r + variation));
      color.g = Math.max(0, Math.min(1, color.g + variation));
      color.b = Math.max(0, Math.min(1, color.b + variation));

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