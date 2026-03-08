import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { POIS } from '../constants';

// Dust / pollen particles
function DustParticles() {
  const COUNT = 250;
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 140;
      arr[i * 3 + 1] = 1 + Math.random() * 18;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 140;
    }
    return arr;
  }, []);

  const velocities = useMemo(() =>
    Array.from({ length: COUNT }, () => ({
      x: (Math.random() - 0.5) * 0.25,
      y: (Math.random() - 0.5) * 0.08,
      z: (Math.random() - 0.5) * 0.25,
    })), []);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    const dt = Math.min(delta, 0.05);
    const time = state.clock.elapsedTime;

    for (let i = 0; i < COUNT; i++) {
      let x = pos.getX(i) + velocities[i].x * dt + Math.sin(time * 0.4 + i) * 0.008;
      let y = pos.getY(i) + velocities[i].y * dt + Math.sin(time * 0.25 + i * 0.7) * 0.004;
      let z = pos.getZ(i) + velocities[i].z * dt + Math.cos(time * 0.35 + i * 1.3) * 0.008;

      if (x > 70) x -= 140; if (x < -70) x += 140;
      if (z > 70) z -= 140; if (z < -70) z += 140;
      if (y > 20) y = 1; if (y < 0.5) y = 20;

      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#e0d8b0" size={0.1} transparent opacity={0.35} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// Fireflies near water and ruins
function Fireflies() {
  const COUNT = 40;
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      // Distribute near water and ruins
      const zone = i % 3;
      if (zone === 0) {
        // Near river
        const angle = Math.random() * Math.PI * 2;
        const r = 3 + Math.random() * 12;
        arr[i * 3] = 30 + Math.cos(angle) * r;
        arr[i * 3 + 1] = 0.3 + Math.random() * 2.5;
        arr[i * 3 + 2] = 20 + Math.sin(angle) * r;
      } else if (zone === 1) {
        // Near ruins
        arr[i * 3] = POIS.ruins.x + (Math.random() - 0.5) * 20;
        arr[i * 3 + 1] = 0.5 + Math.random() * 4;
        arr[i * 3 + 2] = POIS.ruins.z + (Math.random() - 0.5) * 20;
      } else {
        // Near village pond
        arr[i * 3] = -50 + (Math.random() - 0.5) * 20;
        arr[i * 3 + 1] = 0.3 + Math.random() * 2;
        arr[i * 3 + 2] = -40 + (Math.random() - 0.5) * 20;
      }
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < COUNT; i++) {
      const baseY = 0.3 + ((i % 10) / 10) * 3;
      pos.setY(i, baseY + Math.sin(time * 0.7 + i * 2.5) * 0.6);
      pos.setX(i, pos.getX(i) + Math.sin(time * 0.25 + i) * 0.004);
      pos.setZ(i, pos.getZ(i) + Math.cos(time * 0.3 + i * 1.1) * 0.004);
    }
    pos.needsUpdate = true;

    const mat = ref.current.material as THREE.PointsMaterial;
    mat.opacity = 0.25 + Math.sin(time * 1.5) * 0.15;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#bbff44" size={0.2} transparent opacity={0.35} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// Birds - distant silhouettes circling high
function DistantBirds() {
  const COUNT = 8;
  const ref = useRef<THREE.Points>(null);

  const basePositions = useMemo(() =>
    Array.from({ length: COUNT }, (_, i) => ({
      cx: (Math.random() - 0.5) * 120,
      cz: (Math.random() - 0.5) * 120,
      r: 15 + Math.random() * 25,
      h: 25 + Math.random() * 20,
      speed: 0.15 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
    })), []);

  const positions = useMemo(() => new Float32Array(COUNT * 3), []);

  useFrame((state) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < COUNT; i++) {
      const b = basePositions[i];
      const angle = time * b.speed + b.phase;
      pos.setXYZ(i,
        b.cx + Math.cos(angle) * b.r,
        b.h + Math.sin(time * 0.5 + i * 2) * 3,
        b.cz + Math.sin(angle) * b.r
      );
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#2a2a2a" size={0.4} sizeAttenuation depthWrite={false} />
    </points>
  );
}

export function AmbientEffects() {
  return (
    <group>
      <DustParticles />
      <Fireflies />
      <DistantBirds />
    </group>
  );
}