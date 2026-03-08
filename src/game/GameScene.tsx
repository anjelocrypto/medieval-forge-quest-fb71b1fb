import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Terrain } from './components/Terrain';
import { Water } from './components/Water';
import { POIs } from './components/POIs';
import { Player } from './components/Player';
import { Atmosphere } from './components/Atmosphere';
import { Sky } from './components/Sky';
import { WorldObjects } from './components/WorldObjects';
import { Enemies } from './components/Enemies';
import { AmbientEffects } from './components/AmbientEffects';
import { CameraController } from './systems/CameraController';
import { InputFlusher } from './systems/InputFlusher';
import { SurvivalHUD } from './ui/SurvivalHUD';
import { useGameState } from './hooks/useGameState';
import { generateWorldResources, WorldResource } from './systems/WorldResources';
import { generateEnemies, EnemyData } from './systems/EnemyData';
import { initInput } from './systems/InputSystem';

export function GameScene() {
  const {
    survival, updateSurvival, inventory, addResource,
    interactionText, setInteractionText,
  } = useGameState();

  const [resources, setResources] = useState<WorldResource[]>(() => generateWorldResources());
  const [enemies, setEnemies] = useState<EnemyData[]>(() => generateEnemies());
  const playerPositionRef = useRef(new THREE.Vector3(0, 0, 0));
  const playerRotationRef = useRef(0);
  const cameraAzimuthRef = useRef(0);

  // Initialize input system once
  useEffect(() => { initInput(); }, []);

  const handleDepleteResource = useCallback((id: string) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, depleted: true, health: 0 } : r));
  }, []);

  const handleHitResource = useCallback((id: string) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, health: r.health - 1 } : r));
  }, []);

  const handleEnemyHit = useCallback((id: string, damage: number) => {
    setEnemies(prev => prev.map(e => {
      if (e.id !== id) return e;
      const newHealth = e.health - damage;
      return { ...e, health: Math.max(0, newHealth), hitFlash: 0.2, state: newHealth <= 0 ? 'dead' as const : e.state };
    }));
  }, []);

  const handlePlayerDamage = useCallback((amount: number) => {
    updateSurvival({ health: survival.health - amount });
  }, [survival.health, updateSurvival]);

  const handleRespawn = useCallback(() => {
    updateSurvival({ health: 100, stamina: 100, hunger: 80, temperature: 70 });
  }, [updateSurvival]);

  const handleEnemiesUpdate = useCallback((updated: EnemyData[]) => {
    setEnemies(updated);
  }, []);

  return (
    <div className="w-screen h-screen bg-background overflow-hidden cursor-crosshair">
      <SurvivalHUD survival={survival} inventory={inventory} interactionText={interactionText} />
      <Canvas
        shadows
        camera={{ fov: 55, near: 0.5, far: 500, position: [0, 10, 15] }}
        style={{ width: '100%', height: '100%' }}
      >
        <InputFlusher />
        <Atmosphere />
        <Sky />
        <Terrain />
        <Water />
        <POIs />
        <AmbientEffects />
        <CameraController targetRef={playerPositionRef} azimuthRef={cameraAzimuthRef} />
        <Player
          survival={survival}
          onSurvivalUpdate={updateSurvival}
          playerPositionRef={playerPositionRef}
          playerRotationRef={playerRotationRef}
          cameraAzimuthRef={cameraAzimuthRef}
          enemies={enemies}
          onEnemyHit={handleEnemyHit}
          onRespawn={handleRespawn}
        />
        <WorldObjects
          resources={resources}
          playerPositionRef={playerPositionRef}
          onSetInteraction={setInteractionText}
          onAddResource={addResource}
          onDepleteResource={handleDepleteResource}
          onHitResource={handleHitResource}
        />
        <Enemies
          enemies={enemies}
          playerPositionRef={playerPositionRef}
          onEnemiesUpdate={handleEnemiesUpdate}
          onPlayerDamage={handlePlayerDamage}
        />
      </Canvas>
    </div>
  );
}
