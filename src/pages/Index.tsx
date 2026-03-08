import { useState, useCallback } from 'react';
import { GameScene } from '../game/GameScene';
import { LobbyScreen } from '../game/multiplayer/LobbyScreen';
import { useMultiplayer } from '../game/multiplayer/useMultiplayer';

type AppMode = 'lobby' | 'game';

const Index = () => {
  const [appMode, setAppMode] = useState<AppMode>('lobby');
  const multiplayer = useMultiplayer();

  // Auto-reconnect: if multiplayer reconnects, go to game
  const prevConnected = multiplayer.connected;
  if (prevConnected && appMode === 'lobby' && multiplayer.connectionStatus === 'connected') {
    setAppMode('game');
  }

  const handleCreateRoom = useCallback(async (playerName: string) => {
    await multiplayer.createAndJoinRoom(playerName);
    setAppMode('game');
  }, [multiplayer.createAndJoinRoom]);

  const handleJoinByCode = useCallback(async (code: string, playerName: string) => {
    await multiplayer.joinRoomByCode(code, playerName);
    setAppMode('game');
  }, [multiplayer.joinRoomByCode]);

  const handleSinglePlayer = useCallback(() => {
    setAppMode('game');
  }, []);

  const handleMockMode = useCallback(() => {
    multiplayer.enableMockMode();
    setAppMode('game');
  }, [multiplayer.enableMockMode]);

  const handleLeave = useCallback(async () => {
    await multiplayer.leaveRoom();
    setAppMode('lobby');
  }, [multiplayer.leaveRoom]);

  if (appMode === 'lobby') {
    return (
      <LobbyScreen
        onCreateRoom={handleCreateRoom}
        onJoinByCode={handleJoinByCode}
        onSinglePlayer={handleSinglePlayer}
        onMockMode={handleMockMode}
        isReconnecting={multiplayer.connectionStatus === 'reconnecting'}
      />
    );
  }

  return (
    <GameScene
      multiplayer={multiplayer}
      onLeaveRoom={handleLeave}
    />
  );
};

export default Index;
