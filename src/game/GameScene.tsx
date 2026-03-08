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
import { BuildingSystem } from './components/BuildingSystem';
import { CameraController } from './systems/CameraController';
import { InputFlusher } from './systems/InputFlusher';
import { BuildModeController } from './systems/BuildModeController';
import { SurvivalHUD } from './ui/SurvivalHUD';
import { useGameState } from './hooks/useGameState';
import { generateWorldResources, WorldResource } from './systems/WorldResources';
import { generateEnemies, EnemyData } from './systems/EnemyData';
import { initInput } from './systems/InputSystem';

export function GameScene() {
  const {
    survival, updateSurvival, inventory, addResource,
    interactionText, setInteractionText,
    buildMode, toggleBuildMode, selectedBuildIndex, cycleBuild,
    structures, placeStructure, buildFeedback, setBuildFeedback,
    damageFlash, applyPlayerDamage,
  } = useGameState();

  const [resources, setResources] = useState<WorldResource[]>(() => generateWorldResources());
  const [enemies, setEnemies] = useState<EnemyData[]>(() => generateEnemies());
  const playerPositionRef = useRef(new THREE.Vector3(0, 0, 0));
  const playerRotationRef = useRef(0);
  const cameraAzimuthRef = useRef(0);
  const pendingPlayerDamageRef = useRef(0);

  useEffect(() => { initInput(); }, []);

  // Apply accumulated enemy damage each frame via RAF
  useEffect(() => {
    let raf: number;
    const tick = () => {
      if (pendingPlayerDamageRef.current > 0) {
        const dmg = pendingPlayerDamageRef.current;
        pendingPlayerDamageRef.current = 0;
        applyPlayerDamage(dmg);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [applyPlayerDamage]);

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
      return {
        ...e,
        health: Math.max(0, newHealth),
        hitFlash: 0.25,
        state: newHealth <= 0 ? 'dead' as const : e.state,
      };
    }));
  }, []);

  const handleRespawn = useCallback(() => {
    updateSurvival({ health: 100, stamina: 100, hunger: 80, temperature: 70 });
    pendingPlayerDamageRef.current = 0;
  }, [updateSurvival]);

  const handleEnemiesUpdate = useCallback((updated: EnemyData[]) => {
    setEnemies(updated);
  }, []);

  return (
    <div className="w-screen h-screen bg-background overflow-hidden cursor-crosshair">
      <SurvivalHUD
        survival={survival}
        inventory={inventory}
        interactionText={interactionText}
        buildMode={buildMode}
        selectedBuildIndex={selectedBuildIndex}
        buildFeedback={buildFeedback}
        damageFlash={damageFlash}
      />
      <Canvas shadows camera={{ fov: 55, near: 0.5, far: 500, position: [0, 10, 15] }}
        style={{ width: '100%', height: '100%' }}>
        <InputFlusher />
        <BuildModeController
          buildMode={buildMode}
          onToggle={toggleBuildMode}
          onCycle={cycleBuild}
          onCancelBuild={toggleBuildMode}
        />
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
          buildMode={buildMode}
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
          pendingPlayerDamageRef={pendingPlayerDamageRef}
        />
        <BuildingSystem
          buildMode={buildMode}
          selectedIndex={selectedBuildIndex}
          playerPositionRef={playerPositionRef}
          playerRotationRef={playerRotationRef}
          structures={structures}
          inventory={inventory}
          onPlace={placeStructure}
          onSetBuildFeedback={setBuildFeedback}
        />
      </Canvas>
    </div>
  );
}
