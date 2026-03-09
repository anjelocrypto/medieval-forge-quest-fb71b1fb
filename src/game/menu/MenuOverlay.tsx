/**
 * Menu UI overlay that sits on top of the 3D cinematic scene.
 * Premium medieval-styled main menu with all existing functionality.
 */
import { useState, useEffect, useCallback } from 'react';
import { MAX_PLAYERS_PER_ROOM } from '../multiplayer/types';
import { listOpenRooms, GameRoom } from '../multiplayer/roomApi';

interface Props {
  onCreateRoom: (playerName: string) => Promise<void>;
  onJoinByCode: (code: string, playerName: string) => Promise<void>;
  onSinglePlayer: () => void;
  onMockMode: () => void;
  isReconnecting: boolean;
}

export function MenuOverlay({ onCreateRoom, onJoinByCode, onSinglePlayer, onMockMode, isReconnecting }: Props) {
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
      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <div className="text-center p-8 rounded-2xl" style={{
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div className="text-3xl mb-3" style={{ color: '#e8d5b7' }}>⚔️</div>
          <div className="text-xl font-bold mb-2" style={{ color: '#e8d5b7' }}>Reconnecting...</div>
          <div className="text-sm" style={{ color: '#8a9ab5' }}>Restoring your session</div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      {/* Dark cinematic overlay for readability */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
      }} />
      
      {/* Menu panel */}
      <div className="relative w-full max-w-md mx-4 p-8 rounded-2xl pointer-events-auto"
        style={{
          background: 'rgba(10,10,20,0.85)',
          border: '1px solid rgba(232,213,183,0.2)',
          backdropFilter: 'blur(30px)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
        
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-2" style={{ 
            color: '#e8d5b7', 
            textShadow: '0 4px 20px rgba(0,0,0,0.8), 0 0 60px rgba(232,213,183,0.2)',
            letterSpacing: '0.15em',
            fontWeight: 700,
          }}>
            ⚔️
          </div>
          <h1 className="text-3xl font-bold tracking-widest mb-1" style={{
            color: '#e8d5b7',
            textShadow: '0 2px 15px rgba(0,0,0,0.8)',
            fontFamily: 'Georgia, serif',
          }}>
            MEDIEVAL FORGE
          </h1>
          <p className="text-xs tracking-[0.3em] uppercase" style={{ color: '#8a9ab5' }}>
            Open World Adventure
          </p>
        </div>

        {/* Player name input */}
        <div className="mb-5">
          <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#8a9ab5' }}>
            Your Name
          </label>
          <input
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={20}
            className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all focus:ring-2"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#e8d5b7',
            }}
          />
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-xs"
            style={{ 
              background: 'rgba(255,60,60,0.1)', 
              color: '#ff8888', 
              border: '1px solid rgba(255,60,60,0.2)' 
            }}>
            {error}
          </div>
        )}

        {/* Main Menu */}
        {mode === 'menu' && (
          <div className="space-y-3">
            <MenuButton onClick={() => setMode('create')} disabled={busy} variant="primary">
              🏰 Create World
            </MenuButton>
            <MenuButton onClick={() => setMode('browse')} disabled={busy}>
              🌐 Browse Worlds
            </MenuButton>
            <MenuButton onClick={() => setMode('join')} disabled={busy}>
              🚪 Join by Code
            </MenuButton>
            <div className="border-t border-white/10 pt-4 mt-4 flex gap-3">
              <MenuButton onClick={onSinglePlayer} variant="subtle" className="flex-1">
                Solo Play
              </MenuButton>
              <MenuButton onClick={onMockMode} variant="subtle" className="flex-1">
                🧪 Test
              </MenuButton>
            </div>
          </div>
        )}

        {/* Create Room */}
        {mode === 'create' && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: '#8a9ab5' }}>
              Create a new world. A room code will be generated for friends to join.
            </p>
            <MenuButton onClick={handleCreate} disabled={busy} variant="success">
              {busy ? '⏳ Creating...' : '⚡ Create & Enter'}
            </MenuButton>
            <MenuButton onClick={() => { setMode('menu'); setError(null); }} variant="ghost">
              ← Back
            </MenuButton>
          </div>
        )}

        {/* Join by Code */}
        {mode === 'join' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#8a9ab5' }}>
                Room Code
              </label>
              <input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABCD12"
                maxLength={16}
                className="w-full px-4 py-3 rounded-lg text-sm outline-none uppercase tracking-widest text-center font-mono"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e8d5b7',
                  fontSize: '1.1rem',
                }}
              />
            </div>
            <MenuButton onClick={() => handleJoin()} disabled={busy || !roomCode.trim()} variant="primary">
              {busy ? '⏳ Joining...' : '🚪 Join World'}
            </MenuButton>
            <MenuButton onClick={() => { setMode('menu'); setError(null); }} variant="ghost">
              ← Back
            </MenuButton>
          </div>
        )}

        {/* Browse Rooms */}
        {mode === 'browse' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#8a9ab5' }}>
                Active Worlds
              </span>
              <button onClick={fetchRooms} disabled={loadingRooms}
                className="text-xs px-3 py-1 rounded-lg transition-all hover:scale-105"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#8a9ab5' }}>
                {loadingRooms ? '⏳' : '↻ Refresh'}
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-2 pr-1"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
              {rooms.length === 0 && !loadingRooms && (
                <div className="text-center py-6 text-sm" style={{ color: '#555' }}>
                  No open worlds found. Create one!
                </div>
              )}
              {rooms.map(room => (
                <button key={room.id}
                  onClick={() => handleJoin(room.room_code)}
                  disabled={busy}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all hover:scale-[1.01] disabled:opacity-50"
                  style={{ 
                    background: 'rgba(255,255,255,0.05)', 
                    border: '1px solid rgba(255,255,255,0.08)' 
                  }}>
                  <span className="text-lg">{freshness(room)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: '#e8d5b7' }}>
                      {room.room_code}
                    </div>
                    <div className="text-xs truncate" style={{ color: '#8a9ab5' }}>
                      Host: {room.host_display_name}
                    </div>
                  </div>
                  <div className="text-sm font-mono" style={{ color: '#8a9ab5' }}>
                    {room.current_player_count}/{room.max_players}
                  </div>
                </button>
              ))}
            </div>

            <MenuButton onClick={() => { setMode('menu'); setError(null); }} variant="ghost">
              ← Back
            </MenuButton>
          </div>
        )}

        <p className="text-center text-xs mt-6" style={{ color: '#444' }}>
          Max {MAX_PLAYERS_PER_ROOM} players per world
        </p>
      </div>
    </div>
  );
}

// Reusable styled button component
interface MenuButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'success' | 'subtle' | 'ghost';
  className?: string;
  children: React.ReactNode;
}

function MenuButton({ onClick, disabled, variant = 'default', className = '', children }: MenuButtonProps) {
  const baseStyles = "w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100";
  
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg, #e8a838 0%, #c47f17 100%)',
      color: '#1a1a2e',
      boxShadow: '0 4px 20px rgba(232,168,56,0.3)',
    },
    success: {
      background: 'linear-gradient(135deg, #4aad4a 0%, #2a7a2a 100%)',
      color: '#fff',
      boxShadow: '0 4px 20px rgba(74,173,74,0.3)',
    },
    subtle: {
      background: 'rgba(255,255,255,0.05)',
      color: '#8a9ab5',
      border: '1px solid rgba(255,255,255,0.08)',
    },
    ghost: {
      background: 'transparent',
      color: '#8a9ab5',
    },
    default: {
      background: 'rgba(255,255,255,0.08)',
      color: '#e8d5b7',
      border: '1px solid rgba(255,255,255,0.15)',
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${className}`}
      style={variantStyles[variant] || variantStyles.default}
    >
      {children}
    </button>
  );
}
