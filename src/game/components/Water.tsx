import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants';

export function Water() {
  const ref = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = -0.8 + Math.sin(clock.elapsedTime * 0.5) * 0.1;
    }
  });

  // River-like water body
  return (
    <group>
      {/* Main river */}
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0.3]} position={[30, -0.8, 20]}>
        <planeGeometry args={[20, 120]} />
        <meshStandardMaterial 
          color={COLORS.water}
          transparent
          opacity={0.7}
          metalness={0.3}
          roughness={0.2}
        />
      </mesh>
      {/* Small pond near village */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-50, -0.6, -40]}>
        <circleGeometry args={[12, 32]} />
        <meshStandardMaterial
          color={COLORS.waterDeep}
          transparent
          opacity={0.75}
          metalness={0.3}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}
