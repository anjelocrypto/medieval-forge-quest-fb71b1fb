import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HorseData } from '../systems/HorseData';

interface Props {
  horses: HorseData[];
  playerPositionRef: React.RefObject<THREE.Vector3>;
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const bodyMat = new THREE.MeshLambertMaterial({ color: '#6a4a2a' });
const bodyDarkMat = new THREE.MeshLambertMaterial({ color: '#4a3218' });
const maneMat = new THREE.MeshLambertMaterial({ color: '#2a1a08' });
const hoofMat = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });
const eyeMat = new THREE.MeshBasicMaterial({ color: '#111' });
const saddleMat = new THREE.MeshLambertMaterial({ color: '#5a2010' });

export function Horses({ horses, playerPositionRef }: Props) {
  const animRef = useRef(0);

  useFrame((_, delta) => {
    animRef.current += delta;
  });

  const playerPos = playerPositionRef.current;
  const t = animRef.current;

  return (
    <group>
      {horses.map(h => {
        if (h.isMounted) return null;
        if (playerPos) {
          const dx = playerPos.x - h.position[0];
          const dz = playerPos.z - h.position[2];
          if (dx * dx + dz * dz > 150 * 150) return null;
        }

        // Rich idle animation
        const breath = Math.sin(t * 1.2 + h.position[0]) * 0.025;
        const headNod = Math.sin(t * 0.6 + h.position[0] * 0.5) * 0.06;
        const tailSwish = Math.sin(t * 1.8 + h.position[0]) * 0.35;
        const earFlick = Math.sin(t * 2.5 + h.position[2]) > 0.8 ? 0.1 : 0;
        const weightShift = Math.sin(t * 0.3) * 0.01;
        // Occasional leg lift
        const legLift = Math.sin(t * 0.4 + 2) > 0.95 ? Math.sin(t * 3) * 0.15 : 0;

        return (
          <group key={h.id} position={[h.position[0], h.position[1], h.position[2]]}
            rotation={[0, h.rotation, 0]}>
            {/* Body with breathing */}
            <mesh position={[weightShift, 1.1 + breath, 0]} geometry={boxGeo}
              scale={[0.7, 0.65, 1.6]} material={bodyMat} castShadow />
            <mesh position={[weightShift, 1.15 + breath, 0.6]} geometry={boxGeo}
              scale={[0.6, 0.55, 0.4]} material={bodyMat} castShadow />
            <mesh position={[weightShift, 1.05 + breath, -0.65]} geometry={boxGeo}
              scale={[0.55, 0.5, 0.35]} material={bodyMat} castShadow />

            {/* Neck with gentle motion */}
            <group position={[0, 1.55 + breath, 0.8]} rotation={[0.5 + headNod * 0.3, 0, 0]}>
              <mesh geometry={boxGeo} scale={[0.35, 0.7, 0.35]} material={bodyMat} castShadow />
            </group>
            {/* Head with nodding */}
            <group position={[0, 1.85 + breath + headNod * 0.3, 1.15 + headNod * 0.2]}>
              <mesh geometry={boxGeo} scale={[0.3, 0.28, 0.45]} material={bodyMat} castShadow />
              <mesh position={[0, -0.08, 0.25]} geometry={boxGeo}
                scale={[0.22, 0.18, 0.25]} material={bodyDarkMat} castShadow />
              <mesh position={[-0.14, 0.04, 0.08]} geometry={boxGeo}
                scale={[0.04, 0.06, 0.04]} material={eyeMat} />
              <mesh position={[0.14, 0.04, 0.08]} geometry={boxGeo}
                scale={[0.04, 0.06, 0.04]} material={eyeMat} />
              {/* Ears with flick */}
              <mesh position={[-0.08, 0.2, 0]} rotation={[earFlick, 0, -0.1]} geometry={boxGeo}
                scale={[0.06, 0.14, 0.06]} material={bodyDarkMat} castShadow />
              <mesh position={[0.08, 0.2, 0]} rotation={[-earFlick * 0.5, 0, 0.1]} geometry={boxGeo}
                scale={[0.06, 0.14, 0.06]} material={bodyDarkMat} castShadow />
            </group>
            {/* Mane */}
            <mesh position={[0, 1.65 + breath, 0.65]} rotation={[0.4, 0, 0]}
              geometry={boxGeo} scale={[0.08, 0.5, 0.3]} material={maneMat} castShadow />
            {/* Saddle */}
            <mesh position={[0, 1.5 + breath, 0.05]} geometry={boxGeo}
              scale={[0.55, 0.12, 0.5]} material={saddleMat} castShadow />
            <mesh position={[0, 1.55 + breath, -0.2]} geometry={boxGeo}
              scale={[0.3, 0.2, 0.1]} material={saddleMat} castShadow />

            {/* Legs — with occasional weight shift */}
            {([
              [-0.22, 0.5, 0],
              [0.22, 0.5, 0],
              [-0.22, -0.5, legLift],
              [0.22, -0.5, 0],
            ] as [number, number, number][]).map(([lx, lz, lift], i) => (
              <group key={i} position={[lx, 0, lz]} rotation={[lift, 0, 0]}>
                <mesh position={[0, 0.55, 0]} geometry={boxGeo}
                  scale={[0.16, 0.7, 0.16]} material={bodyMat} castShadow />
                <mesh position={[0, 0.12, 0]} geometry={boxGeo}
                  scale={[0.14, 0.35, 0.14]} material={bodyDarkMat} castShadow />
                <mesh position={[0, -0.02, 0]} geometry={boxGeo}
                  scale={[0.15, 0.08, 0.18]} material={hoofMat} castShadow />
              </group>
            ))}

            {/* Tail with swish */}
            <group position={[0, 1.0, -0.95]} rotation={[tailSwish - 0.3, Math.sin(t * 0.9) * 0.12, 0]}>
              <mesh geometry={boxGeo} scale={[0.06, 0.5, 0.06]} material={maneMat} castShadow />
              {/* Tail tuft */}
              <mesh position={[0, -0.28, 0]} geometry={boxGeo}
                scale={[0.08, 0.15, 0.08]} material={maneMat} castShadow />
            </group>
          </group>
        );
      })}
    </group>
  );
}
