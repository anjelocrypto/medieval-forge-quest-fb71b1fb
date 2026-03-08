import { useState, useEffect, useCallback } from 'react';
import { MAX_PLAYERS_PER_ROOM } from './types';
import { listOpenRooms, GameRoom } from './roomApi';

interface Props {
  onCreateRoom: (playerName: string) => Promise<void>;
  onJoinByCode: (code: string, playerName: string) => Promise<void>;
  onSinglePlayer: () => void;
  onMockMode: () => void;
  isReconnecting: boolean;
}

export function LobbyScreen({ onCreateRoom, onJoinByCode, onSinglePlayer, onMockMode, isReconnecting }: Props) {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join' | 'create' | 'browse'>('menu');
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const data = await listOpenRooms();
      setRooms(data);
    } catch (err: any) {
      console.warn('Failed to fetch rooms:', err.message);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  // Auto-fetch rooms when browsing
  useEffect(() => {
    if (mode === 'browse') {
      fetchRooms();
      const iv = setInterval(fetchRooms, 5000);
      return () => clearInterval(iv);
    }
  }, [mode, fetchRooms]);

  const handleCreate = async () => {
    const name = playerName.trim() || 'Knight';
    setBusy(true);
    setError(null);
    try {
      await onCreateRoom(name);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (code?: string) => {
    const name = playerName.trim() || 'Knight';
    const targetCode = (code || roomCode).trim().toUpperCase();
    if (!targetCode) return;
    setBusy(true);
    setError(null);
    try {
      await onJoinByCode(targetCode, name);
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
    } finally {
      setBusy(false);
    }
  };

  const freshness = (room: GameRoom) => {
    const ago = Date.now() - new Date(room.last_heartbeat_at).getTime();
    if (ago < 30_000) return '🟢';
    if (ago < 60_000) return '🟡';
    return '🔴';
  };

  if (isReconnecting) {
    return (
      <div className="w-screen h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
        <div className="text-center">
          <div className="text-2xl mb-2" style={{ color: '#e8d5b7' }}>⚔️ Reconnecting...</div>
          <div className="text-sm" style={{ color: '#8a9ab5' }}>Restoring your session</div>
        </div>
      </div>
    );
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#e8d5b7',
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
      <div className="w-full max-w-lg p-8 rounded-xl"
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
            style={inputStyle}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 px-3 py-2 rounded text-xs"
            style={{ background: 'rgba(255,60,60,0.15)', color: '#f88', border: '1px solid rgba(255,60,60,0.3)' }}>
            {error}
          </div>
        )}

        {/* Main Menu */}
        {mode === 'menu' && (
          <div className="space-y-3">
            <button onClick={() => setMode('create')} disabled={busy}
              className="w-full py-3 rounded font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #e8a838 0%, #c47f17 100%)', color: '#1a1a2e' }}>
              🏰 Create World
            </button>
            <button onClick={() => setMode('browse')} disabled={busy}
              className="w-full py-3 rounded font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02]"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#e8d5b7', border: '1px solid rgba(255,255,255,0.2)' }}>
              🌐 Browse Worlds
            </button>
            <button onClick={() => setMode('join')} disabled={busy}
              className="w-full py-3 rounded font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02]"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#e8d5b7', border: '1px solid rgba(255,255,255,0.2)' }}>
              🚪 Join by Code
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

        {/* Create Room */}
        {mode === 'create' && (
          <div className="space-y-3">
            <p className="text-xs" style={{ color: '#8a9ab5' }}>
              Create a new world. A room code will be generated — share it with friends.
            </p>
            <button onClick={handleCreate} disabled={busy}
              className="w-full py-3 rounded font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #4aad4a 0%, #2a7a2a 100%)', color: '#fff' }}>
              {busy ? '⏳ Creating...' : '⚡ Create & Enter'}
            </button>
            <BackButton onClick={() => { setMode('menu'); setError(null); }} />
          </div>
        )}

        {/* Join by Code */}
        {mode === 'join' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: '#8a9ab5' }}>
                Room Code
              </label>
              <input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABCD12"
                maxLength={16}
                className="w-full px-3 py-2 rounded text-sm outline-none uppercase"
                style={inputStyle}
              />
            </div>
            <button onClick={() => handleJoin()} disabled={busy || !roomCode.trim()}
              className="w-full py-3 rounded font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #4a7aad 0%, #2a5a8a 100%)', color: '#fff' }}>
              {busy ? '⏳ Joining...' : '🚪 Join World'}
            </button>
            <BackButton onClick={() => { setMode('menu'); setError(null); }} />
          </div>
        )}

        {/* Browse Rooms */}
        {mode === 'browse' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#8a9ab5' }}>
                Active Worlds
              </span>
              <button onClick={fetchRooms} disabled={loadingRooms}
                className="text-xs px-2 py-1 rounded transition-all"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#8a9ab5' }}>
                {loadingRooms ? '⏳' : '↻ Refresh'}
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 pr-1"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
              {rooms.length === 0 && !loadingRooms && (
                <div className="text-center py-4 text-xs" style={{ color: '#555' }}>
                  No open worlds found. Create one!
                </div>
              )}
              {rooms.map(room => (
                <button key={room.id}
                  onClick={() => handleJoin(room.room_code)}
                  disabled={busy}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-all hover:scale-[1.01] disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-sm">{freshness(room)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate" style={{ color: '#e8d5b7' }}>
                      {room.room_code}
                    </div>
                    <div className="text-xs truncate" style={{ color: '#8a9ab5' }}>
                      Host: {room.host_display_name}
                    </div>
                  </div>
                  <div className="text-xs font-mono" style={{ color: '#8a9ab5' }}>
                    {room.current_player_count}/{room.max_players}
                  </div>
                </button>
              ))}
            </div>

            <BackButton onClick={() => { setMode('menu'); setError(null); }} />
          </div>
        )}

        <p className="text-center text-xs mt-4" style={{ color: '#555' }}>
          Max {MAX_PLAYERS_PER_ROOM} players per world
        </p>
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full py-2 rounded text-xs"
      style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab5' }}>
      ← Back
    </button>
  );
}
