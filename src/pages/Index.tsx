import { useState, useCallback } from 'react';
import { GameScene } from '../game/GameScene';
import { CinematicMenu } from '../game/menu/CinematicMenu';
import { MenuScene3D } from '../game/menu/MenuScene3D';
import { LoadingScreen } from '../game/menu/LoadingScreen';
import { useMultiplayer } from '../game/multiplayer/useMultiplayer';

type AppMode = 'lobby' | 'loading' | 'game';

const Index = () => {
  const [appMode, setAppMode] = useState<AppMode>('lobby');
  const multiplayer = useMultiplayer();

  const handleEnterWorld = useCallback(async (playerName: string) => {
    await multiplayer.enterWorld(playerName);
    setAppMode('loading');
  }, [multiplayer.enterWorld]);

  const handleLoadingReady = useCallback(() => {
    setAppMode('game');
  }, []);

  const handleLeave = useCallback(async () => {
    await multiplayer.leaveWorld();
    setAppMode('lobby');
  }, [multiplayer.leaveWorld]);

  if (appMode === 'lobby') {
    return (
      <CinematicMenu
        onEnterWorld={handleEnterWorld}
        isReconnecting={false}
      />
    );
  }

  if (appMode === 'loading') {
    return (
      <div className="w-screen h-screen relative overflow-hidden">
        {/* Keep the cinematic 3D world as background during loading */}
        <MenuScene3D />
        <LoadingScreen onReady={handleLoadingReady} />
      </div>
    );
  }

  return (
    <GameScene
      multiplayer={multiplayer}
      onLeaveWorld={handleLeave}
    />
  );
};

export default Index;
