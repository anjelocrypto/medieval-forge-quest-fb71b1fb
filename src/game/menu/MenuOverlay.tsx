/**
 * Menu UI overlay for the single global world.
 * Premium medieval-styled main menu with simplified entry flow.
 */
import { useState } from 'react';

interface Props {
  onEnterWorld: (playerName: string) => Promise<void>;
  isReconnecting: boolean;
}

export function MenuOverlay({ onEnterWorld, isReconnecting }: Props) {
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleEnterWorld = async () => {
    const name = playerName.trim() || 'Knight';
    setBusy(true);
    setError(null);
    try {
      await onEnterWorld(name);
    } catch (err: any) {
      setError(err.message || 'Failed to enter world');
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !busy) {
      handleEnterWorld();
    }
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
          <div className="text-sm" style={{ color: '#8a9ab5' }}>Returning to the world</div>
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
            Shared Online World
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
            onKeyDown={handleKeyDown}
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

        {/* Enter World button */}
        <button
          onClick={handleEnterWorld}
          disabled={busy}
          className="w-full py-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          style={{
            background: 'linear-gradient(135deg, #e8a838 0%, #c47f17 100%)',
            color: '#1a1a2e',
            boxShadow: '0 4px 20px rgba(232,168,56,0.3)',
            fontSize: '1rem',
          }}
        >
          {busy ? '⏳ Connecting...' : '🌍 Enter World'}
        </button>

        {/* Subtle info text */}
        <p className="text-center text-xs mt-6" style={{ color: '#555' }}>
          All players enter the same persistent realm
        </p>
      </div>
    </div>
  );
}
