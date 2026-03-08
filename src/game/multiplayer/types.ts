// ===== Multiplayer Network Types =====
// All interfaces for Supabase Realtime multiplayer sync

export interface NetworkPlayerState {
  playerId: string;
  displayName: string;
  position: [number, number, number];
  rotation: number;
  moveSpeed: number;
  isRunning: boolean;
  isMounted: boolean;
  health: number;
  maxHealth: number;
  stamina: number;
  hunger: number;
  temperature: number;
  attackAnim: number; // > 0 means swinging
  buildMode: boolean;
  horsePitch: number;
  horsePosition: [number, number, number];
  horseRotation: number;
  horseState: string;
  emote: string | null; // current emote key or null
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  displayName: string;
  text: string;
  timestamp: number;
  type: 'chat' | 'emote' | 'system';
}

export interface WorldEvent {
  type: 'building_placed' | 'building_removed' | 'resource_depleted' | 'loot_collected' | 'enemy_killed' | 'area_secured';
  payload: Record<string, unknown>;
  playerId: string;
  timestamp: number;
}

export interface RoomInfo {
  id: string;
  name: string;
  hostId: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
}

export interface InterpolatedPlayer {
  playerId: string;
  displayName: string;
  // Interpolation buffers
  prevPosition: [number, number, number];
  targetPosition: [number, number, number];
  prevRotation: number;
  targetRotation: number;
  // Current rendered values
  renderPosition: [number, number, number];
  renderRotation: number;
  // State
  moveSpeed: number;
  isRunning: boolean;
  isMounted: boolean;
  health: number;
  maxHealth: number;
  attackAnim: number;
  buildMode: boolean;
  horsePitch: number;
  horsePosition: [number, number, number];
  horseRotation: number;
  horseState: string;
  emote: string | null;
  // Timing
  lastUpdateTime: number;
  interpolationT: number;
}

export const BROADCAST_RATE_MS = 50; // 20 Hz state broadcast
export const INTERPOLATION_DELAY_MS = 100; // smoothing buffer
export const MAX_PLAYERS_PER_ROOM = 12;
export const STALE_PLAYER_TIMEOUT_MS = 8000;

export const EMOTES: Record<string, string> = {
  wave: '👋',
  cheer: '🎉',
  bow: '🙇',
  laugh: '😂',
  angry: '😡',
  point: '👉',
};
