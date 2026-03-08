// ===== Room API — all writes go through RPCs =====
import { supabase } from '@/integrations/supabase/client';

export interface GameRoom {
  id: string;
  room_code: string;
  host_player_id: string;
  host_display_name: string;
  status: string;
  current_player_count: number;
  max_players: number;
  created_at: string;
  updated_at: string;
  last_heartbeat_at: string;
}

/** Generate a random uppercase alphanumeric room code */
export function generateRoomCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for readability
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Fetch open rooms, freshest first */
export async function listOpenRooms(): Promise<GameRoom[]> {
  const { data, error } = await supabase
    .from('game_rooms')
    .select('*')
    .eq('status', 'open')
    .order('last_heartbeat_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as unknown as GameRoom[];
}

/** Create a new room via RPC */
export async function createRoom(
  roomCode: string,
  playerId: string,
  displayName: string,
  maxPlayers = 12,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_game_room', {
    _room_code: roomCode,
    _player_id: playerId,
    _display_name: displayName,
    _max_players: maxPlayers,
  });
  if (error) throw error;
  return data as string; // room uuid
}

/** Join an existing room via RPC */
export async function joinRoom(
  roomCode: string,
  playerId: string,
  displayName: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('join_game_room', {
    _room_code: roomCode,
    _player_id: playerId,
    _display_name: displayName,
  });
  if (error) throw error;
  return data as string; // room uuid
}

/** Leave a room via RPC */
export async function leaveRoom(
  playerId: string,
  roomId: string,
): Promise<void> {
  const { error } = await supabase.rpc('leave_game_room', {
    _player_id: playerId,
    _room_id: roomId,
  });
  if (error) throw error;
}

/** Heartbeat for presence via RPC */
export async function heartbeat(
  playerId: string,
  roomId: string,
): Promise<void> {
  const { error } = await supabase.rpc('heartbeat_room_player', {
    _player_id: playerId,
    _room_id: roomId,
  });
  if (error) console.warn('Heartbeat failed:', error.message);
}

/** Call cleanup_stale_rooms (client-triggered, runs as security definer) */
export async function cleanupStaleRooms(): Promise<void> {
  // This RPC is not granted to anon/authenticated, so we skip it.
  // Cleanup is triggered by heartbeat lifecycle on the server side.
}

// ===== Session persistence for reconnect =====
const SESSION_KEY = 'mp_session';

export interface PersistedSession {
  playerId: string;
  displayName: string;
  roomCode: string;
  roomId: string;
}

export function persistSession(session: PersistedSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
