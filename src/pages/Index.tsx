import { useState, useCallback, useEffect } from 'react';
import { GameScene } from '../game/GameScene';
import { CinematicMenu } from '../game/menu/CinematicMenu';
import { useMultiplayer } from '../game/multiplayer/useMultiplayer';

type AppMode = 'lobby' | 'game';

const Index = () => {
  const [appMode, setAppMode] = useState<AppMode>('lobby');
  const multiplayer = useMultiplayer();

  // Auto-reconnect: if multiplayer reconnects successfully, switch to game
  useEffect(() => {
    if (multiplayer.connected && appMode === 'lobby') {
      setAppMode('game');
    }
  }, [multiplayer.connected, appMode]);

  const handleEnterWorld = useCallback(async (playerName: string) => {
    await multiplayer.enterWorld(playerName);
    setAppMode('game');
  }, [multiplayer.enterWorld]);

  const handleLeave = useCallback(async () => {
    await multiplayer.leaveWorld();
    setAppMode('lobby');
  }, [multiplayer.leaveWorld]);

  if (appMode === 'lobby') {
    return (
      <CinematicMenu
        onEnterWorld={handleEnterWorld}
        isReconnecting={multiplayer.connectionStatus === 'reconnecting'}
      />
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
