import { useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Terrain } from './components/Terrain';
import { Water } from './components/Water';
import { Trees } from './components/Trees';
import { Rocks } from './components/Rocks';
import { POIs } from './components/POIs';
import { Player } from './components/Player';
import { Atmosphere } from './components/Atmosphere';
import { Sky } from './components/Sky';
import { Gatherables } from './components/Gatherables';
import { AmbientEffects } from './components/AmbientEffects';
import { CameraController } from './systems/CameraController';
import { SurvivalHUD } from './ui/SurvivalHUD';
import { useGameState } from './hooks/useGameState';
import { generateGatherables, GatherableResource } from './systems/GatherableData';
import { ResourceInventory } from './types';

export function GameScene() {
  const {
    survival,
    updateSurvival,
    inventory,
    addResource,
    interactionText,
    setInteractionText,
  } = useGameState();

  const [resources, setResources] = useState<GatherableResource[]>(() => generateGatherables());
  const playerPositionRef = useRef(new THREE.Vector3(0, 0, 0));
  const cameraAzimuthRef = useRef(0);

  // Hack to pass keys ref from player to gatherables
  const keysRef = useRef<Set<string>>(new Set());
  // We'll use a ref bridge from the Player component
  const keysRefBridge = useRef<React.RefObject<Set<string>> | null>(null);

  const handleDepleteResource = useCallback((id: string) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, depleted: true, health: 0 } : r));
  }, []);

  const handleHitResource = useCallback((id: string) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, health: r.health - 1 } : r));
  }, []);

  return (
    <div className="w-screen h-screen bg-background overflow-hidden cursor-crosshair">
      <SurvivalHUD survival={survival} inventory={inventory} interactionText={interactionText} />
      <Canvas
        shadows
        camera={{ fov: 55, near: 0.5, far: 500, position: [0, 10, 15] }}
        style={{ width: '100%', height: '100%' }}
      >
        <Atmosphere />
        <Sky />
        <Terrain />
        <Water />
        <Trees />
        <Rocks />
        <POIs />
        <AmbientEffects />
        <CameraController targetRef={playerPositionRef} azimuthRef={cameraAzimuthRef} />
        <Player
          survival={survival}
          onSurvivalUpdate={updateSurvival}
          playerPositionRef={playerPositionRef}
          cameraAzimuthRef={cameraAzimuthRef}
        />
        <GatherablesScene
          resources={resources}
          playerPositionRef={playerPositionRef}
          onSetInteraction={setInteractionText}
          onAddResource={addResource}
          onDepleteResource={handleDepleteResource}
          onHitResource={handleHitResource}
        />
      </Canvas>
    </div>
  );
}

// Wrapper to get keyboard ref inside canvas
function GatherablesScene({
  resources,
  playerPositionRef,
  onSetInteraction,
  onAddResource,
  onDepleteResource,
  onHitResource,
}: {
  resources: GatherableResource[];
  playerPositionRef: React.RefObject<THREE.Vector3>;
  onSetInteraction: (t: string | null) => void;
  onAddResource: (type: keyof ResourceInventory, amount: number) => void;
  onDepleteResource: (id: string) => void;
  onHitResource: (id: string) => void;
}) {
  // Access the keyboard ref from the playerPositionRef bridge
  const keysRef = (playerPositionRef as any).keysRef as React.RefObject<Set<string>> | undefined;
  // Fallback empty set ref
  const fallbackRef = useRef(new Set<string>());

  return (
    <Gatherables
      resources={resources}
      playerPositionRef={playerPositionRef}
      onSetInteraction={onSetInteraction}
      onAddResource={onAddResource}
      onDepleteResource={onDepleteResource}
      onHitResource={onHitResource}
      keysRef={keysRef || fallbackRef}
    />
  );
}
