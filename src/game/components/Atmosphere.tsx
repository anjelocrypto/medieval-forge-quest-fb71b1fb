import { COLORS } from '../constants';

export function Atmosphere() {
  return (
    <>
      {/* Main directional light (sun) */}
      <directionalLight
        position={[100, 80, 60]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={300}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        color="#ffe4b0"
      />
      {/* Ambient fill */}
      <ambientLight intensity={0.35} color="#8ba8c4" />
      {/* Hemisphere light for sky/ground color bleed */}
      <hemisphereLight
        args={[COLORS.sky, COLORS.grass, 0.3]}
      />
      {/* Fog for atmosphere and draw distance */}
      <fog attach="fog" args={[COLORS.fog, 80, 250]} />
    </>
  );
}
