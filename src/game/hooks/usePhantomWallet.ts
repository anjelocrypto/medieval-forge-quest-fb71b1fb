/**
 * Hook for Phantom wallet connection.
 * Does NOT auto-connect on page load — user must explicitly click Connect.
 */
import { useState, useCallback, useRef } from 'react';

export interface PhantomWallet {
  publicKey: string | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<string | null>;
  disconnect: () => void;
}

function getProvider(): any | null {
  if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
    return (window as any).solana;
  }
  return null;
}

export function usePhantomWallet(): PhantomWallet {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const providerRef = useRef<any>(null);

  const connect = useCallback(async (): Promise<string | null> => {
    setError(null);
    setConnecting(true);

    const provider = getProvider();
    if (!provider) {
      setError('Phantom wallet not found. Please install the Phantom browser extension.');
      setConnecting(false);
      return null;
    }

    try {
      const resp = await provider.connect();
      const walletAddress = resp.publicKey.toString();
      providerRef.current = provider;
      setPublicKey(walletAddress);
      setConnected(true);
      setConnecting(false);
      return walletAddress;
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect Phantom wallet';
      // User rejected = not an error we should show aggressively
      if (err?.code === 4001 || msg.includes('User rejected')) {
        setError('Connection cancelled');
      } else {
        setError(msg);
      }
      setConnecting(false);
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (providerRef.current) {
      try { providerRef.current.disconnect(); } catch {}
      providerRef.current = null;
    }
    setPublicKey(null);
    setConnected(false);
    setError(null);
  }, []);

  return { publicKey, connected, connecting, error, connect, disconnect };
}
