import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants';

export function Water() {
  const riverRef = useRef<THREE.Mesh>(null);
  const pondRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (riverRef.current) {
      riverRef.current.position.y = -0.75 + Math.sin(t * 0.6) * 0.08;
      (riverRef.current.material as THREE.MeshStandardMaterial).opacity =
        0.65 + Math.sin(t * 0.8) * 0.05;
    }
    if (pondRef.current) {
      pondRef.current.position.y = -0.55 + Math.sin(t * 0.4 + 1) * 0.05;
    }
  });

  return (
    <group>
      {/* Main river */}
      <mesh ref={riverRef} rotation={[-Math.PI / 2, 0, 0.3]} position={[30, -0.75, 20]}>
        <planeGeometry args={[22, 130]} />
        <meshStandardMaterial
          color={COLORS.water}
          transparent
          opacity={0.7}
          metalness={0.4}
          roughness={0.15}
        />
      </mesh>
      {/* River bank detail - darker edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0.3]} position={[30, -0.78, 20]}>
        <planeGeometry args={[26, 134]} />
        <meshStandardMaterial
          color={COLORS.waterDeep}
          transparent
          opacity={0.3}
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>

      {/* Small pond near village */}
      <mesh ref={pondRef} rotation={[-Math.PI / 2, 0, 0]} position={[-50, -0.55, -40]}>
        <circleGeometry args={[13, 32]} />
        <meshStandardMaterial
          color={COLORS.waterDeep}
          transparent
          opacity={0.72}
          metalness={0.35}
          roughness={0.18}
        />
      </mesh>
      {/* Pond edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-50, -0.58, -40]}>
        <circleGeometry args={[15, 32]} />
        <meshStandardMaterial
          color="#1a3a50"
          transparent
          opacity={0.2}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}