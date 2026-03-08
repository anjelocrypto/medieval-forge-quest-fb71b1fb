/**
 * Reusable medieval building piece definitions.
 * Each piece is described as data, rendered by Settlements.tsx.
 * This keeps the rendering component clean and pieces reusable.
 */
import * as THREE from 'three';

// Shared geometries — created once
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  plane: new THREE.PlaneGeometry(1, 1),
};

// Shared materials — medieval palette
export const MAT = {
  stone: new THREE.MeshLambertMaterial({ color: '#a0a0a0' }),
  stoneDark: new THREE.MeshLambertMaterial({ color: '#5a5a5a' }),
  stoneLight: new THREE.MeshLambertMaterial({ color: '#b0b0a8' }),
  stoneRuin: new THREE.MeshLambertMaterial({ color: '#7a7060' }),
  wood: new THREE.MeshLambertMaterial({ color: '#8b6914' }),
  woodDark: new THREE.MeshLambertMaterial({ color: '#6b4f10' }),
  woodLight: new THREE.MeshLambertMaterial({ color: '#a07a20' }),
  plaster: new THREE.MeshLambertMaterial({ color: '#d4c8a0' }),
  roof: new THREE.MeshLambertMaterial({ color: '#8b3a3a' }),
  roofDark: new THREE.MeshLambertMaterial({ color: '#6a2a2a' }),
  roofThatch: new THREE.MeshLambertMaterial({ color: '#9a8a40' }),
  door: new THREE.MeshLambertMaterial({ color: '#3a2510' }),
  dark: new THREE.MeshLambertMaterial({ color: '#1a1a1a' }),
  hay: new THREE.MeshLambertMaterial({ color: '#c4a040' }),
  tent: new THREE.MeshLambertMaterial({ color: '#6a5a3a' }),
  tentDark: new THREE.MeshLambertMaterial({ color: '#4a3a2a' }),
  metal: new THREE.MeshLambertMaterial({ color: '#888' }),
  banner: new THREE.MeshLambertMaterial({ color: '#8b2020' }),
  bannerBlue: new THREE.MeshLambertMaterial({ color: '#2a3a8b' }),
  fence: new THREE.MeshLambertMaterial({ color: '#5a4520' }),
  crop: new THREE.MeshLambertMaterial({ color: '#8a9a30' }),
  cropGold: new THREE.MeshLambertMaterial({ color: '#c4a840' }),
  water: new THREE.MeshLambertMaterial({ color: '#2e5c7a', transparent: true, opacity: 0.7 }),
  fire: new THREE.MeshBasicMaterial({ color: '#ff6a10' }),
  cage: new THREE.MeshLambertMaterial({ color: '#3a3a3a' }),
  moss: new THREE.MeshLambertMaterial({ color: '#3a5a2a' }),
  snow: new THREE.MeshLambertMaterial({ color: '#d0d8e0' }),
  palisade: new THREE.MeshLambertMaterial({ color: '#5a4a30' }),
};

// Seeded random for deterministic generation
export function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
