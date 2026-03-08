import { COLORS } from '../constants';

export function Atmosphere() {
  return (
    <>
      {/* Main directional light (sun) — warm golden hour */}
      <directionalLight
        position={[120, 60, 80]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={300}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        color="#ffe0a0"
      />
      {/* Secondary fill light — cool blue from opposite */}
      <directionalLight
        position={[-80, 40, -60]}
        intensity={0.25}
        color="#8ab0d0"
      />
      {/* Ambient fill — slightly warm */}
      <ambientLight intensity={0.3} color="#9aabbf" />
      {/* Hemisphere light for sky/ground color bleed */}
      <hemisphereLight
        args={['#7a98b8', '#4a6a3a', 0.35]}
      />
      {/* Fog for atmosphere and depth */}
      <fog attach="fog" args={['#8a9a80', 60, 220]} />
    </>
  );
}