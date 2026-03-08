import { useState } from 'react';
import { MAX_PLAYERS_PER_ROOM } from './types';

interface Props {
  onJoinRoom: (roomId: string, playerName: string) => void;
  onSinglePlayer: () => void;
  onMockMode: () => void;
}

export function LobbyScreen({ onJoinRoom, onSinglePlayer, onMockMode }: Props) {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join' | 'create'>('menu');

  const handleJoin = () => {
    const name = playerName.trim() || 'Knight';
    const room = roomCode.trim() || `room_${Date.now()}`;
    onJoinRoom(room, name);
  };

  const handleCreate = () => {
    const name = playerName.trim() || 'Knight';
    const room = `room_${Date.now().toString(36)}`;
    onJoinRoom(room, name);
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
      <div className="w-full max-w-md p-8 rounded-xl"
        style={{
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)',
        }}>
        {/* Title */}
        <h1 className="text-3xl font-bold text-center mb-1"
          style={{ color: '#e8d5b7', textShadow: '0 2px 8px rgba(0,0,0,0.5)', letterSpacing: 2 }}>
          ⚔️ MEDIEVAL FORGE
        </h1>
        <p className="text-center text-sm mb-6" style={{ color: '#8a9ab5' }}>
          Open World Multiplayer
        </p>

        {/* Player name */}
        <div className="mb-4">
          <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: '#8a9ab5' }}>
            Your Name
          </label>
          <input
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={20}
            className="w-full px-3 py-2 rounded text-sm outline-none"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#e8d5b7',
            }}
          />
        </div>

        {mode === 'menu' && (
          <div className="space-y-3">
            <button onClick={() => setMode('create')}
              className="w-full py-3 rounded font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #e8a838 0%, #c47f17 100%)',
                color: '#1a1a2e',
                border: 'none',
              }}>
              🏰 Create World
            </button>
            <button onClick={() => setMode('join')}
              className="w-full py-3 rounded font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02]"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#e8d5b7',
                border: '1px solid rgba(255,255,255,0.2)',
              }}>
              🚪 Join World
            </button>
            <div className="border-t border-white/10 pt-3 flex gap-2">
              <button onClick={onSinglePlayer}
                className="flex-1 py-2 rounded text-xs uppercase tracking-wider transition-all hover:scale-[1.02]"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab5', border: '1px solid rgba(255,255,255,0.1)' }}>
                Solo Play
              </button>
              <button onClick={onMockMode}
                className="flex-1 py-2 rounded text-xs uppercase tracking-wider transition-all hover:scale-[1.02]"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab5', border: '1px solid rgba(255,255,255,0.1)' }}>
                🧪 Test Mode
              </button>
            </div>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-3">
            <p className="text-xs" style={{ color: '#8a9ab5' }}>
              Create a new world. Share the room code with friends to let them join.
            </p>
            <button onClick={handleCreate}
              className="w-full py-3 rounded font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #4aad4a 0%, #2a7a2a 100%)',
                color: '#fff',
              }}>
              ⚡ Create & Enter
            </button>
            <button onClick={() => setMode('menu')}
              className="w-full py-2 rounded text-xs"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab5' }}>
              ← Back
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: '#8a9ab5' }}>
                Room Code
              </label>
              <input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value)}
                placeholder="Enter room code..."
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#e8d5b7',
                }}
              />
            </div>
            <button onClick={handleJoin} disabled={!roomCode.trim()}
              className="w-full py-3 rounded font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #4a7aad 0%, #2a5a8a 100%)',
                color: '#fff',
              }}>
              🚪 Join World
            </button>
            <button onClick={() => setMode('menu')}
              className="w-full py-2 rounded text-xs"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab5' }}>
              ← Back
            </button>
          </div>
        )}

        <p className="text-center text-xs mt-4" style={{ color: '#555' }}>
          Max {MAX_PLAYERS_PER_ROOM} players per world • Supabase Realtime
        </p>
      </div>
    </div>
  );
}
