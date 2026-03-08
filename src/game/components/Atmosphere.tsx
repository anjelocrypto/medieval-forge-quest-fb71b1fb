import { COLORS } from '../constants';

export function Atmosphere() {
  return (
    <>
      {/* Sun — reduced shadow map for performance */}
      <directionalLight
        position={[120, 60, 80]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        color="#ffe0a0"
      />
      {/* Ambient fill */}
      <ambientLight intensity={0.35} color="#9aabbf" />
      {/* Hemisphere */}
      <hemisphereLight args={['#7a98b8', '#4a6a3a', 0.3]} />
      {/* Fog */}
      <fog attach="fog" args={['#8a9a80', 60, 200]} />
    </>
  );
}