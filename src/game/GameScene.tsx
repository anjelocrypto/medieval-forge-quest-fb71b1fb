import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Terrain, getTerrainHeight } from './components/Terrain';
import { Water } from './components/Water';
import { Player, MountedDebugData } from './components/Player';
import { Atmosphere } from './components/Atmosphere';
import { Sky } from './components/Sky';
import { WorldObjects } from './components/WorldObjects';
import { Enemies, EnemiesHandle, EnemyRuntime } from './components/Enemies';
import { AmbientEffects } from './components/AmbientEffects';
import { BuildingSystem } from './components/BuildingSystem';
import { LootPickups } from './components/LootPickups';
import { Horse } from './components/Horses';
import { Settlements } from './components/Settlements';
import { WorldPOIs } from './components/WorldPOIs';
import { TownDistrict } from './components/TownDistrict';
import { CivilianNPCs } from './components/CivilianNPCs';
import { SkyCreatures } from './components/SkyCreatures';
import { WildernessStructures } from './components/WildernessStructures';
import { Bridges } from './components/Bridges';
import { NightLighting } from './components/NightLighting';
import { RailwayDebugPreview } from './components/RailwayDebugPreview';
import { RailwayTrack } from './components/RailwayTrack';
import { RailwayStations } from './components/RailwayStations';
import { RailwayBridges } from './components/RailwayBridges';
import { RailwayLamps } from './components/RailwayLamps';
import { Train } from './components/Train';
import { DebugCollision } from './components/DebugCollision';
import { CameraController } from './systems/CameraController';
import { InputFlusher } from './systems/InputFlusher';
import { BuildModeController } from './systems/BuildModeController';
import { SurvivalHUD } from './ui/SurvivalHUD';
import { useGameState } from './hooks/useGameState';
import { generateWorldResources, WorldResource, generateLootDrop } from './systems/WorldResources';
import { initInput } from './systems/InputSystem';
import { POIS, POI_ZONE_RADIUS } from './constants';
// Multiplayer
import { RemotePlayers } from './multiplayer/RemotePlayers';
import { MultiplayerBroadcaster } from './multiplayer/MultiplayerBroadcaster';
import { MultiplayerHUD } from './multiplayer/MultiplayerHUD';
import { ChatPanel } from './multiplayer/ChatPanel';
import { useProximityVoice } from './multiplayer/useProximityVoice';
import { EmoteWheel } from './ui/EmoteWheel';
import { CharacterSelect } from './ui/CharacterSelect';
import { useCharacter } from './context/CharacterContext';
import { PerfBaselineR3F, PerfBaselineHUD } from './debug/PerfBaseline';
import { WebGLRecovery } from './systems/WebGLRecovery';
import { SceneDiagnosticsBoundary } from './debug/SceneDiagnostics';
import { preloadRemoteCharacterModels } from './multiplayer/preloadRemoteModels';
import { StartupReadiness } from './systems/StartupReadiness';

interface GameSceneProps {
  multiplayer: ReturnType<typeof import('./multiplayer/useMultiplayer').useMultiplayer>;
  onLeaveWorld: () => void;
  onSceneReady?: () => void;
}

export function GameScene({ multiplayer, onLeaveWorld, onSceneReady }: GameSceneProps) {
  const {
    survival, updateSurvival, inventory, addResource, eatFood,
    interactionText, setInteractionText,
    buildMode, toggleBuildMode, selectedBuildIndex, cycleBuild,
    structures, placeStructure, buildFeedback, setBuildFeedback,
    damageFlash, applyPlayerDamage,
    progression, recordEnemyKill, secureArea,
    lootPickups, addLootPickups, collectLoot,
    notification, getAvailableBuildables,
    horse, isMounted, mountHorse, dismountHorse, callHorse, updateHorse,
    addRemoteStructure,
  } = useGameState();

  const { character } = useCharacter();
  const [resources, setResources] = useState<WorldResource[]>(() => generateWorldResources());
  const enemiesHandleRef = useRef<EnemiesHandle>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [debugMounted, setDebugMounted] = useState(false);
  const [currentEmote, setCurrentEmote] = useState<string | null>(null);
  const [activeEmote, setActiveEmote] = useState<{ key: string; id: number } | null>(null);
  const emoteIdRef = useRef(0);
  const playerPositionRef = useRef(new THREE.Vector3(0, 0, 0));

  // Proximity voice chat
  const voice = useProximityVoice(
    multiplayer.playerId,
    multiplayer.connected,
    multiplayer.channelRef,
    playerPositionRef,
    multiplayer.remotePlayers as any,
  );
  const playerRotationRef = useRef(0);
  const cameraAzimuthRef = useRef(0);
  const pendingPlayerDamageRef = useRef(0);
  const shakeResourceRef = useRef<string | null>(null);
  const highlightedResourceRef = useRef<string | null>(null);
  const mountedDebugRef = useRef({ terrainY: 0, horseY: 0, riderY: 0, delta: 0, pitch: 0, pushX: 0, pushZ: 0 });
  const moveSpeedRef = useRef(0);
  const isRunningRef = useRef(false);
  const isGroundedRef = useRef(true);
  const attackAnimRef = useRef(0);

  // Debug: track GameScene mount/unmount + preload remote character GLBs
  useEffect(() => {
    console.log('[GameScene] MOUNTED');
    preloadRemoteCharacterModels();
    return () => console.log('[GameScene] UNMOUNTED');
  }, []);

  useEffect(() => { initInput(); }, []);

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

  // Mounted horse sync — commit position to React state only on dismount,
  // not every frame. Player.tsx is sole movement authority while mounted.
  // The horse visual is hidden while mounted (rendered inline by Player).
  const mountedSyncRef = useRef(false);
  useEffect(() => {
    if (isMounted) {
      mountedSyncRef.current = true;
    } else if (mountedSyncRef.current) {
      // Just dismounted — commit final horse position to state once
      mountedSyncRef.current = false;
      const pos = playerPositionRef.current;
      const horseY = getTerrainHeight(pos.x, pos.z);
      updateHorse({
        position: [pos.x, horseY, pos.z],
        rotation: playerRotationRef.current,
      });
    }
  }, [isMounted, updateHorse, playerPositionRef, playerRotationRef]);

  useEffect(() => {
    const checkInterval = setInterval(() => {
      const handle = enemiesHandleRef.current;
      if (!handle) return;
      const enemyMap = handle.getEnemies();
      for (const [key, poi] of Object.entries(POIS)) {
        if (progression.areasSecured.includes(key)) continue;
        let hasAlive = false;
        enemyMap.forEach(e => {
          if (e.state === 'dead') return;
          const dx = e.position[0] - poi.x;
          const dz = e.position[2] - poi.z;
          if (dx * dx + dz * dz < POI_ZONE_RADIUS * POI_ZONE_RADIUS) {
            hasAlive = true;
          }
        });
        if (!hasAlive) {
          secureArea(key);
        }
      }
    }, 2000);
    return () => clearInterval(checkInterval);
  }, [progression.areasSecured, secureArea]);

  // Map toggle + debug
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') setMapOpen(prev => !prev);
      if (e.code === 'F3') { e.preventDefault(); setDebugMounted(prev => !prev); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Handle multiplayer world events from remote players
  const processedEventCountRef = useRef(0);
  useEffect(() => {
    if (!multiplayer.connected) return;
    const events = multiplayer.worldEvents;
    const startIdx = processedEventCountRef.current;
    if (events.length <= startIdx) return;
    
    for (let i = startIdx; i < events.length; i++) {
      const ev = events[i];
      if (ev.playerId === multiplayer.playerId) continue;

      if (ev.type === 'resource_depleted') {
        const id = ev.payload.resourceId as string;
        setResources(prev => prev.map(r => r.id === id ? { ...r, depleted: true, health: 0 } : r));
      }
      if (ev.type === 'enemy_killed') {
        const id = ev.payload.enemyId as string;
        const handle = enemiesHandleRef.current;
        if (handle) {
          const enemy = handle.getEnemies().get(id);
          if (enemy && enemy.state !== 'dead') {
            enemy.health = 0;
            enemy.state = 'dead';
            enemy.deathTimer = 0;
          }
        }
      }
      if (ev.type === 'building_placed') {
        const structure = ev.payload.structure as Record<string, unknown>;
        if (structure) {
          addRemoteStructure(structure as any);
        }
      }
    }
    processedEventCountRef.current = events.length;
  }, [multiplayer.worldEvents, multiplayer.connected, multiplayer.playerId]);

  const handleDepleteResource = useCallback((id: string) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, depleted: true, health: 0 } : r));
    if (multiplayer.connected) {
      multiplayer.broadcastWorldEvent({
        type: 'resource_depleted',
        payload: { resourceId: id },
        playerId: multiplayer.playerId,
        timestamp: Date.now(),
      });
    }
  }, [multiplayer]);

  const handleHitResource = useCallback((id: string) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, health: r.health - 1 } : r));
  }, []);

  const handleEnemyKill = useCallback((enemy: EnemyRuntime) => {
    const drops = generateLootDrop(enemy.position, enemy.type);
    if (drops.length > 0) addLootPickups(drops);
    recordEnemyKill(enemy.type);
    if (multiplayer.connected) {
      multiplayer.broadcastWorldEvent({
        type: 'enemy_killed',
        payload: { enemyId: enemy.id, killerName: multiplayer.displayName },
        playerId: multiplayer.playerId,
        timestamp: Date.now(),
      });
    }
  }, [addLootPickups, recordEnemyKill, multiplayer]);

  const handleRespawn = useCallback(() => {
    updateSurvival({ health: 100, stamina: 100, hunger: 80, temperature: 70 });
    pendingPlayerDamageRef.current = 0;
  }, [updateSurvival]);


  // Wrap placeStructure to broadcast building placement
  const handlePlaceStructure = useCallback((structure: any) => {
    placeStructure(structure);
    if (multiplayer.connected) {
      multiplayer.broadcastWorldEvent({
        type: 'building_placed',
        payload: { structure },
        playerId: multiplayer.playerId,
        timestamp: Date.now(),
      });
    }
  }, [placeStructure, multiplayer]);

  const remotePlayerCount = multiplayer.remotePlayers.size;

  return (
    <div className="w-screen h-screen bg-background overflow-hidden cursor-crosshair">
      {/* PerfBaselineHUD removed from production — use F3 for debug */}
      <SurvivalHUD
        survival={survival}
        inventory={inventory}
        interactionText={interactionText}
        buildMode={buildMode}
        selectedBuildIndex={selectedBuildIndex}
        buildFeedback={buildFeedback}
        damageFlash={damageFlash}
        progression={progression}
        notification={notification}
        availableBuildables={getAvailableBuildables()}
        isMounted={isMounted}
        playerX={playerPositionRef.current.x}
        playerZ={playerPositionRef.current.z}
        playerRotation={playerRotationRef.current}
        horseX={horse.position[0]}
        horseZ={horse.position[2]}
        mapOpen={mapOpen}
        onCloseMap={() => setMapOpen(false)}
        isSpeaking={voice.isTalking}
      />

      {/* Multiplayer HUD */}
      <MultiplayerHUD
        connectionStatus={multiplayer.connectionStatus}
        playerCount={1 + remotePlayerCount}
        playerId={multiplayer.playerId}
        voiceState={multiplayer.connected ? { isTalking: voice.isTalking, micPermission: voice.micPermission } : undefined}
      />

      {/* Chat panel */}
      {multiplayer.connected && (
        <ChatPanel
          messages={multiplayer.chatMessages}
          onSendChat={multiplayer.sendChat}
          onSendEmote={(emote) => {
            multiplayer.sendEmote(emote);
            setCurrentEmote(emote);
            setTimeout(() => setCurrentEmote(null), 2000);
          }}
          displayName={multiplayer.displayName}
        />
      )}

      {/* Leave button */}
      {multiplayer.connected && (
        <button onClick={onLeaveWorld}
          className="fixed top-4 left-4 z-40 text-xs font-mono px-3 py-1 rounded"
          style={{ background: 'rgba(0,0,0,0.6)', color: '#a88', border: '1px solid #533' }}>
          ← Leave World
        </button>
      )}

      {/* Character Select (F4) */}
      <CharacterSelect />

      {/* Emote Wheel */}
      <EmoteWheel
        onSelectEmote={(key) => {
          emoteIdRef.current += 1;
          setActiveEmote({ key, id: emoteIdRef.current });
        }}
        isPlayingEmote={activeEmote !== null}
      />

      <Canvas shadows camera={{ fov: 55, near: 0.5, far: 1500, position: [0, 10, 15] }}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }}
        onCreated={({ gl }) => {
          console.log('[WebGL] GameScene Canvas created', gl.getContext()?.constructor.name);
        }}>

        <WebGLRecovery />
        {onSceneReady && <StartupReadiness onReady={onSceneReady} />}
        {/* PerfBaselineR3F disabled for production */}
        <InputFlusher />
        <SceneDiagnosticsBoundary>
          <BuildModeController
            buildMode={buildMode}
            onToggle={toggleBuildMode}
            onCycle={cycleBuild}
            onCancelBuild={toggleBuildMode}
          />
          <Atmosphere playerPositionRef={playerPositionRef} />
          <Sky />
          <Terrain />
          <Water />
          <Settlements playerPositionRef={playerPositionRef} />
          <WorldPOIs playerPositionRef={playerPositionRef} />
          <TownDistrict playerPositionRef={playerPositionRef} />
          <CivilianNPCs playerPositionRef={playerPositionRef} />
          <SkyCreatures playerPositionRef={playerPositionRef} />
          <WildernessStructures playerPositionRef={playerPositionRef} />
          <Bridges playerPositionRef={playerPositionRef} />
          <NightLighting playerPositionRef={playerPositionRef} />
          <AmbientEffects />
          <CameraController targetRef={playerPositionRef} azimuthRef={cameraAzimuthRef} isMounted={isMounted} />
          <Player
            survival={survival}
            onSurvivalUpdate={updateSurvival}
            playerPositionRef={playerPositionRef}
            playerRotationRef={playerRotationRef}
            cameraAzimuthRef={cameraAzimuthRef}
            enemiesHandleRef={enemiesHandleRef}

            onRespawn={handleRespawn}
            buildMode={buildMode}
            structures={structures}
            lootPickups={lootPickups}
            onCollectLoot={collectLoot}
            onEatFood={eatFood}
            horse={horse}
            isMounted={isMounted}
            onMountHorse={mountHorse}
            onDismountHorse={dismountHorse}
            onCallHorse={callHorse}
            onSetInteractionText={setInteractionText}
            onAddResource={addResource}
            onDepleteResource={handleDepleteResource}
            onHitResource={handleHitResource}
            inventory={inventory}
            shakeResourceRef={shakeResourceRef}
            highlightedResourceRef={highlightedResourceRef}
            resources={resources}
            mountedDebugRef={mountedDebugRef}
            externalMoveSpeedRef={moveSpeedRef}
            externalIsRunningRef={isRunningRef}
            externalIsGroundedRef={isGroundedRef}
            externalAttackAnimRef={attackAnimRef}
            activeEmote={activeEmote?.key ?? null}
            activeEmoteId={activeEmote?.id ?? 0}
            onEmoteComplete={useCallback(() => setActiveEmote(null), [])}
            damageFlash={damageFlash}
          />
          <WorldObjects
            resources={resources}
            playerPositionRef={playerPositionRef}
            shakeResourceRef={shakeResourceRef}
            highlightedResourceRef={highlightedResourceRef}
          />
          <LootPickups pickups={lootPickups} />
          <Horse horse={horse} playerPositionRef={playerPositionRef} onUpdateHorse={updateHorse} isMounted={isMounted} />
          <Enemies
            ref={enemiesHandleRef}
            playerPositionRef={playerPositionRef}
            onEnemyKill={handleEnemyKill}
            pendingPlayerDamageRef={pendingPlayerDamageRef}
          />
          <BuildingSystem
            buildMode={buildMode}
            selectedIndex={selectedBuildIndex}
            playerPositionRef={playerPositionRef}
            playerRotationRef={playerRotationRef}
            structures={structures}
            inventory={inventory}
            onPlace={handlePlaceStructure}
            onSetBuildFeedback={setBuildFeedback}
            availableBuildables={getAvailableBuildables()}
          />
          <DebugCollision playerPositionRef={playerPositionRef} isMounted={isMounted} />
          {/* RAILWAY — incremental re-enable. Static tracks only (no useFrame). */}
          {/* Terrain flattening grid is safe and active. */}
          <RailwayTrack />
          <RailwayLamps playerPositionRef={playerPositionRef} />
          {/* Railway structures */}
          <RailwayStations playerPositionRef={playerPositionRef} />
          <RailwayBridges playerPositionRef={playerPositionRef} />
          <Train />
          {/* <RailwayDebugPreview /> */}

          {/* Remote players from multiplayer */}
          <RemotePlayers remotePlayers={multiplayer.remotePlayers} playerPositionRef={playerPositionRef} />

          {/* Multiplayer broadcaster — samples local state and pushes to network hook */}
          {multiplayer.connected && (
            <MultiplayerBroadcaster
              playerId={multiplayer.playerId}
              displayName={multiplayer.displayName}
              characterType={character}
              playerPositionRef={playerPositionRef}
              playerRotationRef={playerRotationRef}
              survival={survival}
              isMounted={isMounted}
              horse={horse}
              moveSpeedRef={moveSpeedRef}
              isRunningRef={isRunningRef}
              isGroundedRef={isGroundedRef}
              attackAnimRef={attackAnimRef}
              mountedDebugRef={mountedDebugRef}
              buildMode={buildMode}
              emote={activeEmote?.key ?? currentEmote}
              isSpeaking={voice.isTalking}
              onUpdateLocalState={multiplayer.updateLocalState}
            />
          )}
        </SceneDiagnosticsBoundary>
      </Canvas>

      {/* Debug overlay disabled for production */}
    </div>
  );
}

function MountedDebugOverlay({ debugRef, posRef }: {
  debugRef: React.MutableRefObject<MountedDebugData>;
  posRef: React.RefObject<THREE.Vector3>;
}) {
  const [data, setData] = useState<MountedDebugData & { x: number; z: number }>({
    terrainY: 0, horseY: 0, riderY: 0, delta: 0, pitch: 0, pushX: 0, pushZ: 0, x: 0, z: 0,
  });

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const d = debugRef.current;
      const p = posRef.current;
      setData({ ...d, x: p ? p.x : 0, z: p ? p.z : 0 });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [debugRef, posRef]);

  const deltaColor = Math.abs(data.delta) < 0.01 ? '#0f0' : Math.abs(data.delta) < 0.1 ? '#ff0' : '#f00';

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none font-mono text-xs p-3 rounded-lg"
      style={{ background: 'rgba(0,0,0,0.85)', color: '#0f0', border: '1px solid #333', minWidth: 320 }}>
      <div className="font-bold text-white mb-1">🐴 MOUNTED DEBUG (F3 toggle)</div>
      <div>Pos: X={data.x.toFixed(1)} Z={data.z.toFixed(1)}</div>
      <div>TerrainY: {data.terrainY.toFixed(3)}</div>
      <div>HorseY: {data.horseY.toFixed(3)}</div>
      <div>RiderY: {data.riderY.toFixed(3)}</div>
      <div style={{ color: deltaColor }}>
        GroundDelta: {data.delta.toFixed(4)} {Math.abs(data.delta) < 0.01 ? '✅' : '⚠️'}
      </div>
      <div>SlopePitch: {data.pitch.toFixed(1)}°</div>
      <div>ColPush: X={data.pushX.toFixed(3)} Z={data.pushZ.toFixed(3)}</div>
    </div>
  );
}
