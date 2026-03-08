import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants';

// Dust / pollen particles floating in air
function DustParticles() {
  const COUNT = 200;
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 120;
      arr[i * 3 + 1] = 2 + Math.random() * 15;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    return arr;
  }, []);

  const velocities = useMemo(() => {
    return Array.from({ length: COUNT }, () => ({
      x: (Math.random() - 0.5) * 0.3,
      y: (Math.random() - 0.5) * 0.1,
      z: (Math.random() - 0.5) * 0.3,
    }));
  }, []);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    const dt = Math.min(delta, 0.05);
    const time = state.clock.elapsedTime;

    for (let i = 0; i < COUNT; i++) {
      let x = pos.getX(i) + velocities[i].x * dt + Math.sin(time * 0.5 + i) * 0.01;
      let y = pos.getY(i) + velocities[i].y * dt + Math.sin(time * 0.3 + i * 0.7) * 0.005;
      let z = pos.getZ(i) + velocities[i].z * dt + Math.cos(time * 0.4 + i * 1.3) * 0.01;

      // Wrap around
      if (x > 60) x -= 120;
      if (x < -60) x += 120;
      if (z > 60) z -= 120;
      if (z < -60) z += 120;
      if (y > 18) y = 2;
      if (y < 1) y = 18;

      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#e8dcc0"
        size={0.12}
        transparent
        opacity={0.4}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// Fireflies near water at dusk feel
function Fireflies() {
  const COUNT = 30;
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      // Near water areas
      const angle = Math.random() * Math.PI * 2;
      const r = 5 + Math.random() * 15;
      arr[i * 3] = 30 + Math.cos(angle) * r; // near river
      arr[i * 3 + 1] = 0.5 + Math.random() * 3;
      arr[i * 3 + 2] = 20 + Math.sin(angle) * r;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < COUNT; i++) {
      const baseY = 0.5 + (i / COUNT) * 3;
      pos.setY(i, baseY + Math.sin(time * 0.8 + i * 2.5) * 0.5);
      pos.setX(i, pos.getX(i) + Math.sin(time * 0.3 + i) * 0.003);
      pos.setZ(i, pos.getZ(i) + Math.cos(time * 0.4 + i * 1.1) * 0.003);
    }
    pos.needsUpdate = true;

    // Pulse opacity
    const mat = ref.current.material as THREE.PointsMaterial;
    mat.opacity = 0.3 + Math.sin(time * 2) * 0.15;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#aaff44"
        size={0.25}
        transparent
        opacity={0.4}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function AmbientEffects() {
  return (
    <group>
      <DustParticles />
      <Fireflies />
    </group>
  );
}
