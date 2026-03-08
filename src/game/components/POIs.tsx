import { COLORS, POIS } from '../constants';
import { getTerrainHeight } from './Terrain';
import * as THREE from 'three';

// Shared materials — created once, reused
const castleMat = new THREE.MeshLambertMaterial({ color: COLORS.castle });
const stoneDarkMat = new THREE.MeshLambertMaterial({ color: COLORS.stoneDark });
const stoneMat = new THREE.MeshLambertMaterial({ color: COLORS.stone });
const roofMat = new THREE.MeshLambertMaterial({ color: COLORS.roof });
const woodMat = new THREE.MeshLambertMaterial({ color: COLORS.wood });
const woodDarkMat = new THREE.MeshLambertMaterial({ color: COLORS.woodDark });
const darkMat = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });
const doorMat = new THREE.MeshLambertMaterial({ color: '#3a2510' });
const hayMat = new THREE.MeshLambertMaterial({ color: '#c4a040' });
const tentMat = new THREE.MeshLambertMaterial({ color: '#6a5a3a' });
const metalMat = new THREE.MeshLambertMaterial({ color: '#888' });
const bannerMat = new THREE.MeshLambertMaterial({ color: '#8b2020' });

// Shared geometries
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
const coneGeo = new THREE.ConeGeometry(1, 1, 4);
const cone6Geo = new THREE.ConeGeometry(1, 1, 6);
const cone8Geo = new THREE.ConeGeometry(1, 1, 8);
const cyl8Geo = new THREE.CylinderGeometry(1, 1, 1, 8);

function Castle() {
  const { x, z } = POIS.castle;
  const y = getTerrainHeight(x, z);
  return (
    <group position={[x, y, z]}>
      {/* Keep */}
      <mesh position={[0, 8, 0]} geometry={boxGeo} scale={[10, 16, 10]} material={castleMat} castShadow />
      {/* Keep roof */}
      <mesh position={[0, 17.5, 0]} geometry={coneGeo} scale={[7.5, 4, 7.5]} material={roofMat} castShadow />

      {/* Walls */}
      <mesh position={[0, 4, -18]} geometry={boxGeo} scale={[28, 8, 2.5]} material={castleMat} castShadow />
      <mesh position={[0, 4, 18]} geometry={boxGeo} scale={[28, 8, 2.5]} material={castleMat} castShadow />
      <mesh position={[-14, 4, 0]} geometry={boxGeo} scale={[2.5, 8, 33]} material={castleMat} castShadow />
      <mesh position={[14, 4, 0]} geometry={boxGeo} scale={[2.5, 8, 33]} material={castleMat} castShadow />

      {/* Corner towers */}
      {[[-14, -18], [14, -18], [-14, 18], [14, 18]].map(([cx, cz], i) => (
        <group key={`t-${i}`}>
          <mesh position={[cx, 6, cz]} geometry={cyl8Geo} scale={[3, 12, 3]} material={stoneDarkMat} castShadow />
          <mesh position={[cx, 13, cz]} geometry={cone8Geo} scale={[3.8, 3, 3.8]} material={roofMat} castShadow />
        </group>
      ))}

      {/* Gate */}
      <mesh position={[0, 7, 18.5]} geometry={boxGeo} scale={[6, 3, 3]} material={stoneDarkMat} castShadow />
      <mesh position={[0, 3, 18.5]} geometry={boxGeo} scale={[4, 5.5, 3.2]} material={darkMat} />
      {[-4.5, 4.5].map((gx, i) => (
        <group key={`g-${i}`}>
          <mesh position={[gx, 6, 18.5]} geometry={cyl8Geo} scale={[2, 12, 2]} material={castleMat} castShadow />
          <mesh position={[gx, 12.5, 18.5]} geometry={cone6Geo} scale={[2.5, 2.5, 2.5]} material={roofMat} castShadow />
        </group>
      ))}

      {/* Broken wall */}
      <mesh position={[14, 2, 8]} geometry={boxGeo} scale={[3, 4, 4]} material={stoneMat} castShadow />

      {/* Banner */}
      <mesh position={[0, 20, 0]} geometry={boxGeo} scale={[0.1, 4, 0.1]} material={woodDarkMat} castShadow />
      <mesh position={[0.4, 20.5, 0]} geometry={boxGeo} scale={[0.7, 1, 0.04]} material={bannerMat} castShadow />
    </group>
  );
}

function Village() {
  const { x, z } = POIS.village;
  const y = getTerrainHeight(x, z);

  const houses: { pos: [number, number]; rot: number; w: number; d: number; h: number; }[] = [
    { pos: [0, 0], rot: 0, w: 5, d: 6, h: 3.5 },
    { pos: [-12, 6], rot: 0.3, w: 4, d: 5, h: 3 },
    { pos: [10, -7], rot: -0.5, w: 6, d: 5, h: 3.5 },
    { pos: [-6, -12], rot: 1.2, w: 4.5, d: 5.5, h: 3 },
    { pos: [14, 9], rot: 2.1, w: 5, d: 4.5, h: 3.2 },
  ];

  return (
    <group position={[x, y, z]}>
      {houses.map((house, i) => {
        const hy = getTerrainHeight(x + house.pos[0], z + house.pos[1]) - y;
        return (
          <group key={i} position={[house.pos[0], hy, house.pos[1]]} rotation={[0, house.rot, 0]}>
            {/* Foundation */}
            <mesh position={[0, 0.15, 0]} geometry={boxGeo}
              scale={[house.w + 0.4, 0.3, house.d + 0.4]} material={stoneMat} castShadow />
            {/* Lower wall */}
            <mesh position={[0, 0.9, 0]} geometry={boxGeo}
              scale={[house.w, 1.5, house.d]} material={stoneDarkMat} castShadow />
            {/* Upper wall */}
            <mesh position={[0, 2.15, 0]} geometry={boxGeo}
              scale={[house.w, 1, house.d]} material={woodMat} castShadow />
            {/* Roof */}
            <mesh position={[0, house.h + 1, 0]} geometry={coneGeo}
              scale={[house.w * 0.75, 2.2, house.w * 0.75]} material={roofMat} castShadow />
            {/* Door */}
            <mesh position={[0, 0.8, house.d / 2 + 0.01]} geometry={boxGeo}
              scale={[0.9, 1.5, 0.08]} material={doorMat} castShadow />
          </group>
        );
      })}

      {/* Well */}
      <mesh position={[4, 0.5, 4]} geometry={cyl8Geo} scale={[1, 1, 1]} material={stoneMat} />
      <mesh position={[4, 1.8, 4]} geometry={boxGeo} scale={[0.12, 2.5, 0.12]} material={woodDarkMat} castShadow />

      {/* Hay bales */}
      {[[-8, -6], [9, 5]].map(([bx, bz], i) => (
        <mesh key={`hay-${i}`} position={[bx, 0.35, bz]} geometry={cyl8Geo}
          scale={[0.6, 0.7, 0.6]} material={hayMat} castShadow />
      ))}
    </group>
  );
}

function AncientRuins() {
  const { x, z } = POIS.ruins;
  const y = getTerrainHeight(x, z);
  return (
    <group position={[x, y, z]}>
      {/* Pillars — reduced count */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const r = 12;
        const height = 2 + Math.sin(i * 2.7) * 4 + 2;
        return (
          <group key={i} position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}>
            <mesh position={[0, 0.25, 0]} geometry={boxGeo}
              scale={[1.4, 0.5, 1.4]} material={stoneDarkMat} castShadow />
            <mesh position={[0, height / 2 + 0.5, 0]} geometry={cyl8Geo}
              scale={[0.5, height, 0.5]} material={stoneMat} castShadow />
          </group>
        );
      })}

      {/* Altar */}
      <mesh position={[0, 0.15, 0]} geometry={boxGeo} scale={[6, 0.3, 6]} material={stoneDarkMat} castShadow />
      <mesh position={[0, 0.95, 0]} geometry={boxGeo} scale={[3.5, 0.7, 2]} material={stoneDarkMat} castShadow />

      {/* Fallen column */}
      <mesh position={[6, 0.4, 4]} rotation={[0, 0.5, Math.PI / 2]} geometry={cyl8Geo}
        scale={[0.4, 7, 0.4]} material={stoneMat} castShadow />

      {/* Arch */}
      <mesh position={[-2, 2.5, 12]} geometry={boxGeo} scale={[1, 5, 1]} material={stoneMat} castShadow />
      <mesh position={[2, 2, 12]} geometry={boxGeo} scale={[1, 4, 1]} material={stoneMat} castShadow />
      <mesh position={[0, 4.8, 12]} geometry={boxGeo} scale={[5.5, 0.8, 1]} material={stoneDarkMat} castShadow />
    </group>
  );
}

function BanditCamp() {
  const { x, z } = POIS.camp;
  const y = getTerrainHeight(x, z);
  return (
    <group position={[x, y, z]}>
      {/* Tent */}
      <mesh position={[-3, 1.2, 0]} geometry={cone6Geo} scale={[2.5, 2.5, 2.5]} material={tentMat} castShadow />
      <mesh position={[4, 1, 3]} geometry={cone6Geo} scale={[2, 2, 2]} material={tentMat} castShadow />
      {/* Campfire stones */}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.6, 0.1, Math.sin(a) * 0.6]} geometry={boxGeo}
            scale={[0.25, 0.2, 0.25]} material={stoneMat} castShadow />
        );
      })}
    </group>
  );
}

export function POIs() {
  return (
    <group>
      <Castle />
      <Village />
      <AncientRuins />
      <BanditCamp />
    </group>
  );
}
