/**
 * useTrencheriCoins — Manages $TRENCHERI coin balance and collection.
 * 
 * Server-validated: Each coin claim goes through the claim_trencheri_coin RPC
 * which enforces unique coin IDs and wallet ownership.
 * 
 * Client-trusted: Coin spawn positions are generated locally. A malicious client
 * could fabricate coin IDs. Mitigation: unique constraint prevents double-claims,
 * and rate limiting (max 1 claim per 2s) prevents spam.
 */
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { loadWalletSession } from './usePlayerAccount';

export interface TrencheriCoin {
  id: string;
  position: [number, number, number];
  spawnedAt: number; // Date.now()
  amount: number;
  collected: boolean;
}

const COIN_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ACTIVE_COINS = 30;
const SPAWN_INTERVAL_MS = 15_000; // new coin every 15s
const CLAIM_COOLDOWN_MS = 2000; // 2s between claims
const COLLECTION_RADIUS = 3.0;

export function useTrencheriCoins() {
  const [balance, setBalance] = useState<number | null>(null);
  const [coins, setCoins] = useState<TrencheriCoin[]>([]);
  const lastClaimTimeRef = useRef(0);
  const walletRef = useRef<string | null>(null);
  const spawnTimerRef = useRef(0);
  const coinCounterRef = useRef(0);
  const balanceLoadedRef = useRef(false);

  /** Check if player has wallet session */
  const isWalletConnected = useCallback((): boolean => {
    const session = loadWalletSession();
    walletRef.current = session?.wallet_address ?? null;
    return !!session?.wallet_address;
  }, []);

  /** Load balance from DB */
  const loadBalance = useCallback(async () => {
    const session = loadWalletSession();
    if (!session?.wallet_address) {
      setBalance(null);
      balanceLoadedRef.current = true;
      return;
    }
    walletRef.current = session.wallet_address;
    try {
      const { data, error } = await supabase.rpc('get_trencheri_balance', {
        _wallet_address: session.wallet_address,
      });
      if (!error && typeof data === 'number') {
        setBalance(data);
      } else {
        setBalance(0);
      }
    } catch {
      setBalance(0);
    }
    balanceLoadedRef.current = true;
  }, []);

  /** Claim a coin — server-validated */
  const claimCoin = useCallback(async (coinId: string, amount: number): Promise<boolean> => {
    const now = Date.now();
    if (now - lastClaimTimeRef.current < CLAIM_COOLDOWN_MS) return false;

    const wallet = walletRef.current;
    if (!wallet) return false;

    lastClaimTimeRef.current = now;

    try {
      const { data, error } = await supabase.rpc('claim_trencheri_coin', {
        _wallet_address: wallet,
        _coin_id: coinId,
        _amount: amount,
      });

      if (error) return false;

      const result = data as unknown as { success: boolean; balance?: number; error?: string };
      if (result?.success && typeof result.balance === 'number') {
        setBalance(result.balance);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  /** Try to collect a coin at player position */
  const tryCollectCoin = useCallback(async (
    playerX: number, playerZ: number,
    showNotification: (msg: string) => void,
  ): Promise<string | null> => {
    if (!walletRef.current) {
      // Guest — show message but don't collect
      // Caller handles the guest message
      return null;
    }

    let closestCoin: TrencheriCoin | null = null;
    let closestDist = COLLECTION_RADIUS * COLLECTION_RADIUS;

    for (const coin of coins) {
      if (coin.collected) continue;
      const dx = playerX - coin.position[0];
      const dz = playerZ - coin.position[2];
      const distSq = dx * dx + dz * dz;
      if (distSq < closestDist) {
        closestDist = distSq;
        closestCoin = coin;
      }
    }

    if (!closestCoin) return null;

    const coinId = closestCoin.id;
    const amount = closestCoin.amount;

    // Optimistically mark as collected
    setCoins(prev => prev.map(c => c.id === coinId ? { ...c, collected: true } : c));

    const success = await claimCoin(coinId, amount);
    if (success) {
      showNotification(`+${amount} $TRENCHERI`);
      return coinId;
    } else {
      // Revert if claim failed
      setCoins(prev => prev.map(c => c.id === coinId ? { ...c, collected: false } : c));
      return null;
    }
  }, [coins, claimCoin]);

  /** Check if any coin is near player (for interaction text) */
  const getNearestCoinDistance = useCallback((playerX: number, playerZ: number): number | null => {
    let minDist = Infinity;
    for (const coin of coins) {
      if (coin.collected) continue;
      const dx = playerX - coin.position[0];
      const dz = playerZ - coin.position[2];
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist) minDist = distSq;
    }
    return minDist < COLLECTION_RADIUS * COLLECTION_RADIUS ? Math.sqrt(minDist) : null;
  }, [coins]);

  return {
    balance,
    coins,
    setCoins,
    isWalletConnected,
    loadBalance,
    tryCollectCoin,
    getNearestCoinDistance,
    balanceLoaded: balanceLoadedRef.current,
    COIN_LIFETIME_MS,
    MAX_ACTIVE_COINS,
    SPAWN_INTERVAL_MS,
    COLLECTION_RADIUS,
  };
}
