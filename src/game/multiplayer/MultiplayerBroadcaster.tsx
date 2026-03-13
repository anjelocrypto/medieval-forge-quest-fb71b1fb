import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { NetworkPlayerState } from './types';
import { SurvivalState } from '../types';
import { HorseData } from '../systems/HorseData';
import { MountedDebugData } from '../components/Player';
import { CharacterType } from '../context/CharacterContext';

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

export function MultiplayerBroadcaster({
  playerId, displayName, characterType, playerPositionRef, playerRotationRef,
  survival, isMounted, horse, moveSpeedRef, isRunningRef, isGroundedRef, attackAnimRef,
  mountedDebugRef, buildMode, emote, isSpeaking, onUpdateLocalState,
}: Props) {

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
      timestamp: Date.now(),
    };
    onUpdateLocalState(state);
  });

  return null;
}
