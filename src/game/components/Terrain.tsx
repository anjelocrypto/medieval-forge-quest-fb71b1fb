import { useMemo } from 'react';
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

// Pre-computed POI array for road calculation
const poiArr = Object.values(POIS);
const roadConnections = [[0, 1], [1, 2], [0, 3], [1, 3], [0, 4]];

function getRoadFactor(x: number, z: number): number {
  let best = 0;
  for (let c = 0; c < roadConnections.length; c++) {
    const [a, b] = roadConnections[c];
    const pa = poiArr[a], pb = poiArr[b];
    if (!pa || !pb) continue;
    const dx = pb.x - pa.x, dz = pb.z - pa.z;
    const len2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - pa.x) * dx + (z - pa.z) * dz) / len2));
    const px = pa.x + t * dx, pz = pa.z + t * dz;
    const dist = Math.sqrt((x - px) ** 2 + (z - pz) ** 2);
    const width = 2.5 + noise2D(px, pz, 0.05, 500);
    const factor = Math.max(0, 1 - dist / width);
    if (factor > best) best = factor;
  }
  return best;
}

export function Terrain() {
  const geometry = useMemo(() => {
    const segments = 128;
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
    const villageGround = new THREE.Color('#7a6a4a');
    const ruinsGround = new THREE.Color('#5a5040');
    const tmpColor = new THREE.Color();

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const y = getTerrainHeight(x, z);
      positions.setY(i, y);

      if (y < -0.5) {
        tmpColor.copy(sandColor);
      } else if (y < 2) {
        tmpColor.copy(grassColor);

        const distToForest = Math.sqrt((x - POIS.forest.x) ** 2 + (z - POIS.forest.z) ** 2);
        if (distToForest < 50) {
          tmpColor.lerp(forestFloor, Math.max(0, 1 - distToForest / 50) * 0.6);
        }

        const roadFactor = getRoadFactor(x, z);
        if (roadFactor > 0.1) {
          tmpColor.lerp(roadColor, roadFactor * 0.8);
        }

        const distVillage = Math.sqrt((x - POIS.village.x) ** 2 + (z - POIS.village.z) ** 2);
        if (distVillage < 20) {
          tmpColor.lerp(villageGround, Math.max(0, 1 - distVillage / 20) * 0.5);
        }
      } else if (y < 8) {
        tmpColor.lerpColors(grassColor, grassDarkColor, (y - 2) / 6);
      } else {
        tmpColor.lerpColors(grassDarkColor, stoneColor, Math.min(1, (y - 8) / 7));
      }

      const variation = noise2D(x, z, 0.1, 300) * 0.04;
      colors[i * 3] = Math.max(0, Math.min(1, tmpColor.r + variation));
      colors[i * 3 + 1] = Math.max(0, Math.min(1, tmpColor.g + variation));
      colors[i * 3 + 2] = Math.max(0, Math.min(1, tmpColor.b + variation));
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}