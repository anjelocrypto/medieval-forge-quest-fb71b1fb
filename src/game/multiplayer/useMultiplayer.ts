import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  NetworkPlayerState, InterpolatedPlayer, ChatMessage, WorldEvent,
  BROADCAST_RATE_MS, STALE_PLAYER_TIMEOUT_MS,
} from './types';

// Global world configuration
const GLOBAL_WORLD_KEY = 'global_world_1';
const SESSION_KEY = 'global_world_session';

// ===== Stable player ID per browser session =====
function getOrCreatePlayerId(): string {
  let id = sessionStorage.getItem('mp_player_id');
  if (!id) {
    id = 'p_' + crypto.randomUUID().slice(0, 8);
    sessionStorage.setItem('mp_player_id', id);
  }
  return id;
}

function getDisplayName(): string {
  return sessionStorage.getItem('mp_display_name') || 'Knight';
}

function persistSession(displayName: string) {
  sessionStorage.setItem('mp_display_name', displayName);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ displayName, timestamp: Date.now() }));
}

function loadSession(): { displayName: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface MultiplayerState {
  connectionStatus: ConnectionStatus;
  connected: boolean;
  playerId: string;
  displayName: string;
  remotePlayers: Map<string, InterpolatedPlayer>;
  chatMessages: ChatMessage[];
  worldEvents: WorldEvent[];
}

export function useMultiplayer() {
  const playerId = useRef(getOrCreatePlayerId()).current;
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [displayName, setDisplayName] = useState(getDisplayName());
  const [remotePlayers, setRemotePlayers] = useState<Map<string, InterpolatedPlayer>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [worldEvents, setWorldEvents] = useState<WorldEvent[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const broadcastTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localStateRef = useRef<NetworkPlayerState | null>(null);
  const staleCleanupRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connected = connectionStatus === 'connected';

  // Update display name
  const updateDisplayName = useCallback((name: string) => {
    const trimmed = name.trim().slice(0, 20) || 'Knight';
    setDisplayName(trimmed);
    sessionStorage.setItem('mp_display_name', trimmed);
  }, []);

  // ===== Internal: subscribe to global world channel =====
  const subscribeToGlobalWorld = useCallback(async (playerName: string) => {
    // Cleanup any existing channel
    if (channelRef.current) {
      await channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    const channel = supabase.channel(`world:${GLOBAL_WORLD_KEY}`, {
      config: { broadcast: { self: false }, presence: { key: playerId } },
    });

    // Player state broadcast handler
    channel.on('broadcast', { event: 'player_state' }, ({ payload }: { payload: NetworkPlayerState }) => {
      if (payload.playerId === playerId) return;
      setRemotePlayers(prev => {
        const next = new Map(prev);
        const existing = next.get(payload.playerId);
        const now = Date.now();
        if (existing) {
          next.set(payload.playerId, {
            ...existing,
            prevPosition: [...existing.targetPosition] as [number, number, number],
            targetPosition: payload.position,
            prevRotation: existing.targetRotation,
            targetRotation: payload.rotation,
            moveSpeed: payload.moveSpeed,
            isRunning: payload.isRunning,
            isMounted: payload.isMounted,
            health: payload.health,
            maxHealth: payload.maxHealth,
            attackAnim: payload.attackAnim,
            buildMode: payload.buildMode,
            horsePitch: payload.horsePitch,
            horsePosition: payload.horsePosition,
            horseRotation: payload.horseRotation,
            horseState: payload.horseState,
            emote: payload.emote,
            isSpeaking: payload.isSpeaking,
            lastUpdateTime: now,
            interpolationT: 0,
            displayName: payload.displayName,
            characterType: payload.characterType || 'soldier',
          });
        } else {
          next.set(payload.playerId, {
            playerId: payload.playerId,
            displayName: payload.displayName,
            characterType: payload.characterType || 'soldier',
            prevPosition: payload.position,
            targetPosition: payload.position,
            prevRotation: payload.rotation,
            targetRotation: payload.rotation,
            renderPosition: payload.position,
            renderRotation: payload.rotation,
            moveSpeed: payload.moveSpeed,
            isRunning: payload.isRunning,
            isMounted: payload.isMounted,
            health: payload.health,
            maxHealth: payload.maxHealth,
            attackAnim: payload.attackAnim,
            buildMode: payload.buildMode,
            horsePitch: payload.horsePitch,
            horsePosition: payload.horsePosition,
            horseRotation: payload.horseRotation,
            horseState: payload.horseState,
            emote: payload.emote,
            isSpeaking: payload.isSpeaking,
            lastUpdateTime: now,
            interpolationT: 0,
          });
        }
        return next;
      });
    });

    // Chat messages
    channel.on('broadcast', { event: 'chat' }, ({ payload }: { payload: ChatMessage }) => {
      setChatMessages(prev => [...prev.slice(-99), payload]);
    });

    // World events
    channel.on('broadcast', { event: 'world_event' }, ({ payload }: { payload: WorldEvent }) => {
      setWorldEvents(prev => [...prev.slice(-49), payload]);
    });

    // Presence tracking — leave
    channel.on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
      setRemotePlayers(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      setChatMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        playerId: 'system',
        displayName: 'System',
        text: 'A player has left the world.',
        timestamp: Date.now(),
        type: 'system',
      }]);
    });

    await channel.subscribe(async (status, err) => {
      console.log('[Multiplayer] Channel status:', status, err ? err : '');
      if (status === 'SUBSCRIBED') {
        await channel.track({ playerId, displayName: playerName, joinedAt: Date.now() });
        console.log('[Multiplayer] Connected successfully, status → connected');
        setConnectionStatus('connected');
        channelRef.current = channel;

        setChatMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          playerId: 'system',
          displayName: 'System',
          text: 'You joined the world.',
          timestamp: Date.now(),
          type: 'system',
        }]);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn('[Multiplayer] Channel error/closed:', status, err);
        setConnectionStatus('disconnected');
      }
    });

    // Start broadcast timer
    if (broadcastTimerRef.current) clearInterval(broadcastTimerRef.current);
    broadcastTimerRef.current = setInterval(() => {
      if (localStateRef.current && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'player_state',
          payload: localStateRef.current,
        });
      }
    }, BROADCAST_RATE_MS);

    // Stale player cleanup
    if (staleCleanupRef.current) clearInterval(staleCleanupRef.current);
    staleCleanupRef.current = setInterval(() => {
      const now = Date.now();
      setRemotePlayers(prev => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, rp] of next) {
          if (now - rp.lastUpdateTime > STALE_PLAYER_TIMEOUT_MS) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);
  }, [playerId]);

  // ===== Enter the global world =====
  const enterWorld = useCallback(async (playerName?: string) => {
    const name = (playerName?.trim() || displayName).slice(0, 20) || 'Knight';
    updateDisplayName(name);
    setConnectionStatus('connecting');

    try {
      persistSession(name);
      await subscribeToGlobalWorld(name);
    } catch (err: any) {
      console.error('Failed to enter world:', err);
      setConnectionStatus('disconnected');
      throw err;
    }
  }, [displayName, updateDisplayName, subscribeToGlobalWorld]);

  // ===== Leave world =====
  const leaveWorld = useCallback(async () => {
    if (broadcastTimerRef.current) { clearInterval(broadcastTimerRef.current); broadcastTimerRef.current = null; }
    if (staleCleanupRef.current) { clearInterval(staleCleanupRef.current); staleCleanupRef.current = null; }

    if (channelRef.current) {
      await channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    clearSession();
    setConnectionStatus('disconnected');
    setRemotePlayers(new Map());
    setChatMessages([]);
    setWorldEvents([]);
  }, []);

  // ===== Reconnect on mount if session exists =====
  const hasAttemptedReconnect = useRef(false);
  useEffect(() => {
    if (hasAttemptedReconnect.current) {
      console.log('[Multiplayer] Reconnect skipped — already attempted');
      return;
    }
    hasAttemptedReconnect.current = true;

    const session = loadSession();
    if (!session) {
      console.log('[Multiplayer] No session to restore');
      return;
    }

    // Reconnect directly to global world
    console.log('[Multiplayer] Attempting reconnect for:', session.displayName);
    (async () => {
      setConnectionStatus('reconnecting');
      try {
        updateDisplayName(session.displayName);
        await subscribeToGlobalWorld(session.displayName);
        console.log('[Multiplayer] Reconnect successful');
      } catch (err) {
        console.warn('[Multiplayer] Reconnect failed:', err);
        clearSession();
        setConnectionStatus('disconnected');
      }
    })();
  }, [subscribeToGlobalWorld, updateDisplayName]);

  // ===== Broadcast local player state =====
  const updateLocalState = useCallback((state: NetworkPlayerState) => {
    localStateRef.current = state;
  }, []);

  // ===== Send chat =====
  const sendChat = useCallback((text: string) => {
    if (!channelRef.current || !text.trim()) return;
    const currentDisplayName = sessionStorage.getItem('mp_display_name') || 'Knight';
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      playerId,
      displayName: currentDisplayName,
      text: text.trim().slice(0, 200),
      timestamp: Date.now(),
      type: 'chat',
    };
    channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg });
    setChatMessages(prev => [...prev.slice(-99), msg]);
  }, [playerId]);

  // ===== Send emote =====
  const sendEmote = useCallback((emoteKey: string) => {
    if (!channelRef.current) return;
    const currentDisplayName = sessionStorage.getItem('mp_display_name') || 'Knight';
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      playerId,
      displayName: currentDisplayName,
      text: emoteKey,
      timestamp: Date.now(),
      type: 'emote',
    };
    channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg });
    setChatMessages(prev => [...prev.slice(-99), msg]);
  }, [playerId]);

  // ===== Broadcast world event =====
  const broadcastWorldEvent = useCallback((event: WorldEvent) => {
    if (!channelRef.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'world_event', payload: event });
    setWorldEvents(prev => [...prev.slice(-49), event]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (broadcastTimerRef.current) clearInterval(broadcastTimerRef.current);
      if (staleCleanupRef.current) clearInterval(staleCleanupRef.current);
      if (channelRef.current) channelRef.current.unsubscribe();
    };
  }, []);

  return {
    playerId,
    connected,
    connectionStatus,
    displayName,
    updateDisplayName,
    remotePlayers,
    chatMessages,
    worldEvents,
    enterWorld,
    leaveWorld,
    updateLocalState,
    sendChat,
    sendEmote,
    broadcastWorldEvent,
    channelRef,  // exposed for voice signaling
  };
}
