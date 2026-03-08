import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTerrainHeight } from './Terrain';
import { getMovementInput, wasMouseJustClicked } from '../systems/InputSystem';
import {
  PLAYER_SPEED, PLAYER_RUN_SPEED, PLAYER_JUMP_FORCE,
  PLAYER_HEIGHT, GRAVITY, STAMINA_DRAIN, STAMINA_REGEN, HUNGER_DRAIN,
} from '../constants';
import { PLAYER_ATTACK_COOLDOWN, PLAYER_ATTACK_RANGE, PLAYER_ATTACK_DAMAGE, PLAYER_ATTACK_ARC } from '../systems/EnemyData';
import { SurvivalState } from '../types';
import { EnemyData } from '../systems/EnemyData';

interface PlayerProps {
  onSurvivalUpdate: (updates: Partial<SurvivalState>) => void;
  survival: SurvivalState;
  playerPositionRef: React.MutableRefObject<THREE.Vector3>;
  playerRotationRef: React.MutableRefObject<number>;
  cameraAzimuthRef: React.MutableRefObject<number>;
  enemies: EnemyData[];
  onEnemyHit: (id: string, damage: number) => void;
  onRespawn: () => void;
}

export function Player({
  onSurvivalUpdate, survival, playerPositionRef, playerRotationRef,
  cameraAzimuthRef, enemies, onEnemyHit, onRespawn,
}: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const velocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const isGroundedRef = useRef(true);
  const animTimeRef = useRef(0);
  const attackCooldownRef = useRef(0);
  const attackAnimRef = useRef(0); // visual swing timer
  const isDead = survival.health <= 0;

  useEffect(() => {
    if (groupRef.current) {
      const startY = getTerrainHeight(0, 0) + PLAYER_HEIGHT / 2;
      groupRef.current.position.set(0, startY, 0);
      playerPositionRef.current.set(0, startY, 0);
    }
  }, []);

  // Respawn on death
  useEffect(() => {
    if (isDead) {
      const timer = setTimeout(() => {
        if (groupRef.current) {
          const y = getTerrainHeight(0, 0) + PLAYER_HEIGHT / 2;
          groupRef.current.position.set(0, y, 0);
          playerPositionRef.current.set(0, y, 0);
          velocityRef.current.set(0, 0, 0);
        }
        onRespawn();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isDead]);

  useFrame((_, delta) => {
    if (!groupRef.current || !bodyRef.current || isDead) return;
    const dt = Math.min(delta, 0.05);
    const pos = groupRef.current.position;
    const vel = velocityRef.current;

    attackCooldownRef.current = Math.max(0, attackCooldownRef.current - dt);
    attackAnimRef.current = Math.max(0, attackAnimRef.current - dt);

    const input = getMovementInput();
    const azimuth = cameraAzimuthRef.current;
    const camForward = new THREE.Vector3(-Math.sin(azimuth), 0, -Math.cos(azimuth)).normalize();
    const camRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), camForward).negate().normalize();

    const moveDir = new THREE.Vector3();
    if (input.w) moveDir.add(camForward);
    if (input.s) moveDir.sub(camForward);
    if (input.a) moveDir.add(camRight);
    if (input.d) moveDir.sub(camRight);

    const canRun = input.run && survival.stamina > 0;
    const speed = canRun ? PLAYER_RUN_SPEED : PLAYER_SPEED;

    if (moveDir.length() > 0) {
      moveDir.normalize();
      vel.x = moveDir.x * speed;
      vel.z = moveDir.z * speed;
      const angle = Math.atan2(moveDir.x, moveDir.z);
      bodyRef.current.rotation.y = THREE.MathUtils.lerp(bodyRef.current.rotation.y, angle, dt * 10);
      playerRotationRef.current = bodyRef.current.rotation.y;
      animTimeRef.current += dt * (canRun ? 12 : 8);
    } else {
      vel.x *= 0.8;
      vel.z *= 0.8;
    }

    if (input.jump && isGroundedRef.current) {
      vel.y = PLAYER_JUMP_FORCE;
      isGroundedRef.current = false;
    }

    // Attack
    if (input.attack && attackCooldownRef.current <= 0) {
      attackCooldownRef.current = PLAYER_ATTACK_COOLDOWN;
      attackAnimRef.current = 0.3;

      // Hit detection — forward cone
      const playerAngle = bodyRef.current.rotation.y;
      const forward = new THREE.Vector3(Math.sin(playerAngle), 0, Math.cos(playerAngle));

      for (const enemy of enemies) {
        if (enemy.state === 'dead') continue;
        const dx = enemy.position[0] - pos.x;
        const dz = enemy.position[2] - pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > PLAYER_ATTACK_RANGE) continue;

        // Check angle
        const toEnemy = new THREE.Vector3(dx, 0, dz).normalize();
        const dot = forward.dot(toEnemy);
        if (dot > Math.cos(PLAYER_ATTACK_ARC)) {
          onEnemyHit(enemy.id, PLAYER_ATTACK_DAMAGE);
        }
      }
    }

    vel.y -= GRAVITY * dt;
    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
    pos.y += vel.y * dt;

    const terrainY = getTerrainHeight(pos.x, pos.z) + PLAYER_HEIGHT / 2;
    if (pos.y <= terrainY) { pos.y = terrainY; vel.y = 0; isGroundedRef.current = true; }

    pos.x = THREE.MathUtils.clamp(pos.x, -230, 230);
    pos.z = THREE.MathUtils.clamp(pos.z, -230, 230);
    playerPositionRef.current.copy(pos);

    // Survival
    const isMoving = moveDir.length() > 0;
    const newStamina = canRun && isMoving
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
  const attackSwing = attackAnimRef.current > 0 ? -1.5 * (attackAnimRef.current / 0.3) : 0;

  if (isDead) {
    return (
      <group ref={groupRef}>
        <group rotation={[Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.7, 0.9, 0.4]} />
            <meshLambertMaterial color="#5a3a1a" />
          </mesh>
        </group>
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      <group ref={bodyRef}>
        {/* Torso */}
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
        {/* Right Arm + Sword */}
        <group position={[0.5, 0.05, 0]} rotation={[-armSwing + attackSwing, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.2, 0.7, 0.2]} />
            <meshLambertMaterial color="#5a3a1a" />
          </mesh>
          {/* Sword */}
          <mesh position={[0, -0.5, 0.15]} castShadow>
            <boxGeometry args={[0.06, 0.7, 0.04]} />
            <meshLambertMaterial color="#aaa" />
          </mesh>
          {/* Hilt */}
          <mesh position={[0, -0.12, 0.15]} castShadow>
            <boxGeometry args={[0.15, 0.06, 0.06]} />
            <meshLambertMaterial color="#6b4f10" />
          </mesh>
        </group>
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
