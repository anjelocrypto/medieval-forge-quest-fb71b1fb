import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  NetworkPlayerState, InterpolatedPlayer, ChatMessage, WorldEvent,
  BROADCAST_RATE_MS, STALE_PLAYER_TIMEOUT_MS,
} from './types';
import {
  createRoom as apiCreateRoom,
  joinRoom as apiJoinRoom,
  leaveRoom as apiLeaveRoom,
  heartbeat as apiHeartbeat,
  persistSession, loadSession, clearSession,
  generateRoomCode,
} from './roomApi';

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

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface MultiplayerState {
  connectionStatus: ConnectionStatus;
  connected: boolean;
  roomId: string | null;
  roomCode: string | null;
  playerId: string;
  displayName: string;
  remotePlayers: Map<string, InterpolatedPlayer>;
  chatMessages: ChatMessage[];
  worldEvents: WorldEvent[];
  mockMode: boolean;
}

const HEARTBEAT_INTERVAL_MS = 15_000; // 15s heartbeat

export function useMultiplayer() {
  const playerId = useRef(getOrCreatePlayerId()).current;
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(getDisplayName());
  const [remotePlayers, setRemotePlayers] = useState<Map<string, InterpolatedPlayer>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [worldEvents, setWorldEvents] = useState<WorldEvent[]>([]);
  const [mockMode, setMockMode] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const broadcastTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localStateRef = useRef<NetworkPlayerState | null>(null);
  const staleCleanupRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connected = connectionStatus === 'connected';

  // Update display name
  const updateDisplayName = useCallback((name: string) => {
    const trimmed = name.trim().slice(0, 20) || 'Knight';
    setDisplayName(trimmed);
    sessionStorage.setItem('mp_display_name', trimmed);
  }, []);

  // ===== Internal: subscribe to realtime channel =====
  const subscribeToChannel = useCallback(async (targetRoomCode: string, targetRoomId: string, playerName: string) => {
    // Cleanup any existing channel
    if (channelRef.current) {
      await channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    const channel = supabase.channel(`game_room:${targetRoomCode}`, {
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
            lastUpdateTime: now,
            interpolationT: 0,
            displayName: payload.displayName,
          });
        } else {
          next.set(payload.playerId, {
            playerId: payload.playerId,
            displayName: payload.displayName,
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

    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ playerId, displayName: playerName, joinedAt: Date.now() });
        setConnectionStatus('connected');
        setRoomId(targetRoomId);
        setRoomCode(targetRoomCode);
        channelRef.current = channel;

        setChatMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          playerId: 'system',
          displayName: 'System',
          text: 'You joined the world.',
          timestamp: Date.now(),
          type: 'system',
        }]);
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

    // Heartbeat to DB
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      apiHeartbeat(playerId, targetRoomId).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
  }, [playerId]);

  // ===== Create and join a new room =====
  const createAndJoinRoom = useCallback(async (playerName?: string) => {
    const name = (playerName?.trim() || displayName).slice(0, 20) || 'Knight';
    updateDisplayName(name);
    setConnectionStatus('connecting');

    try {
      const code = generateRoomCode();
      const dbRoomId = await apiCreateRoom(code, playerId, name);
      persistSession({ playerId, displayName: name, roomCode: code, roomId: dbRoomId });
      await subscribeToChannel(code, dbRoomId, name);
    } catch (err: any) {
      console.error('Failed to create room:', err);
      setConnectionStatus('disconnected');
      throw err;
    }
  }, [playerId, displayName, updateDisplayName, subscribeToChannel]);

  // ===== Join existing room by code =====
  const joinRoomByCode = useCallback(async (code: string, playerName?: string) => {
    const name = (playerName?.trim() || displayName).slice(0, 20) || 'Knight';
    updateDisplayName(name);
    setConnectionStatus('connecting');

    try {
      const cleanCode = code.trim().toUpperCase();
      const dbRoomId = await apiJoinRoom(cleanCode, playerId, name);
      persistSession({ playerId, displayName: name, roomCode: cleanCode, roomId: dbRoomId });
      await subscribeToChannel(cleanCode, dbRoomId, name);
    } catch (err: any) {
      console.error('Failed to join room:', err);
      setConnectionStatus('disconnected');
      throw err;
    }
  }, [playerId, displayName, updateDisplayName, subscribeToChannel]);

  // ===== Legacy joinRoom (used by Index.tsx) — routes to create or join =====
  const joinRoom = useCallback(async (roomIdOrCode: string, playerName?: string) => {
    // If it looks like an existing code (uppercase, 4-16 chars), join it, otherwise create
    const clean = roomIdOrCode.trim().toUpperCase();
    if (/^[A-Z0-9]{4,16}$/.test(clean)) {
      try {
        await joinRoomByCode(clean, playerName);
      } catch {
        // Room not found — create with this code
        const name = (playerName?.trim() || displayName).slice(0, 20) || 'Knight';
        updateDisplayName(name);
        setConnectionStatus('connecting');
        try {
          const dbRoomId = await apiCreateRoom(clean, playerId, name);
          persistSession({ playerId, displayName: name, roomCode: clean, roomId: dbRoomId });
          await subscribeToChannel(clean, dbRoomId, name);
        } catch (err2: any) {
          console.error('Failed to create room:', err2);
          setConnectionStatus('disconnected');
          throw err2;
        }
      }
    } else {
      await createAndJoinRoom(playerName);
    }
  }, [joinRoomByCode, createAndJoinRoom, playerId, displayName, updateDisplayName, subscribeToChannel]);

  // ===== Leave room =====
  const leaveRoom = useCallback(async () => {
    if (broadcastTimerRef.current) { clearInterval(broadcastTimerRef.current); broadcastTimerRef.current = null; }
    if (staleCleanupRef.current) { clearInterval(staleCleanupRef.current); staleCleanupRef.current = null; }
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    if (mockIntervalRef.current) { clearInterval(mockIntervalRef.current); mockIntervalRef.current = null; }

    // DB leave
    if (roomId) {
      apiLeaveRoom(playerId, roomId).catch(() => {});
    }

    if (channelRef.current) {
      await channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    clearSession();
    setConnectionStatus('disconnected');
    setRoomId(null);
    setRoomCode(null);
    setRemotePlayers(new Map());
    setChatMessages([]); // FIX: Clear chat on leave
    setWorldEvents([]); // FIX: Clear world events on leave
    setMockMode(false);
  }, [roomId, playerId]);

  // ===== Reconnect on mount if session exists =====
  const hasAttemptedReconnect = useRef(false);
  useEffect(() => {
    if (hasAttemptedReconnect.current) return;
    hasAttemptedReconnect.current = true;

    const session = loadSession();
    // FIX: Clear session if playerId mismatch (different browser session)
    if (!session) return;
    if (session.playerId !== playerId) {
      clearSession();
      return;
    }

    // Check room is still open
    (async () => {
      setConnectionStatus('reconnecting');
      try {
        const { data, error } = await supabase
          .from('game_rooms')
          .select('status')
          .eq('id', session.roomId)
          .single();

        if (error || !data || data.status !== 'open') {
          clearSession();
          setConnectionStatus('disconnected'); // FIX: Reset status on failure
          return;
        }

        const dbRoomId = await apiJoinRoom(session.roomCode, playerId, session.displayName);
        await subscribeToChannel(session.roomCode, dbRoomId, session.displayName);
        updateDisplayName(session.displayName);
      } catch (err) {
        console.warn('Reconnect failed:', err);
        clearSession();
        setConnectionStatus('disconnected'); // FIX: Reset status on failure
      }
    })();
  }, [playerId, subscribeToChannel, updateDisplayName]);

  // ===== Broadcast local player state =====
  const updateLocalState = useCallback((state: NetworkPlayerState) => {
    localStateRef.current = state;
  }, []);

  // ===== Send chat =====
  const sendChat = useCallback((text: string) => {
    if (!channelRef.current || !text.trim()) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      playerId,
      displayName,
      text: text.trim().slice(0, 200),
      timestamp: Date.now(),
      type: 'chat',
    };
    channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg });
    setChatMessages(prev => [...prev.slice(-99), msg]);
  }, [playerId, displayName]);

  // ===== Send emote =====
  const sendEmote = useCallback((emoteKey: string) => {
    if (!channelRef.current) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      playerId,
      displayName,
      text: emoteKey,
      timestamp: Date.now(),
      type: 'emote',
    };
    channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg });
    setChatMessages(prev => [...prev.slice(-99), msg]);
  }, [playerId, displayName]);

  // ===== Broadcast world event =====
  const broadcastWorldEvent = useCallback((event: WorldEvent) => {
    if (!channelRef.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'world_event', payload: event });
    setWorldEvents(prev => [...prev.slice(-49), event]);
  }, []);

  // ===== Mock mode =====
  const enableMockMode = useCallback(() => {
    setMockMode(true);
    setConnectionStatus('connected');
    setRoomId('mock-room');
    setRoomCode('MOCK');

    const mockPlayers = new Map<string, InterpolatedPlayer>();
    for (let i = 0; i < 2; i++) {
      const id = `mock_${i}`;
      const x = 5 + i * 8;
      const z = 50 + i * 5;
      mockPlayers.set(id, {
        playerId: id,
        displayName: i === 0 ? 'Sir Mock' : 'Lady Test',
        prevPosition: [x, 0, z], targetPosition: [x, 0, z],
        prevRotation: 0, targetRotation: 0,
        renderPosition: [x, 0, z], renderRotation: 0,
        moveSpeed: 0, isRunning: false, isMounted: false,
        health: 100, maxHealth: 100, attackAnim: 0, buildMode: false,
        horsePitch: 0, horsePosition: [x + 3, 0, z], horseRotation: 0, horseState: 'idle',
        emote: null, lastUpdateTime: Date.now(), interpolationT: 0,
      });
    }
    setRemotePlayers(mockPlayers);

    if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
    mockIntervalRef.current = setInterval(() => {
      const now = Date.now();
      setRemotePlayers(prev => {
        const next = new Map(prev);
        for (const [id, rp] of next) {
          const t = now / 1000;
          const baseX = id === 'mock_0' ? 5 : 13;
          const baseZ = id === 'mock_0' ? 50 : 55;
          const nx = baseX + Math.sin(t * 0.5 + (id === 'mock_0' ? 0 : 2)) * 10;
          const nz = baseZ + Math.cos(t * 0.3 + (id === 'mock_0' ? 0 : 1)) * 8;
          next.set(id, {
            ...rp,
            prevPosition: [...rp.targetPosition] as [number, number, number],
            targetPosition: [nx, 0, nz],
            prevRotation: rp.targetRotation,
            targetRotation: Math.atan2(nx - rp.targetPosition[0], nz - rp.targetPosition[2]),
            moveSpeed: 6, isRunning: false, lastUpdateTime: now, interpolationT: 0,
          });
        }
        return next;
      });
    }, BROADCAST_RATE_MS);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (broadcastTimerRef.current) clearInterval(broadcastTimerRef.current);
      if (staleCleanupRef.current) clearInterval(staleCleanupRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
      if (channelRef.current) channelRef.current.unsubscribe();
    };
  }, []);

  return {
    playerId,
    connected,
    connectionStatus,
    roomId,
    roomCode,
    displayName,
    updateDisplayName,
    remotePlayers,
    chatMessages,
    worldEvents,
    mockMode,
    joinRoom,
    createAndJoinRoom,
    joinRoomByCode,
    leaveRoom,
    updateLocalState,
    sendChat,
    sendEmote,
    broadcastWorldEvent,
    enableMockMode,
  };
}
