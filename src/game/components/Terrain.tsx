import { useMemo } from 'react';
import * as THREE from 'three';
import { WORLD_SIZE, COLORS } from '../constants';
import { ROADS, REGIONS, SETTLEMENTS } from '../world/RegionData';

function noise2D(x: number, z: number, scale: number = 1, seed: number = 0): number {
  const nx = (x + seed) * scale;
  const nz = (z + seed) * scale;
  return (Math.sin(nx * 1.7 + nz * 3.1) * 0.5 +
          Math.sin(nx * 0.8 - nz * 1.3) * 0.3 +
          Math.cos(nx * 2.1 + nz * 0.7) * 0.2);
}

// Regional height modifiers
function getRegionalHeight(x: number, z: number): number {
  let mod = 0;
  // Frostmere highlands — elevated terrain SE
  const frostDist = Math.sqrt((x - 160) ** 2 + (z - 200) ** 2);
  if (frostDist < 100) mod += (1 - frostDist / 100) * 12;

  // Ashwood slight elevation
  const ashDist = Math.sqrt((x + 190) ** 2 + (z - 140) ** 2);
  if (ashDist < 80) mod += (1 - ashDist / 80) * 3;

  // Greenmeadow — flatten for farmland
  const greenDist = Math.sqrt((x + 160) ** 2 + (z + 130) ** 2);
  if (greenDist < 70) mod -= (1 - greenDist / 70) * 4;

  return mod;
}

export function getTerrainHeight(x: number, z: number): number {
  const h1 = noise2D(x, z, 0.008, 42) * 15;
  const h2 = noise2D(x, z, 0.02, 17) * 5;
  const h3 = noise2D(x, z, 0.05, 99) * 2;

  const distFromCenter = Math.sqrt(x * x + z * z);
  const flattenFactor = Math.max(0, 1 - distFromCenter / 40);

  // Flatten around settlements — plateau function for proper building grounding
  let settleFlatten = 0;
  for (const s of SETTLEMENTS) {
    const sd = Math.sqrt((x - s.position[0]) ** 2 + (z - s.position[1]) ** 2);
    // Radii sized to cover full settlement diagonal (walls + corners + margin)
    const flatR = s.size === 'large' ? 65 : s.size === 'medium' ? 35 : 22;
    if (sd < flatR) {
      const t = sd / flatR;
      // Plateau: terrain is ~97% flat within 85% of radius, then rapid linear falloff
      // This ensures walls, towers, and corner structures all sit on level ground
      const f = t < 0.85 ? 1.0 : Math.max(0, 1 - (t - 0.85) / 0.15);
      settleFlatten = Math.max(settleFlatten, f * 0.97);
    }
  }

  const baseHeight = (h1 + h2 + h3) * (1 - flattenFactor * 0.8);
  const regional = getRegionalHeight(x, z);
  const height = (baseHeight + regional) * (1 - settleFlatten) + regional * settleFlatten * 0.3;
  return Math.max(-1, height);
}

function getRoadFactor(x: number, z: number): number {
  let best = 0;
  for (const road of ROADS) {
    const dx = road.to[0] - road.from[0], dz = road.to[1] - road.from[1];
    const len2 = dx * dx + dz * dz;
    if (len2 < 1) continue;
    const t = Math.max(0, Math.min(1, ((x - road.from[0]) * dx + (z - road.from[1]) * dz) / len2));
    const px = road.from[0] + t * dx, pz = road.from[1] + t * dz;
    const dist = Math.sqrt((x - px) ** 2 + (z - pz) ** 2);
    const width = road.width + noise2D(px, pz, 0.05, 500) * 0.5;
    const factor = Math.max(0, 1 - dist / width);
    if (factor > best) best = factor;
  }
  return best;
}

export function Terrain() {
  const geometry = useMemo(() => {
    const segments = 180;
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
    const snowColor = new THREE.Color('#c8d0d8');
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
      } else if (y < 8) {
        tmpColor.lerpColors(grassColor, grassDarkColor, (y - 2) / 6);
      } else if (y < 15) {
        tmpColor.lerpColors(grassDarkColor, stoneColor, (y - 8) / 7);
      } else {
        tmpColor.lerpColors(stoneColor, snowColor, Math.min(1, (y - 15) / 5));
      }

      // Ashwood dark forest floor
      const ashDist = Math.sqrt((x + 190) ** 2 + (z - 140) ** 2);
      if (ashDist < 80 && y > -0.3) {
        tmpColor.lerp(forestFloor, Math.max(0, 1 - ashDist / 80) * 0.6);
      }

      // Road overlay
      const roadFactor = getRoadFactor(x, z);
      if (roadFactor > 0.1) {
        tmpColor.lerp(roadColor, roadFactor * 0.8);
      }

      // Settlement ground
      for (const s of SETTLEMENTS) {
        const sd = Math.sqrt((x - s.position[0]) ** 2 + (z - s.position[1]) ** 2);
        const gR = s.size === 'large' ? 35 : s.size === 'medium' ? 20 : 12;
        if (sd < gR) {
          const villageGround = new THREE.Color(s.type === 'capital' ? '#7a7060' : s.type === 'village' ? '#7a6a4a' : '#6a6050');
          tmpColor.lerp(villageGround, Math.max(0, 1 - sd / gR) * 0.5);
        }
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
