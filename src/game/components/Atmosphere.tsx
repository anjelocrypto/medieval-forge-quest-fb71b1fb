import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  playerPositionRef: React.RefObject<THREE.Vector3>;
}

export function Atmosphere({ playerPositionRef }: Props) {
  const lightRef = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    if (!lightRef.current || !playerPositionRef.current) return;
    const pp = playerPositionRef.current;
    // Move the light + target to follow player so shadows always render around them
    lightRef.current.position.set(pp.x + 120, 60, pp.z + 80);
    lightRef.current.target.position.set(pp.x, 0, pp.z);
    lightRef.current.target.updateMatrixWorld();
  });

  return (
    <>
      {/* Sun — shadow camera follows player */}
      <directionalLight
        ref={lightRef}
        position={[120, 60, 80]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={200}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        color="#ffe0a0"
      >
        <object3D attach="target" />
      </directionalLight>
      {/* Ambient fill */}
      <ambientLight intensity={0.35} color="#9aabbf" />
      {/* Hemisphere */}
      <hemisphereLight args={['#7a98b8', '#4a6a3a', 0.3]} />
      {/* Fog */}
      <fog attach="fog" args={['#8a9a80', 60, 200]} />
    </>
  );
}
