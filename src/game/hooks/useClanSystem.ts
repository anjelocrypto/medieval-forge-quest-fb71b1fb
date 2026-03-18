/**
 * Hook for clan & territory system — Phase 1 foundation.
 * Handles clan CRUD, membership, territory ownership, and local state.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { loadWalletSession } from './usePlayerAccount';

// ========== Types ==========
export interface ClanInfo {
  id: string;
  name: string;
  color: ClanColor;
  leader_wallet: string;
  member_count: number;
  max_members: number;
  created_at: string;
}

export interface MyClanInfo {
  clan_id: string;
  clan_name: string;
  clan_color: ClanColor;
  role: 'leader' | 'member';
  member_count: number;
  max_members: number;
  leader_wallet: string;
  joined_at: string;
}

export interface TerritoryInfo {
  id: string;
  name: string;
  center_x: number;
  center_z: number;
  radius: number;
  owning_clan_id: string | null;
  owning_clan_name: string | null;
  owning_clan_color: ClanColor | null;
  claimed_at: string | null;
  war_state: 'peaceful' | 'contested' | 'cooldown';
}

export type ClanColor =
  | 'crimson' | 'azure' | 'emerald' | 'gold' | 'violet'
  | 'silver' | 'amber' | 'teal' | 'ivory' | 'obsidian';

// Color hex map for rendering
export const CLAN_COLOR_HEX: Record<ClanColor, string> = {
  crimson:  '#c0392b',
  azure:    '#2980b9',
  emerald:  '#27ae60',
  gold:     '#f39c12',
  violet:   '#8e44ad',
  silver:   '#95a5a6',
  amber:    '#e67e22',
  teal:     '#16a085',
  ivory:    '#ecf0f1',
  obsidian: '#2c3e50',
};

export const CLAN_COLOR_OPTIONS: { value: ClanColor; label: string; hex: string }[] = [
  { value: 'crimson', label: 'Crimson', hex: '#c0392b' },
  { value: 'azure', label: 'Azure', hex: '#2980b9' },
  { value: 'emerald', label: 'Emerald', hex: '#27ae60' },
  { value: 'gold', label: 'Gold', hex: '#f39c12' },
  { value: 'violet', label: 'Violet', hex: '#8e44ad' },
  { value: 'silver', label: 'Silver', hex: '#95a5a6' },
  { value: 'amber', label: 'Amber', hex: '#e67e22' },
  { value: 'teal', label: 'Teal', hex: '#16a085' },
  { value: 'ivory', label: 'Ivory', hex: '#ecf0f1' },
  { value: 'obsidian', label: 'Obsidian', hex: '#2c3e50' },
];

export function useClanSystem() {
  const [myClan, setMyClan] = useState<MyClanInfo | null>(null);
  const [clans, setClans] = useState<ClanInfo[]>([]);
  const [territories, setTerritories] = useState<TerritoryInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  // Load my clan info
  const loadMyClan = useCallback(async () => {
    const session = loadWalletSession();
    if (!session?.wallet_address) { setMyClan(null); return; }
    try {
      const { data } = await supabase.rpc('get_my_clan', {
        _wallet_address: session.wallet_address,
      } as any);
      setMyClan(data as unknown as MyClanInfo | null);
    } catch { /* silent */ }
  }, []);

  // Load all clans
  const loadClans = useCallback(async () => {
    try {
      const { data } = await supabase.rpc('get_clans' as any, { _limit: 50 });
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      setClans(Array.isArray(parsed) ? parsed : []);
    } catch { /* silent */ }
  }, []);

  // Load territories
  const loadTerritories = useCallback(async () => {
    try {
      const { data } = await supabase.rpc('get_territories' as any);
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      setTerritories(Array.isArray(parsed) ? parsed : []);
    } catch { /* silent */ }
  }, []);

  // Initial load
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadMyClan();
    loadClans();
    loadTerritories();
  }, [loadMyClan, loadClans, loadTerritories]);

  // Create clan
  const createClan = useCallback(async (name: string, color: ClanColor): Promise<string | null> => {
    const session = loadWalletSession();
    if (!session?.wallet_address || !session.session_token) {
      setError('Wallet session required');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.rpc('create_clan' as any, {
        _wallet_address: session.wallet_address,
        _session_token: session.session_token,
        _clan_name: name,
        _clan_color: color,
      });
      const result = data as any;
      if (!result?.success) {
        setError(result?.error || 'Failed to create clan');
        setLoading(false);
        return null;
      }
      await loadMyClan();
      await loadClans();
      setLoading(false);
      return result.clan_id;
    } catch (err: any) {
      setError(err.message || 'Failed to create clan');
      setLoading(false);
      return null;
    }
  }, [loadMyClan, loadClans]);

  // Join clan
  const joinClan = useCallback(async (clanId: string): Promise<boolean> => {
    const session = loadWalletSession();
    if (!session?.wallet_address || !session.session_token) {
      setError('Wallet session required');
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.rpc('join_clan' as any, {
        _wallet_address: session.wallet_address,
        _session_token: session.session_token,
        _clan_id: clanId,
      });
      const result = data as any;
      if (!result?.success) {
        setError(result?.error || 'Failed to join clan');
        setLoading(false);
        return false;
      }
      await loadMyClan();
      await loadClans();
      setLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to join clan');
      setLoading(false);
      return false;
    }
  }, [loadMyClan, loadClans]);

  // Leave clan
  const leaveClan = useCallback(async (): Promise<boolean> => {
    const session = loadWalletSession();
    if (!session?.wallet_address || !session.session_token) {
      setError('Wallet session required');
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.rpc('leave_clan' as any, {
        _wallet_address: session.wallet_address,
        _session_token: session.session_token,
      });
      const result = data as any;
      if (!result?.success) {
        setError(result?.error || 'Failed to leave clan');
        setLoading(false);
        return false;
      }
      setMyClan(null);
      await loadClans();
      await loadTerritories();
      setLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to leave clan');
      setLoading(false);
      return false;
    }
  }, [loadClans, loadTerritories]);

  // Claim territory
  const claimTerritory = useCallback(async (
    territoryId: string,
    playerX?: number,
    playerZ?: number,
  ): Promise<boolean> => {
    const session = loadWalletSession();
    if (!session?.wallet_address || !session.session_token) {
      setError('Wallet session required');
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.rpc('claim_territory' as any, {
        _wallet_address: session.wallet_address,
        _session_token: session.session_token,
        _territory_id: territoryId,
        _player_x: playerX ?? null,
        _player_z: playerZ ?? null,
      });
      const result = data as any;
      if (!result?.success) {
        setError(result?.error || 'Failed to claim territory');
        setLoading(false);
        return false;
      }
      await loadTerritories();
      setLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to claim territory');
      setLoading(false);
      return false;
    }
  }, [loadTerritories]);

  // Refresh all
  const refresh = useCallback(async () => {
    await Promise.all([loadMyClan(), loadClans(), loadTerritories()]);
  }, [loadMyClan, loadClans, loadTerritories]);

  return {
    myClan,
    clans,
    territories,
    loading,
    error,
    setError,
    createClan,
    joinClan,
    leaveClan,
    claimTerritory,
    refresh,
    loadTerritories,
  };
}
