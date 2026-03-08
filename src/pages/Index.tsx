import { useState, useCallback, useRef, useEffect } from 'react';
import { GameScene } from '../game/GameScene';
import { LobbyScreen } from '../game/multiplayer/LobbyScreen';
import { useMultiplayer } from '../game/multiplayer/useMultiplayer';

type AppMode = 'lobby' | 'game';

const Index = () => {
  const [appMode, setAppMode] = useState<AppMode>('lobby');
  const multiplayer = useMultiplayer();

  const handleJoinRoom = useCallback(async (roomId: string, playerName: string) => {
    await multiplayer.joinRoom(roomId, playerName);
    setAppMode('game');
  }, [multiplayer.joinRoom]);

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
        onJoinRoom={handleJoinRoom}
        onSinglePlayer={handleSinglePlayer}
        onMockMode={handleMockMode}
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
