import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { NetworkPlayerState, BROADCAST_RATE_MS } from './types';
import { SurvivalState } from '../types';
import { HorseData } from '../systems/HorseData';

interface Props {
  playerId: string;
  displayName: string;
  playerPositionRef: React.RefObject<THREE.Vector3>;
  playerRotationRef: React.RefObject<number>;
  survival: SurvivalState;
  isMounted: boolean;
  horse: HorseData;
  moveSpeed: number;
  isRunning: boolean;
  attackAnim: number;
  buildMode: boolean;
  horsePitch: number;
  emote: string | null;
  onUpdateLocalState: (state: NetworkPlayerState) => void;
}

/**
 * R3F component that samples local player state every frame
 * and pushes it to the multiplayer hook's local state ref.
 * The actual broadcast is throttled by the hook's interval.
 */
export function MultiplayerBroadcaster({
  playerId, displayName, playerPositionRef, playerRotationRef,
  survival, isMounted, horse, moveSpeed, isRunning, attackAnim,
  buildMode, horsePitch, emote, onUpdateLocalState,
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
      moveSpeed,
      isRunning,
      isMounted,
      health: survival.health,
      maxHealth: 100,
      stamina: survival.stamina,
      hunger: survival.hunger,
      temperature: survival.temperature,
      attackAnim,
      buildMode,
      horsePitch,
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
