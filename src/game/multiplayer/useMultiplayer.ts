import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  NetworkPlayerState, InterpolatedPlayer, ChatMessage, WorldEvent,
  BROADCAST_RATE_MS, STALE_PLAYER_TIMEOUT_MS, RoomInfo,
} from './types';

// Generate a stable player ID per browser session
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

export interface MultiplayerState {
  connected: boolean;
  roomId: string | null;
  playerId: string;
  displayName: string;
  remotePlayers: Map<string, InterpolatedPlayer>;
  chatMessages: ChatMessage[];
  worldEvents: WorldEvent[];
  mockMode: boolean;
}

export function useMultiplayer() {
  const playerId = useRef(getOrCreatePlayerId()).current;
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(getDisplayName());
  const [remotePlayers, setRemotePlayers] = useState<Map<string, InterpolatedPlayer>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [worldEvents, setWorldEvents] = useState<WorldEvent[]>([]);
  const [mockMode, setMockMode] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const broadcastTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localStateRef = useRef<NetworkPlayerState | null>(null);
  const staleCleanupRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update display name
  const updateDisplayName = useCallback((name: string) => {
    const trimmed = name.trim().slice(0, 20) || 'Knight';
    setDisplayName(trimmed);
    sessionStorage.setItem('mp_display_name', trimmed);
  }, []);

  // Create or join a room
  const joinRoom = useCallback(async (targetRoomId: string, playerName?: string) => {
    if (channelRef.current) {
      await channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    if (playerName) updateDisplayName(playerName);

    const channel = supabase.channel(`game_room:${targetRoomId}`, {
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
          // New remote player
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

    // World events (building placed, resource depleted, etc.)
    channel.on('broadcast', { event: 'world_event' }, ({ payload }: { payload: WorldEvent }) => {
      setWorldEvents(prev => [...prev.slice(-49), payload]);
    });

    // Presence tracking
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
        text: `A player has left the world.`,
        timestamp: Date.now(),
        type: 'system',
      }]);
    });

    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ playerId, displayName: playerName || displayName, joinedAt: Date.now() });
        setConnected(true);
        setRoomId(targetRoomId);
        channelRef.current = channel;

        // System message
        setChatMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          playerId: 'system',
          displayName: 'System',
          text: `You joined the world.`,
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
  }, [playerId, displayName, updateDisplayName]);

  // Leave room
  const leaveRoom = useCallback(async () => {
    if (broadcastTimerRef.current) { clearInterval(broadcastTimerRef.current); broadcastTimerRef.current = null; }
    if (staleCleanupRef.current) { clearInterval(staleCleanupRef.current); staleCleanupRef.current = null; }
    if (mockIntervalRef.current) { clearInterval(mockIntervalRef.current); mockIntervalRef.current = null; }
    if (channelRef.current) {
      await channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setConnected(false);
    setRoomId(null);
    setRemotePlayers(new Map());
    setMockMode(false);
  }, []);

  // Broadcast local player state (called every frame, throttled by timer)
  const updateLocalState = useCallback((state: NetworkPlayerState) => {
    localStateRef.current = state;
  }, []);

  // Send chat message
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

  // Send emote
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

  // Broadcast world event
  const broadcastWorldEvent = useCallback((event: WorldEvent) => {
    if (!channelRef.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'world_event', payload: event });
    setWorldEvents(prev => [...prev.slice(-49), event]);
  }, []);

  // Mock mode — spawn fake remote players for testing
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enableMockMode = useCallback(() => {
    setMockMode(true);
    setConnected(true);
    setRoomId('mock-room');

    // Spawn 2 mock players
    const mockPlayers = new Map<string, InterpolatedPlayer>();
    for (let i = 0; i < 2; i++) {
      const id = `mock_${i}`;
      const x = 5 + i * 8;
      const z = 50 + i * 5;
      mockPlayers.set(id, {
        playerId: id,
        displayName: i === 0 ? 'Sir Mock' : 'Lady Test',
        prevPosition: [x, 0, z],
        targetPosition: [x, 0, z],
        prevRotation: 0,
        targetRotation: 0,
        renderPosition: [x, 0, z],
        renderRotation: 0,
        moveSpeed: 0,
        isRunning: false,
        isMounted: false,
        health: 100,
        maxHealth: 100,
        attackAnim: 0,
        buildMode: false,
        horsePitch: 0,
        horsePosition: [x + 3, 0, z],
        horseRotation: 0,
        horseState: 'idle',
        emote: null,
        lastUpdateTime: Date.now(),
        interpolationT: 0,
      });
    }
    setRemotePlayers(mockPlayers);

    // Animate mock players
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
            moveSpeed: 6,
            isRunning: false,
            lastUpdateTime: now,
            interpolationT: 0,
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
      if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
      if (channelRef.current) channelRef.current.unsubscribe();
    };
  }, []);

  return {
    playerId,
    connected,
    roomId,
    displayName,
    updateDisplayName,
    remotePlayers,
    chatMessages,
    worldEvents,
    mockMode,
    joinRoom,
    leaveRoom,
    updateLocalState,
    sendChat,
    sendEmote,
    broadcastWorldEvent,
    enableMockMode,
  };
}
