/**
 * Menu UI overlay with Guest / Create Account / Log In flows.
 * Wallet connection via Phantom is optional — guests play without a DB account.
 */
import { useState, useEffect } from 'react';
import { usePhantomWallet } from '../hooks/usePhantomWallet';
import { usePlayerAccount, loadWalletSession, clearWalletSession } from '../hooks/usePlayerAccount';
import { useCharacter, CharacterType } from '../context/CharacterContext';

interface Props {
  onEnterWorld: (playerName: string) => Promise<void>;
  isReconnecting: boolean;
}

type MenuMode = 'main' | 'create' | 'login';

export function MenuOverlay({ onEnterWorld, isReconnecting }: Props) {
  const [playerName, setPlayerName] = useState('');
  const [communityName, setCommunityName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuMode, setMenuMode] = useState<MenuMode>('main');

  const phantom = usePhantomWallet();
  const playerAccount = usePlayerAccount();
  const { character, setCharacter } = useCharacter();

  // Check for existing wallet session on mount
  const [walletSession, setWalletSession] = useState(() => loadWalletSession());

  // Sync errors from sub-hooks
  useEffect(() => {
    if (phantom.error) setError(phantom.error);
  }, [phantom.error]);
  useEffect(() => {
    if (playerAccount.error) setError(playerAccount.error);
  }, [playerAccount.error]);

  // === GUEST FLOW ===
  const handleGuestPlay = async () => {
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

  // === CREATE ACCOUNT FLOW ===
  const handleCreateAccount = async () => {
    setBusy(true);
    setError(null);

    // 1. Connect Phantom
    const walletAddress = await phantom.connect();
    if (!walletAddress) {
      setBusy(false);
      return;
    }

    // 2. Create DB account
    const name = playerName.trim() || 'Knight';
    const community = communityName.trim() || null;
    const dbCharType = character;

    const account = await playerAccount.createAccount(walletAddress, name, community, dbCharType);
    if (!account) {
      setBusy(false);
      return;
    }

    // 3. Restore character from DB
    setCharacter(account.character_type as CharacterType);

    // 4. Enter world
    try {
      await onEnterWorld(account.display_name);
    } catch (err: any) {
      setError(err.message || 'Failed to enter world');
    } finally {
      setBusy(false);
    }
  };

  // === LOGIN FLOW ===
  const handleLogin = async () => {
    setBusy(true);
    setError(null);

    // 1. Connect Phantom
    const walletAddress = await phantom.connect();
    if (!walletAddress) {
      setBusy(false);
      return;
    }

    // 2. Login via RPC
    const account = await playerAccount.loginAccount(walletAddress);
    if (!account) {
      setBusy(false);
      return;
    }

    // 3. Restore profile data
    setPlayerName(account.display_name);
    setCommunityName(account.community_name || '');
    if (account.character_type === 'goblin' || account.character_type === 'soldier') {
      setCharacter(account.character_type as CharacterType);
    }
    setWalletSession({
      wallet_address: account.wallet_address,
      display_name: account.display_name,
      community_name: account.community_name,
      character_type: account.character_type,
      account_id: account.id,
    });

    // 4. Enter world
    try {
      await onEnterWorld(account.display_name);
    } catch (err: any) {
      setError(err.message || 'Failed to enter world');
    } finally {
      setBusy(false);
    }
  };

  // === CLEAR WALLET SESSION ===
  const handleClearSession = () => {
    clearWalletSession();
    setWalletSession(null);
    phantom.disconnect();
    playerAccount.clearAccount();
    setPlayerName('');
    setCommunityName('');
    setMenuMode('main');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !busy) {
      if (menuMode === 'main') handleGuestPlay();
    }
  };

  const isBusy = busy || phantom.connecting || playerAccount.loading;

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

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#e8d5b7',
  };

  const labelStyle = { color: '#8a9ab5' };

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
      }} />

      <div className="relative w-full max-w-md mx-4 p-8 rounded-2xl pointer-events-auto"
        style={{
          background: 'rgba(10,10,20,0.85)',
          border: '1px solid rgba(232,213,183,0.2)',
          backdropFilter: 'blur(30px)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>

        {/* Title */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2" style={{
            color: '#e8d5b7',
            textShadow: '0 4px 20px rgba(0,0,0,0.8), 0 0 60px rgba(232,213,183,0.2)',
          }}>⚔️</div>
          <h1 className="text-3xl font-bold tracking-widest mb-1" style={{
            color: '#e8d5b7',
            textShadow: '0 2px 15px rgba(0,0,0,0.8)',
            fontFamily: 'Georgia, serif',
          }}>TRENCHERIA</h1>
          <p className="text-xs tracking-[0.3em] uppercase" style={{ color: '#8a9ab5' }}>
            Shared Online World
          </p>
        </div>

        {/* Wallet session indicator */}
        {walletSession && (
          <div className="mb-4 px-4 py-3 rounded-lg flex items-center justify-between" style={{
            background: 'rgba(120,200,120,0.08)',
            border: '1px solid rgba(120,200,120,0.2)',
          }}>
            <div>
              <div className="text-xs font-bold" style={{ color: '#88cc88' }}>
                🔗 Wallet Account
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#8a9ab5' }}>
                {walletSession.display_name}
                {walletSession.community_name && (
                  <span style={{ color: '#666' }}> · {walletSession.community_name}</span>
                )}
              </div>
            </div>
            <button
              onClick={handleClearSession}
              className="text-xs px-2 py-1 rounded"
              style={{ color: '#aa6666', background: 'rgba(170,100,100,0.1)' }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Name input */}
        <div className="mb-3">
          <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={labelStyle}>
            Your Name
          </label>
          <input
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your name..."
            maxLength={20}
            className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all focus:ring-2"
            style={inputStyle}
          />
        </div>

        {/* Community Name — always visible */}
        <div className="mb-5">
          <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={labelStyle}>
            Community Name <span className="font-normal opacity-60">(optional)</span>
          </label>
          <input
            value={communityName}
            onChange={e => setCommunityName(e.target.value)}
            placeholder="Your guild or group..."
            maxLength={30}
            className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all focus:ring-2"
            style={inputStyle}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-xs" style={{
            background: 'rgba(255,60,60,0.1)',
            color: '#ff8888',
            border: '1px solid rgba(255,60,60,0.2)',
          }}>
            {error}
            <button
              onClick={() => { setError(null); playerAccount.setError(null); }}
              className="ml-2 underline opacity-70 hover:opacity-100"
            >
              dismiss
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Play as Guest — primary action */}
          <button
            onClick={handleGuestPlay}
            disabled={isBusy}
            className="w-full py-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            style={{
              background: 'linear-gradient(135deg, #e8a838 0%, #c47f17 100%)',
              color: '#1a1a2e',
              boxShadow: '0 4px 20px rgba(232,168,56,0.3)',
              fontSize: '1rem',
            }}
          >
            {isBusy && menuMode === 'main' ? '⏳ Connecting...' : 'Play as Guest'}
          </button>

          {/* Wallet action row */}
          <div className="flex gap-3">
            <button
              onClick={handleCreateAccount}
              disabled={isBusy}
              className="flex-1 py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background: 'rgba(138,100,200,0.15)',
                color: '#b088e0',
                border: '1px solid rgba(138,100,200,0.3)',
              }}
            >
              {isBusy && menuMode === 'create' ? '⏳...' : 'Create Account'}
            </button>
            <button
              onClick={() => { setMenuMode('login'); handleLogin(); }}
              disabled={isBusy}
              className="flex-1 py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background: 'rgba(100,160,220,0.12)',
                color: '#88bbee',
                border: '1px solid rgba(100,160,220,0.25)',
              }}
            >
              {isBusy && menuMode === 'login' ? '⏳...' : 'Log In'}
            </button>
          </div>
        </div>

        {/* Info text */}
        <p className="text-center text-xs mt-5" style={{ color: '#444' }}>
          Guest — play instantly · Wallet — save your profile
        </p>
        <p className="text-center text-xs mt-1" style={{ color: '#333' }}>
          Requires <a href="https://phantom.app" target="_blank" rel="noopener" style={{ color: '#7768ae' }}>Phantom wallet</a> for account features
        </p>
      </div>
    </div>
  );
}
