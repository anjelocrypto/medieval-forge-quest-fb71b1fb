import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HorseData } from '../systems/HorseData';
import { getTerrainHeight } from './Terrain';

interface Props {
  horses: HorseData[];
  playerPositionRef: React.RefObject<THREE.Vector3>;
}

// Shared geometries & materials
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 5);
const bodyMat = new THREE.MeshLambertMaterial({ color: '#6a4a2a' });
const bodyDarkMat = new THREE.MeshLambertMaterial({ color: '#4a3218' });
const maneMat = new THREE.MeshLambertMaterial({ color: '#2a1a08' });
const hoofMat = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });
const eyeMat = new THREE.MeshBasicMaterial({ color: '#111' });
const saddleMat = new THREE.MeshLambertMaterial({ color: '#5a2010' });

export function Horses({ horses, playerPositionRef }: Props) {
  const animRef = useRef(0);

  useFrame((_, delta) => {
    animRef.current += delta * 2;
  });

  const playerPos = playerPositionRef.current;

  return (
    <group>
      {horses.map(h => {
        if (h.isMounted) return null;

        // Distance cull
        if (playerPos) {
          const dx = playerPos.x - h.position[0];
          const dz = playerPos.z - h.position[2];
          if (dx * dx + dz * dz > 150 * 150) return null;
        }

        const idleBreath = Math.sin(animRef.current + h.position[0]) * 0.02;
        const tailWag = Math.sin(animRef.current * 1.5 + h.position[0]) * 0.3;

        return (
          <group key={h.id} position={[h.position[0], h.position[1], h.position[2]]}
            rotation={[0, h.rotation, 0]}>
            {/* Body */}
            <mesh position={[0, 1.1 + idleBreath, 0]} geometry={boxGeo}
              scale={[0.7, 0.65, 1.6]} material={bodyMat} castShadow />
            {/* Chest */}
            <mesh position={[0, 1.15 + idleBreath, 0.6]} geometry={boxGeo}
              scale={[0.6, 0.55, 0.4]} material={bodyMat} castShadow />
            {/* Rump */}
            <mesh position={[0, 1.05 + idleBreath, -0.65]} geometry={boxGeo}
              scale={[0.55, 0.5, 0.35]} material={bodyMat} castShadow />

            {/* Neck */}
            <mesh position={[0, 1.55 + idleBreath, 0.8]} rotation={[0.5, 0, 0]}
              geometry={boxGeo} scale={[0.35, 0.7, 0.35]} material={bodyMat} castShadow />
            {/* Head */}
            <group position={[0, 1.85 + idleBreath, 1.15]}>
              <mesh geometry={boxGeo} scale={[0.3, 0.28, 0.45]} material={bodyMat} castShadow />
              {/* Snout */}
              <mesh position={[0, -0.08, 0.25]} geometry={boxGeo}
                scale={[0.22, 0.18, 0.25]} material={bodyDarkMat} castShadow />
              {/* Eyes */}
              <mesh position={[-0.14, 0.04, 0.08]} geometry={boxGeo}
                scale={[0.04, 0.06, 0.04]} material={eyeMat} />
              <mesh position={[0.14, 0.04, 0.08]} geometry={boxGeo}
                scale={[0.04, 0.06, 0.04]} material={eyeMat} />
              {/* Ears */}
              <mesh position={[-0.08, 0.2, 0]} geometry={boxGeo}
                scale={[0.06, 0.14, 0.06]} material={bodyDarkMat} castShadow />
              <mesh position={[0.08, 0.2, 0]} geometry={boxGeo}
                scale={[0.06, 0.14, 0.06]} material={bodyDarkMat} castShadow />
            </group>

            {/* Mane */}
            <mesh position={[0, 1.65 + idleBreath, 0.65]} rotation={[0.4, 0, 0]}
              geometry={boxGeo} scale={[0.08, 0.5, 0.3]} material={maneMat} castShadow />

            {/* Saddle */}
            <mesh position={[0, 1.5 + idleBreath, 0.05]} geometry={boxGeo}
              scale={[0.55, 0.12, 0.5]} material={saddleMat} castShadow />
            <mesh position={[0, 1.55 + idleBreath, -0.2]} geometry={boxGeo}
              scale={[0.3, 0.2, 0.1]} material={saddleMat} castShadow />

            {/* Legs — front left */}
            <group position={[-0.22, 0, 0.5]}>
              <mesh position={[0, 0.55, 0]} geometry={boxGeo}
                scale={[0.16, 0.7, 0.16]} material={bodyMat} castShadow />
              <mesh position={[0, 0.12, 0]} geometry={boxGeo}
                scale={[0.14, 0.35, 0.14]} material={bodyDarkMat} castShadow />
              <mesh position={[0, -0.02, 0]} geometry={boxGeo}
                scale={[0.15, 0.08, 0.18]} material={hoofMat} castShadow />
            </group>
            {/* Front right */}
            <group position={[0.22, 0, 0.5]}>
              <mesh position={[0, 0.55, 0]} geometry={boxGeo}
                scale={[0.16, 0.7, 0.16]} material={bodyMat} castShadow />
              <mesh position={[0, 0.12, 0]} geometry={boxGeo}
                scale={[0.14, 0.35, 0.14]} material={bodyDarkMat} castShadow />
              <mesh position={[0, -0.02, 0]} geometry={boxGeo}
                scale={[0.15, 0.08, 0.18]} material={hoofMat} castShadow />
            </group>
            {/* Back left */}
            <group position={[-0.22, 0, -0.5]}>
              <mesh position={[0, 0.55, 0]} geometry={boxGeo}
                scale={[0.16, 0.7, 0.16]} material={bodyMat} castShadow />
              <mesh position={[0, 0.12, 0]} geometry={boxGeo}
                scale={[0.14, 0.35, 0.14]} material={bodyDarkMat} castShadow />
              <mesh position={[0, -0.02, 0]} geometry={boxGeo}
                scale={[0.15, 0.08, 0.18]} material={hoofMat} castShadow />
            </group>
            {/* Back right */}
            <group position={[0.22, 0, -0.5]}>
              <mesh position={[0, 0.55, 0]} geometry={boxGeo}
                scale={[0.16, 0.7, 0.16]} material={bodyMat} castShadow />
              <mesh position={[0, 0.12, 0]} geometry={boxGeo}
                scale={[0.14, 0.35, 0.14]} material={bodyDarkMat} castShadow />
              <mesh position={[0, -0.02, 0]} geometry={boxGeo}
                scale={[0.15, 0.08, 0.18]} material={hoofMat} castShadow />
            </group>

            {/* Tail */}
            <group position={[0, 1.0, -0.95]} rotation={[tailWag - 0.3, 0, 0]}>
              <mesh geometry={boxGeo} scale={[0.06, 0.5, 0.06]} material={maneMat} castShadow />
            </group>
          </group>
        );
      })}
    </group>
  );
}
