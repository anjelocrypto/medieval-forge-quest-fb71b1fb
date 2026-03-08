import { useMemo } from 'react';
import * as THREE from 'three';

export function Sky() {
  const gradientMap = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    // Top: deep blue
    gradient.addColorStop(0, '#3a5a80');
    // Mid: soft blue
    gradient.addColorStop(0.3, '#6a90b0');
    // Low: warm haze
    gradient.addColorStop(0.65, '#a0b8b0');
    // Horizon: golden fog
    gradient.addColorStop(0.85, '#c0b890');
    gradient.addColorStop(1, '#8a9a80');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <mesh>
      <sphereGeometry args={[400, 32, 16]} />
      <meshBasicMaterial map={gradientMap} side={THREE.BackSide} />
    </mesh>
  );
}