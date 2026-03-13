/**
 * Cinematic 3D scene for the main menu.
 * Renders the world in presentation-only mode without gameplay systems.
 */
import { Canvas } from '@react-three/fiber';
import { Terrain } from '../components/Terrain';
import { Water } from '../components/Water';
import { Atmosphere } from '../components/Atmosphere';
import { Sky } from '../components/Sky';
import { Settlements } from '../components/Settlements';
import { WorldPOIs } from '../components/WorldPOIs';
import { AmbientEffects } from '../components/AmbientEffects';
import { CinematicCamera } from './CinematicCamera';
import { MenuCanvasCleanup } from '../systems/WebGLRecovery';
import { useRef } from 'react';
import * as THREE from 'three';

export function MenuScene3D() {
  // Dummy ref for components that require playerPositionRef (won't be used in menu)
  const dummyPositionRef = useRef(new THREE.Vector3(0, 0, 0));

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        shadows
        camera={{ fov: 55, near: 0.5, far: 600, position: [60, 40, 60] }}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        {/* Cleanup on unmount to free GPU memory */}
        <MenuCanvasCleanup />
        {/* Core atmosphere */}
        <Atmosphere playerPositionRef={dummyPositionRef} />
        <Sky />
        
        {/* World geometry */}
        <Terrain />
        <Water />
        
        {/* Settlements and POIs - use far position to render all */}
        <MenuSettlements />
        <MenuWorldPOIs />
        
        {/* Ambient particles */}
        <AmbientEffects />
        
        {/* Cinematic automated camera */}
        <CinematicCamera />
      </Canvas>
    </div>
  );
}

// Wrapper that renders settlements without LOD distance culling
function MenuSettlements() {
  // Create a ref at a far position so all settlements render
  const farRef = useRef(new THREE.Vector3(0, 0, 0));
  return <Settlements playerPositionRef={farRef} />;
}

// Wrapper that renders POIs without LOD distance culling
function MenuWorldPOIs() {
  // Create a ref at center so POIs within range render
  const centerRef = useRef(new THREE.Vector3(0, 0, 0));
  return <WorldPOIs playerPositionRef={centerRef} />;
}
