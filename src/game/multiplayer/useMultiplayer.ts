import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resetSpawnIndex } from '../systems/SafeSpawn';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  NetworkPlayerState, InterpolatedPlayer, ChatMessage, WorldEvent,
  BROADCAST_RATE_MS, STALE_PLAYER_TIMEOUT_MS,
} from './types';

// Global world configuration
const GLOBAL_WORLD_KEY = 'global_world_1';
const SESSION_KEY = 'global_world_session';

// Single unified timeout for all subscribe paths (fresh + reconnect)
const SUBSCRIBE_TIMEOUT_MS = 10_000;
const REMOTE_PLAYERS_COMMIT_MS = 100;

// ===== MP-Audit rate-limited logger =====
const auditLogCounts: Record<string, number> = {};
const AUDIT_LOG_LIMIT = 5; // only log first N per label per session

function mpAudit(label: string, data?: Record<string, unknown>) {
  const count = auditLogCounts[label] ?? 0;
  if (count >= AUDIT_LOG_LIMIT) return;
  auditLogCounts[label] = count + 1;
  const suffix = data ? ' — ' + JSON.stringify(data) : '';
  console.log(`[MP-Audit] ${label}${suffix}`);
}

// ===== Startup instrumentation =====
interface StartupTimings {
  enterWorldClicked: number;
  connectStart: number;
  channelCreated: number;
  channelSubscribed: number;
  presenceTrackSent: number;
  firstRemoteReceived: number;
  gameplayReady: number;
}

function createTimings(): StartupTimings {
  return {
    enterWorldClicked: 0,
    connectStart: 0,
    channelCreated: 0,
    channelSubscribed: 0,
    presenceTrackSent: 0,
    firstRemoteReceived: 0,
    gameplayReady: 0,
  };
}

function logTiming(label: string, timings: StartupTimings, stage: keyof StartupTimings) {
  const now = Date.now();
  (timings as any)[stage] = now;
  const elapsed = timings.enterWorldClicked > 0 ? now - timings.enterWorldClicked : 0;
  console.log(`[MP-Startup] ${label} — ${elapsed}ms from start`);
}

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
  const [, setRemotePlayersVersion] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [worldEvents, setWorldEvents] = useState<WorldEvent[]>([]);
  const remotePlayersRef = useRef<Map<string, InterpolatedPlayer>>(new Map());
  const remotePlayersCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const broadcastTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localStateRef = useRef<NetworkPlayerState | null>(null);
  const staleCleanupRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timingsRef = useRef<StartupTimings>(createTimings());
  const firstRemoteReceivedRef = useRef(false);
  const initialStateSentRef = useRef(false);

  const connected = connectionStatus === 'connected';

  const scheduleRemotePlayersCommit = useCallback((immediate = false) => {
    if (immediate) {
      if (remotePlayersCommitTimerRef.current) {
        clearTimeout(remotePlayersCommitTimerRef.current);
        remotePlayersCommitTimerRef.current = null;
      }
      setRemotePlayersVersion((v) => v + 1);
      return;
    }

    if (remotePlayersCommitTimerRef.current) return;
    remotePlayersCommitTimerRef.current = setTimeout(() => {
      remotePlayersCommitTimerRef.current = null;
      setRemotePlayersVersion((v) => v + 1);
    }, REMOTE_PLAYERS_COMMIT_MS);
  }, []);

  // Update display name
  const updateDisplayName = useCallback((name: string) => {
    const trimmed = name.trim().slice(0, 20) || 'Knight';
    setDisplayName(trimmed);
    sessionStorage.setItem('mp_display_name', trimmed);
  }, []);

  // ===== Canonical cleanup helper =====
  // One function for ALL cleanup paths: leaveWorld, unmount, timeout, error, reconnect pre-cleanup.
  const fullCleanup = useCallback(async (channel: RealtimeChannel | null) => {
    // 1. Clear timers
    if (broadcastTimerRef.current) { clearInterval(broadcastTimerRef.current); broadcastTimerRef.current = null; }
    if (staleCleanupRef.current) { clearInterval(staleCleanupRef.current); staleCleanupRef.current = null; }
    if (remotePlayersCommitTimerRef.current) {
      clearTimeout(remotePlayersCommitTimerRef.current);
      remotePlayersCommitTimerRef.current = null;
    }
    initialStateSentRef.current = false;

    // 2. Unsubscribe + remove from Supabase SDK registry
    if (channel) {
      try {
        await supabase.removeChannel(channel);
        mpAudit('channel removed from SDK registry');
      } catch (e) {
        console.warn('[MP-Audit] removeChannel error:', e);
      }
    }

    // 3. Null the ref (if it was the active channel)
    if (channelRef.current === channel || channel === null) {
      channelRef.current = null;
    }
  }, []);

  // ===== Internal: subscribe to global world channel =====
  const subscribeToGlobalWorld = useCallback(async (playerName: string): Promise<boolean> => {
    const timings = timingsRef.current;

    mpAudit('subscribeToGlobalWorld start', { playerId });

    // Cleanup any existing channel using canonical helper
    const oldChannel = channelRef.current;
    channelRef.current = null;
    if (oldChannel) {
      mpAudit('cleaning up old channel before new subscribe');
      await fullCleanup(oldChannel);
    }

    remotePlayersRef.current = new Map();
    scheduleRemotePlayersCommit(true);
    initialStateSentRef.current = false;

    logTiming('Channel creating', timings, 'connectStart');

    const channel = supabase.channel(`world:${GLOBAL_WORLD_KEY}`, {
      config: { broadcast: { self: false }, presence: { key: playerId } },
    });

    logTiming('Channel created', timings, 'channelCreated');
    mpAudit('channel created', { topic: `world:${GLOBAL_WORLD_KEY}` });

    // Player state broadcast handler
    channel.on('broadcast', { event: 'player_state' }, ({ payload }: { payload: NetworkPlayerState }) => {
      if (payload.playerId === playerId) return;

      mpAudit('player_state received', {
        from: payload.playerId,
        localId: playerId,
        charType: payload.characterType,
        pos: payload.position,
      });

      // Log first remote player received
      if (!firstRemoteReceivedRef.current) {
        firstRemoteReceivedRef.current = true;
        logTiming('First remote player received', timingsRef.current, 'firstRemoteReceived');
      }

      const players = remotePlayersRef.current;
      const existing = players.get(payload.playerId);
      const now = Date.now();

      if (existing) {
        const requiresImmediateCommit =
          existing.isMounted !== payload.isMounted ||
          existing.characterType !== (payload.characterType || 'goblin') ||
          existing.displayName !== payload.displayName;

        existing.prevPosition = [...existing.targetPosition] as [number, number, number];
        existing.targetPosition = payload.position;
        existing.prevRotation = existing.targetRotation;
        existing.targetRotation = payload.rotation;
        existing.moveSpeed = payload.moveSpeed;
        existing.isRunning = payload.isRunning;
        existing.isGrounded = payload.isGrounded ?? true;
        existing.isMounted = payload.isMounted;
        existing.health = payload.health;
        existing.maxHealth = payload.maxHealth;
        existing.attackAnim = payload.attackAnim;
        existing.buildMode = payload.buildMode;
        existing.horsePitch = payload.horsePitch;
        existing.horsePosition = payload.horsePosition;
        existing.horseRotation = payload.horseRotation;
        existing.horseState = payload.horseState;
        existing.emote = payload.emote;
        existing.isSpeaking = payload.isSpeaking;
        existing.lastUpdateTime = now;
        existing.interpolationT = 0;
        existing.displayName = payload.displayName;
        existing.characterType = payload.characterType || 'goblin';

        scheduleRemotePlayersCommit(requiresImmediateCommit);
      } else {
        players.set(payload.playerId, {
          playerId: payload.playerId,
          displayName: payload.displayName,
          characterType: payload.characterType || 'goblin',
          prevPosition: payload.position,
          targetPosition: payload.position,
          prevRotation: payload.rotation,
          targetRotation: payload.rotation,
          renderPosition: payload.position,
          renderRotation: payload.rotation,
          moveSpeed: payload.moveSpeed,
          isRunning: payload.isRunning,
          isGrounded: payload.isGrounded ?? true,
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
        mpAudit('remotePlayers size after insert', { size: players.size });
        scheduleRemotePlayersCommit(true);
      }
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
      mpAudit('presence leave removed', { key });
      if (remotePlayersRef.current.delete(key)) {
        scheduleRemotePlayersCommit(true);
      }
      setChatMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        playerId: 'system',
        displayName: 'System',
        text: 'A player has left the world.',
        timestamp: Date.now(),
        type: 'system',
      }]);
    });

    // Subscribe with single unified timeout
    return new Promise<boolean>((resolve) => {
      let resolved = false;

      const timeoutId = setTimeout(async () => {
        if (resolved) return;
        resolved = true;
        console.error(`[MP-Startup] SUBSCRIBE TIMEOUT after ${SUBSCRIBE_TIMEOUT_MS}ms — channel never reached SUBSCRIBED`);
        await fullCleanup(channel);
        setConnectionStatus('disconnected');
        resolve(false);
      }, SUBSCRIBE_TIMEOUT_MS);

      channel.subscribe(async (status, err) => {
        console.log('[Multiplayer] Channel status:', status, err ? err : '');
        if (status === 'SUBSCRIBED') {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);

          logTiming('Channel subscribed', timings, 'channelSubscribed');
          mpAudit('channel subscribe success');

          channelRef.current = channel;
          mpAudit('channelRef assigned', { nonNull: true });

          await channel.track({ playerId, displayName: playerName, joinedAt: Date.now() });
          logTiming('Presence track sent', timings, 'presenceTrackSent');

          console.log('[Multiplayer] Connected successfully, status → connected');
          setConnectionStatus('connected');

          // Mark gameplay ready
          logTiming('Gameplay ready', timings, 'gameplayReady');
          const totalMs = timings.gameplayReady - timings.enterWorldClicked;
          console.log(`[MP-Startup] TOTAL STARTUP: ${totalMs}ms`);

          setChatMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            playerId: 'system',
            displayName: 'System',
            text: 'You joined the world.',
            timestamp: Date.now(),
            type: 'system',
          }]);

          if (localStateRef.current && channelRef.current && !initialStateSentRef.current) {
            initialStateSentRef.current = true;
            mpAudit('initial player_state sent on subscribe');
            channelRef.current.send({
              type: 'broadcast',
              event: 'player_state',
              payload: localStateRef.current,
            });
          }

          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          console.warn('[Multiplayer] Channel error/closed:', status, err);
          await fullCleanup(channel);
          setConnectionStatus('disconnected');
          resolve(false);
        }
      });

      // Start broadcast timer (non-blocking — sends only when channelRef is set)
      if (broadcastTimerRef.current) clearInterval(broadcastTimerRef.current);
      broadcastTimerRef.current = setInterval(() => {
        if (localStateRef.current && channelRef.current) {
          mpAudit('player_state send', {
            playerId: localStateRef.current.playerId,
            charType: localStateRef.current.characterType,
            pos: localStateRef.current.position,
          });
          channelRef.current.send({
            type: 'broadcast',
            event: 'player_state',
            payload: localStateRef.current,
          });
        }
      }, BROADCAST_RATE_MS);
      mpAudit('broadcast timer started');

      // Stale player cleanup
      if (staleCleanupRef.current) clearInterval(staleCleanupRef.current);
      staleCleanupRef.current = setInterval(() => {
        const now = Date.now();
        let changed = false;
        for (const [id, rp] of remotePlayersRef.current) {
          if (now - rp.lastUpdateTime > STALE_PLAYER_TIMEOUT_MS) {
            mpAudit('stale cleanup removed', { playerId: id });
            remotePlayersRef.current.delete(id);
            changed = true;
          }
        }
        if (changed) scheduleRemotePlayersCommit(true);
      }, 2000);
    });
  }, [playerId, fullCleanup, scheduleRemotePlayersCommit]);

  // ===== Enter the global world =====
  const enterWorld = useCallback(async (playerName?: string) => {
    const name = (playerName?.trim() || displayName).slice(0, 20) || 'Knight';
    updateDisplayName(name);
    setConnectionStatus('connecting');

    // Reset timings & audit counts
    const timings = createTimings();
    timings.enterWorldClicked = Date.now();
    timingsRef.current = timings;
    firstRemoteReceivedRef.current = false;
    initialStateSentRef.current = false;
    // Reset audit log counts for fresh session
    for (const k of Object.keys(auditLogCounts)) delete auditLogCounts[k];

    resetSpawnIndex(); // Reset multiplayer spawn separation counter
    mpAudit('enterWorld start', { name, playerId });
    logTiming('Enter world clicked', timings, 'enterWorldClicked');

    try {
      persistSession(name);
      const success = await subscribeToGlobalWorld(name);
      if (!success) {
        console.warn('[Multiplayer] Subscribe failed or timed out');
        setConnectionStatus('disconnected');
        clearSession();
        throw new Error('Failed to connect to world — try again');
      }
    } catch (err: any) {
      console.error('Failed to enter world:', err);
      setConnectionStatus('disconnected');
      throw err;
    }
  }, [displayName, updateDisplayName, subscribeToGlobalWorld, playerId]);

  // ===== Leave world (canonical cleanup) =====
  const leaveWorld = useCallback(async () => {
    mpAudit('leaveWorld called');
    const ch = channelRef.current;
    channelRef.current = null;
    await fullCleanup(ch);
    clearSession();
    setConnectionStatus('disconnected');
    remotePlayersRef.current = new Map();
    setRemotePlayersVersion((v) => v + 1);
    setChatMessages([]);
    setWorldEvents([]);
  }, [fullCleanup]);

  // ===== Reconnect on mount — DISABLED =====
  // Auto-reconnect was silently transitioning lobby→game on page load,
  // mounting the heavy 3D Canvas while the channel was still negotiating.
  // This caused WebGL context loss under GPU pressure.
  // Now: always start in lobby. User clicks Enter World explicitly.
  const hasAttemptedReconnect = useRef(false);
  useEffect(() => {
    if (hasAttemptedReconnect.current) return;
    hasAttemptedReconnect.current = true;

    // Clear any stale session so we don't accumulate dead sessions
    const session = loadSession();
    if (session) {
      console.log('[Multiplayer] Found stale session — clearing (auto-reconnect disabled)');
      clearSession();
    }
  }, []);

  // ===== Broadcast local player state =====
  const updateLocalState = useCallback((state: NetworkPlayerState) => {
    localStateRef.current = state;

    if (connected && channelRef.current && !initialStateSentRef.current) {
      initialStateSentRef.current = true;
      mpAudit('initial player_state sent from broadcaster');
      channelRef.current.send({
        type: 'broadcast',
        event: 'player_state',
        payload: state,
      });
    }
  }, [connected]);

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

  // Cleanup on unmount (canonical)
  useEffect(() => {
    return () => {
      // Sync cleanup: clear timers immediately, channel removal is fire-and-forget
      if (broadcastTimerRef.current) { clearInterval(broadcastTimerRef.current); broadcastTimerRef.current = null; }
      if (staleCleanupRef.current) { clearInterval(staleCleanupRef.current); staleCleanupRef.current = null; }
      if (remotePlayersCommitTimerRef.current) {
        clearTimeout(remotePlayersCommitTimerRef.current);
        remotePlayersCommitTimerRef.current = null;
      }
      const ch = channelRef.current;
      channelRef.current = null;
      if (ch) {
        supabase.removeChannel(ch).catch(() => {});
      }
    };
  }, []);

  return {
    playerId,
    connected,
    connectionStatus,
    displayName,
    updateDisplayName,
    remotePlayers: remotePlayersRef.current,
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
