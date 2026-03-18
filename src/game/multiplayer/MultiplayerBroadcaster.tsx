import { forwardRef, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { NetworkPlayerState } from './types';
import { SurvivalState } from '../types';
import { HorseData } from '../systems/HorseData';
import { MountedDebugData } from '../components/Player';
import { CharacterType } from '../context/CharacterContext';
import { loadWalletSession } from '../hooks/usePlayerAccount';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  playerId: string;
  displayName: string;
  characterType: CharacterType;
  playerPositionRef: React.RefObject<THREE.Vector3>;
  playerRotationRef: React.RefObject<number>;
  survival: SurvivalState;
  isMounted: boolean;
  horse: HorseData;
  moveSpeedRef: React.RefObject<number>;
  isRunningRef: React.RefObject<boolean>;
  isGroundedRef: React.RefObject<boolean>;
  attackAnimRef: React.RefObject<number>;
  mountedDebugRef: React.RefObject<MountedDebugData>;
  buildMode: boolean;
  emote: string | null;
  isSpeaking: boolean;
  onUpdateLocalState: (state: NetworkPlayerState) => void;
}

export const MultiplayerBroadcaster = forwardRef<THREE.Object3D, Props>(function MultiplayerBroadcaster({
  playerId, displayName, characterType, playerPositionRef, playerRotationRef,
  survival, isMounted, horse, moveSpeedRef, isRunningRef, isGroundedRef, attackAnimRef,
  mountedDebugRef, buildMode, emote, isSpeaking, onUpdateLocalState,
}, _ref) {
  const clanRef = useRef<{ name: string | null; color: string | null }>({ name: null, color: null });

  // Load clan info periodically
  useEffect(() => {
    const loadClan = async () => {
      const session = loadWalletSession();
      if (!session?.wallet_address) {
        clanRef.current = { name: null, color: null };
        return;
      }
      try {
        const { data } = await supabase.rpc('get_my_clan', { _wallet_address: session.wallet_address } as any);
        if (data && typeof data === 'object' && 'clan_name' in (data as any)) {
          const d = data as any;
          clanRef.current = { name: d.clan_name, color: d.clan_color };
        } else {
          clanRef.current = { name: null, color: null };
        }
      } catch { clanRef.current = { name: null, color: null }; }
    };
    loadClan();
    const interval = setInterval(() => { if (!document.hidden) loadClan(); }, 60000); // reduced from 15s to 60s
    return () => clearInterval(interval);
  }, []);

  useFrame(() => {
    const pos = playerPositionRef.current;
    const rot = playerRotationRef.current;
    if (!pos) return;

    const state: NetworkPlayerState = {
      playerId,
      displayName,
      characterType,
      position: [pos.x, pos.y, pos.z],
      rotation: rot ?? 0,
      moveSpeed: moveSpeedRef.current ?? 0,
      isRunning: isRunningRef.current ?? false,
      isGrounded: isGroundedRef.current ?? true,
      isMounted,
      health: survival.health,
      maxHealth: 100,
      stamina: survival.stamina,
      hunger: survival.hunger,
      temperature: survival.temperature,
      attackAnim: attackAnimRef.current ?? 0,
      buildMode,
      horsePitch: mountedDebugRef.current?.pitch ?? 0,
      horsePosition: horse.position,
      horseRotation: horse.rotation,
      horseState: horse.state,
      emote,
      isSpeaking,
      clanName: clanRef.current.name,
      clanColor: clanRef.current.color,
      timestamp: Date.now(),
    };
    onUpdateLocalState(state);
  });

  return null;
});
