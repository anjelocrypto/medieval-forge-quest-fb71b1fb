import { useMemo, useRef, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTimeOfDay, getSunDirection, getSunElevation } from '../systems/TimeOfDay';

// Pre-defined sky palettes for different times
const palettes = {
  night: ['#0a1020', '#0f1a30', '#1a2540', '#1a2540', '#1a2540'],
  sunrise: ['#2a3050', '#5a4060', '#c07050', '#e09050', '#d08040'],
  day: ['#3a5a80', '#6a90b0', '#a0b8b0', '#c0b890', '#8a9a80'],
  sunset: ['#2a2040', '#6a3050', '#c05030', '#e08030', '#a06030'],
};

function interpolatePalette(a: string[], b: string[], t: number): string[] {
  const cA = new THREE.Color();
  const cB = new THREE.Color();
  return a.map((_, i) => {
    cA.set(a[i]);
    cB.set(b[i]);
    cA.lerp(cB, t);
    return '#' + cA.getHexString();
  });
}

function getPalette(time: number): string[] {
  if (time < 0.2 || time >= 0.8) {
    // Night
    if (time >= 0.8) {
      const p = (time - 0.8) / 0.2;
      return interpolatePalette(palettes.sunset, palettes.night, Math.min(1, p * 2));
    }
    if (time >= 0.15) {
      const p = (time - 0.15) / 0.05;
      return interpolatePalette(palettes.night, palettes.sunrise, p);
    }
    return palettes.night;
  }
  if (time < 0.3) {
    const p = (time - 0.2) / 0.1;
    return interpolatePalette(palettes.sunrise, palettes.day, p);
  }
  if (time < 0.7) {
    return palettes.day;
  }
  // 0.7 - 0.8: sunset
  const p = (time - 0.7) / 0.1;
  return interpolatePalette(palettes.day, palettes.sunset, p);
}

export const Sky = memo(function Sky() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const lastPaletteKey = useRef('');

  // Canvas for gradient
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 256;
    return c;
  }, []);

  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, [canvas]);

  // Update sky gradient every few frames
  const frameCount = useRef(0);

  useFrame(({ camera }) => {
    if (meshRef.current) {
      meshRef.current.position.copy(camera.position);
    }

    // Only redraw every 10 frames for performance
    frameCount.current++;
    if (frameCount.current % 10 !== 0) return;

    const time = getTimeOfDay();
    const palette = getPalette(time);
    const key = palette.join(',');
    if (key === lastPaletteKey.current) return;
    lastPaletteKey.current = key;

    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.3, palette[1]);
    gradient.addColorStop(0.6, palette[2]);
    gradient.addColorStop(0.85, palette[3]);
    gradient.addColorStop(1, palette[4]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1, 256);
    texture.needsUpdate = true;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[400, 32, 16]} />
      <meshBasicMaterial ref={matRef} map={texture} side={THREE.BackSide} />
    </mesh>
  );
});
