import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { NetworkPlayerState } from './types';
import { SurvivalState } from '../types';
import { HorseData } from '../systems/HorseData';
import { MountedDebugData } from '../components/Player';

interface Props {
  playerId: string;
  displayName: string;
  playerPositionRef: React.RefObject<THREE.Vector3>;
  playerRotationRef: React.RefObject<number>;
  survival: SurvivalState;
  isMounted: boolean;
  horse: HorseData;
  moveSpeedRef: React.RefObject<number>;
  isRunningRef: React.RefObject<boolean>;
  attackAnimRef: React.RefObject<number>;
  mountedDebugRef: React.RefObject<MountedDebugData>;
  buildMode: boolean;
  emote: string | null;
  isSpeaking: boolean;
  onUpdateLocalState: (state: NetworkPlayerState) => void;
}

/**
 * R3F component that samples local player state every frame
 * and pushes it to the multiplayer hook's local state ref.
 * The actual broadcast is throttled by the hook's interval.
 */
export function MultiplayerBroadcaster({
  playerId, displayName, playerPositionRef, playerRotationRef,
  survival, isMounted, horse, moveSpeedRef, isRunningRef, attackAnimRef,
  mountedDebugRef, buildMode, emote, isSpeaking, onUpdateLocalState,
}: Props) {

  useFrame(() => {
    const pos = playerPositionRef.current;
    const rot = playerRotationRef.current;
    if (!pos) return;

    const state: NetworkPlayerState = {
      playerId,
      displayName,
      position: [pos.x, pos.y, pos.z],
      rotation: rot ?? 0,
      moveSpeed: moveSpeedRef.current ?? 0,
      isRunning: isRunningRef.current ?? false,
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
      timestamp: Date.now(),
    };
    onUpdateLocalState(state);
  });

  return null;
}
