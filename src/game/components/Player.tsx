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
  CAMERA_OFFSET,
  CAMERA_LERP_SPEED,
  STAMINA_DRAIN,
  STAMINA_REGEN,
  HUNGER_DRAIN,
} from '../constants';
import { SurvivalState } from '../types';

interface PlayerProps {
  onSurvivalUpdate: (updates: Partial<SurvivalState>) => void;
  survival: SurvivalState;
  setInteractionText: (t: string | null) => void;
}

export function Player({ onSurvivalUpdate, survival, setInteractionText }: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const velocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const isGroundedRef = useRef(true);
  const { camera } = useThree();
  const keys = useKeyboard();

  // Arm swing animation ref
  const animTimeRef = useRef(0);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(0, getTerrainHeight(0, 0) + PLAYER_HEIGHT / 2, 0);
    }
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current || !bodyRef.current) return;
    const dt = Math.min(delta, 0.05);
    const pos = groupRef.current.position;
    const vel = velocityRef.current;
    const k = keys.current;

    // Movement direction
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    
    // Use camera-relative direction
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);
    cameraDir.y = 0;
    cameraDir.normalize();
    const cameraRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), cameraDir).negate();

    const moveDir = new THREE.Vector3();
    if (k.has('KeyW') || k.has('ArrowUp')) moveDir.add(cameraDir);
    if (k.has('KeyS') || k.has('ArrowDown')) moveDir.sub(cameraDir);
    if (k.has('KeyA') || k.has('ArrowLeft')) moveDir.add(cameraRight);
    if (k.has('KeyD') || k.has('ArrowRight')) moveDir.sub(cameraRight);

    const isRunning = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = (isRunning && survival.stamina > 0) ? PLAYER_RUN_SPEED : PLAYER_SPEED;

    if (moveDir.length() > 0) {
      moveDir.normalize();
      vel.x = moveDir.x * speed;
      vel.z = moveDir.z * speed;
      
      // Face movement direction
      const angle = Math.atan2(moveDir.x, moveDir.z);
      bodyRef.current.rotation.y = THREE.MathUtils.lerp(
        bodyRef.current.rotation.y,
        angle,
        dt * 10
      );
      
      animTimeRef.current += dt * (isRunning ? 12 : 8);
    } else {
      vel.x *= 0.8;
      vel.z *= 0.8;
    }

    // Jump
    if ((k.has('Space')) && isGroundedRef.current) {
      vel.y = PLAYER_JUMP_FORCE;
      isGroundedRef.current = false;
    }

    // Gravity
    vel.y -= GRAVITY * dt;

    // Update position
    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
    pos.y += vel.y * dt;

    // Terrain collision
    const terrainY = getTerrainHeight(pos.x, pos.z) + PLAYER_HEIGHT / 2;
    if (pos.y <= terrainY) {
      pos.y = terrainY;
      vel.y = 0;
      isGroundedRef.current = true;
    }

    // World bounds
    const bound = 230;
    pos.x = THREE.MathUtils.clamp(pos.x, -bound, bound);
    pos.z = THREE.MathUtils.clamp(pos.z, -bound, bound);

    // Camera follow
    const targetCamPos = new THREE.Vector3(
      pos.x + CAMERA_OFFSET.x,
      pos.y + CAMERA_OFFSET.y,
      pos.z + CAMERA_OFFSET.z,
    );
    camera.position.lerp(targetCamPos, CAMERA_LERP_SPEED * dt);
    camera.lookAt(pos.x, pos.y + 1, pos.z);

    // Survival updates
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
        {/* Body / Torso */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <boxGeometry args={[0.7, 0.9, 0.4]} />
          <meshLambertMaterial color="#5a3a1a" />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.75, 0]} castShadow>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshLambertMaterial color="#d4a574" />
        </mesh>
        {/* Helmet */}
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[0.45, 0.2, 0.45]} />
          <meshLambertMaterial color="#6a6a6a" />
        </mesh>
        {/* Left Arm */}
        <mesh position={[-0.5, 0.05, 0]} rotation={[armSwing, 0, 0]} castShadow>
          <boxGeometry args={[0.2, 0.7, 0.2]} />
          <meshLambertMaterial color="#5a3a1a" />
        </mesh>
        {/* Right Arm */}
        <mesh position={[0.5, 0.05, 0]} rotation={[-armSwing, 0, 0]} castShadow>
          <boxGeometry args={[0.2, 0.7, 0.2]} />
          <meshLambertMaterial color="#5a3a1a" />
        </mesh>
        {/* Left Leg */}
        <mesh position={[-0.2, -0.65, 0]} rotation={[-armSwing, 0, 0]} castShadow>
          <boxGeometry args={[0.25, 0.6, 0.25]} />
          <meshLambertMaterial color="#3a2a0a" />
        </mesh>
        {/* Right Leg */}
        <mesh position={[0.2, -0.65, 0]} rotation={[armSwing, 0, 0]} castShadow>
          <boxGeometry args={[0.25, 0.6, 0.25]} />
          <meshLambertMaterial color="#3a2a0a" />
        </mesh>
      </group>
    </group>
  );
}
