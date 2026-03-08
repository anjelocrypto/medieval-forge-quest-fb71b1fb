import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useKeyboard } from '../hooks/useKeyboard';
import { getTerrainHeight } from './Terrain';
import {
  PLAYER_SPEED,
  PLAYER_RUN_SPEED,
  PLAYER_JUMP_FORCE,
  PLAYER_HEIGHT,
  GRAVITY,
  STAMINA_DRAIN,
  STAMINA_REGEN,
  HUNGER_DRAIN,
} from '../constants';
import { SurvivalState } from '../types';

interface PlayerProps {
  onSurvivalUpdate: (updates: Partial<SurvivalState>) => void;
  survival: SurvivalState;
  playerPositionRef: React.MutableRefObject<THREE.Vector3>;
  cameraAzimuthRef: React.MutableRefObject<number>;
}

export function Player({ onSurvivalUpdate, survival, playerPositionRef, cameraAzimuthRef }: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const velocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const isGroundedRef = useRef(true);
  const keys = useKeyboard();
  const animTimeRef = useRef(0);

  // Expose keys for gathering system
  (playerPositionRef as any).keysRef = keys;

  useEffect(() => {
    if (groupRef.current) {
      const startY = getTerrainHeight(0, 0) + PLAYER_HEIGHT / 2;
      groupRef.current.position.set(0, startY, 0);
      playerPositionRef.current.set(0, startY, 0);
    }
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current || !bodyRef.current) return;
    const dt = Math.min(delta, 0.05);
    const pos = groupRef.current.position;
    const vel = velocityRef.current;
    const k = keys.current;

    // Camera-relative movement using azimuth
    const azimuth = cameraAzimuthRef.current;
    const camForward = new THREE.Vector3(-Math.sin(azimuth), 0, -Math.cos(azimuth)).normalize();
    const camRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), camForward).negate().normalize();

    const moveDir = new THREE.Vector3();
    if (k.has('KeyW') || k.has('ArrowUp')) moveDir.add(camForward);
    if (k.has('KeyS') || k.has('ArrowDown')) moveDir.sub(camForward);
    if (k.has('KeyA') || k.has('ArrowLeft')) moveDir.add(camRight);
    if (k.has('KeyD') || k.has('ArrowRight')) moveDir.sub(camRight);

    const isRunning = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = (isRunning && survival.stamina > 0) ? PLAYER_RUN_SPEED : PLAYER_SPEED;

    if (moveDir.length() > 0) {
      moveDir.normalize();
      vel.x = moveDir.x * speed;
      vel.z = moveDir.z * speed;

      const angle = Math.atan2(moveDir.x, moveDir.z);
      bodyRef.current.rotation.y = THREE.MathUtils.lerp(bodyRef.current.rotation.y, angle, dt * 10);
      animTimeRef.current += dt * (isRunning ? 12 : 8);
    } else {
      vel.x *= 0.8;
      vel.z *= 0.8;
    }

    if (k.has('Space') && isGroundedRef.current) {
      vel.y = PLAYER_JUMP_FORCE;
      isGroundedRef.current = false;
    }

    vel.y -= GRAVITY * dt;
    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
    pos.y += vel.y * dt;

    const terrainY = getTerrainHeight(pos.x, pos.z) + PLAYER_HEIGHT / 2;
    if (pos.y <= terrainY) {
      pos.y = terrainY;
      vel.y = 0;
      isGroundedRef.current = true;
    }

    const bound = 230;
    pos.x = THREE.MathUtils.clamp(pos.x, -bound, bound);
    pos.z = THREE.MathUtils.clamp(pos.z, -bound, bound);

    // Sync position ref for camera + interaction
    playerPositionRef.current.copy(pos);

    // Survival
    const isMoving = moveDir.length() > 0;
    const newStamina = isRunning && isMoving
      ? survival.stamina - STAMINA_DRAIN * dt
      : Math.min(100, survival.stamina + STAMINA_REGEN * dt);
    const newHunger = survival.hunger - HUNGER_DRAIN * dt;

    onSurvivalUpdate({
      stamina: newStamina,
      hunger: newHunger,
      health: newHunger <= 0 ? survival.health - dt * 2 : survival.health,
    });
  });

  const armSwing = Math.sin(animTimeRef.current) * 0.4;

  return (
    <group ref={groupRef}>
      <group ref={bodyRef}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <boxGeometry args={[0.7, 0.9, 0.4]} />
          <meshLambertMaterial color="#5a3a1a" />
        </mesh>
        <mesh position={[0, 0.75, 0]} castShadow>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshLambertMaterial color="#d4a574" />
        </mesh>
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[0.45, 0.2, 0.45]} />
          <meshLambertMaterial color="#6a6a6a" />
        </mesh>
        <mesh position={[-0.5, 0.05, 0]} rotation={[armSwing, 0, 0]} castShadow>
          <boxGeometry args={[0.2, 0.7, 0.2]} />
          <meshLambertMaterial color="#5a3a1a" />
        </mesh>
        <mesh position={[0.5, 0.05, 0]} rotation={[-armSwing, 0, 0]} castShadow>
          <boxGeometry args={[0.2, 0.7, 0.2]} />
          <meshLambertMaterial color="#5a3a1a" />
        </mesh>
        <mesh position={[-0.2, -0.65, 0]} rotation={[-armSwing, 0, 0]} castShadow>
          <boxGeometry args={[0.25, 0.6, 0.25]} />
          <meshLambertMaterial color="#3a2a0a" />
        </mesh>
        <mesh position={[0.2, -0.65, 0]} rotation={[armSwing, 0, 0]} castShadow>
          <boxGeometry args={[0.25, 0.6, 0.25]} />
          <meshLambertMaterial color="#3a2a0a" />
        </mesh>
      </group>
    </group>
  );
}
