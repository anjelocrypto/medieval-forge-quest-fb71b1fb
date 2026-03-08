import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTerrainHeight } from './Terrain';
import { getMovementInput } from '../systems/InputSystem';
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
  buildMode: boolean;
}

// Pre-allocated vectors to avoid GC pressure
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _forward = new THREE.Vector3();
const _toEnemy = new THREE.Vector3();

export function Player({
  onSurvivalUpdate, survival, playerPositionRef, playerRotationRef,
  cameraAzimuthRef, enemies, onEnemyHit, onRespawn, buildMode,
}: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const velocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const isGroundedRef = useRef(true);
  const animTimeRef = useRef(0);
  const attackCooldownRef = useRef(0);
  const attackAnimRef = useRef(0);
  const moveSpeedRef = useRef(0);
  const survivalAccumRef = useRef(0);
  const isDead = survival.health <= 0;

  useEffect(() => {
    if (groupRef.current) {
      const startY = getTerrainHeight(0, 0) + PLAYER_HEIGHT / 2;
      groupRef.current.position.set(0, startY, 0);
      playerPositionRef.current.set(0, startY, 0);
    }
  }, []);

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

    _camForward.set(-Math.sin(azimuth), 0, -Math.cos(azimuth));
    _camRight.crossVectors(_up, _camForward).negate();

    _moveDir.set(0, 0, 0);
    if (input.w) _moveDir.add(_camForward);
    if (input.s) _moveDir.sub(_camForward);
    if (input.a) _moveDir.add(_camRight);
    if (input.d) _moveDir.sub(_camRight);

    const canRun = input.run && survival.stamina > 0;
    const speed = canRun ? PLAYER_RUN_SPEED : PLAYER_SPEED;
    const isMoving = _moveDir.lengthSq() > 0.001;

    if (isMoving) {
      _moveDir.normalize();
      vel.x = _moveDir.x * speed;
      vel.z = _moveDir.z * speed;
      const angle = Math.atan2(_moveDir.x, _moveDir.z);
      bodyRef.current.rotation.y = THREE.MathUtils.lerp(bodyRef.current.rotation.y, angle, dt * 10);
      playerRotationRef.current = bodyRef.current.rotation.y;
      animTimeRef.current += dt * (canRun ? 14 : 9);
      moveSpeedRef.current = THREE.MathUtils.lerp(moveSpeedRef.current, canRun ? 1 : 0.6, dt * 8);
    } else {
      vel.x *= 0.8;
      vel.z *= 0.8;
      moveSpeedRef.current = THREE.MathUtils.lerp(moveSpeedRef.current, 0, dt * 6);
    }

    if (input.jump && isGroundedRef.current) {
      vel.y = PLAYER_JUMP_FORCE;
      isGroundedRef.current = false;
    }

    // Attack
    if (!buildMode && input.attack && attackCooldownRef.current <= 0) {
      attackCooldownRef.current = PLAYER_ATTACK_COOLDOWN;
      attackAnimRef.current = 0.35;

      const playerAngle = bodyRef.current.rotation.y;
      _forward.set(Math.sin(playerAngle), 0, Math.cos(playerAngle));
      const cosArc = Math.cos(PLAYER_ATTACK_ARC);

      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (enemy.state === 'dead') continue;
        const dx = enemy.position[0] - pos.x;
        const dz = enemy.position[2] - pos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq > PLAYER_ATTACK_RANGE * PLAYER_ATTACK_RANGE) continue;
        const dist = Math.sqrt(distSq);
        _toEnemy.set(dx / dist, 0, dz / dist);
        if (_forward.dot(_toEnemy) > cosArc) {
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

    // Throttle survival updates to every 5 frames
    survivalAccumRef.current += dt;
    if (survivalAccumRef.current >= 0.1) {
      const elapsed = survivalAccumRef.current;
      survivalAccumRef.current = 0;
      const newStamina = canRun && isMoving
        ? survival.stamina - STAMINA_DRAIN * elapsed
        : Math.min(100, survival.stamina + STAMINA_REGEN * elapsed);
      const newHunger = survival.hunger - HUNGER_DRAIN * elapsed;
      onSurvivalUpdate({
        stamina: newStamina,
        hunger: newHunger,
        health: newHunger <= 0 ? survival.health - elapsed * 2 : survival.health,
      });
    }
  });

  // Procedural animation
  const t = animTimeRef.current;
  const ms = moveSpeedRef.current;
  const attackT = attackAnimRef.current;
  const attacking = attackT > 0;

  const legSwing = Math.sin(t) * 0.6 * ms;
  const armSwing = Math.sin(t) * 0.5 * ms;
  const bodyBob = Math.abs(Math.sin(t * 2)) * 0.06 * ms;
  const bodyTilt = Math.sin(t) * 0.03 * ms;

  const atkPhase = attacking ? (1 - attackT / 0.35) : 0;
  const atkSwing = attacking ? (atkPhase < 0.3 ? -0.5 * (atkPhase / 0.3) : -0.5 + (atkPhase - 0.3) * 3.5) : 0;
  const atkBodyTwist = attacking ? Math.sin(atkPhase * Math.PI) * 0.15 : 0;
  const idleBob = ms < 0.1 ? Math.sin(Date.now() * 0.002) * 0.015 : 0;

  if (isDead) {
    return (
      <group ref={groupRef}>
        <group rotation={[Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.7, 1, 0.35]} />
            <meshLambertMaterial color="#4a3520" />
          </mesh>
        </group>
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      <group ref={bodyRef}>
        <group position={[0, bodyBob + idleBob, 0]} rotation={[bodyTilt, atkBodyTwist, 0]}>
          {/* Torso */}
          <mesh position={[0, -0.05, 0]} castShadow>
            <boxGeometry args={[0.75, 0.5, 0.4]} />
            <meshLambertMaterial color="#555555" />
          </mesh>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.8, 0.55, 0.42]} />
            <meshLambertMaterial color="#6a6a72" />
          </mesh>
          {/* Belt */}
          <mesh position={[0, -0.1, 0]} castShadow>
            <boxGeometry args={[0.82, 0.1, 0.44]} />
            <meshLambertMaterial color="#3a2810" />
          </mesh>
          {/* Pauldrons */}
          <mesh position={[-0.48, 0.42, 0]} castShadow>
            <boxGeometry args={[0.22, 0.18, 0.35]} />
            <meshLambertMaterial color="#6a6a72" />
          </mesh>
          <mesh position={[0.48, 0.42, 0]} castShadow>
            <boxGeometry args={[0.22, 0.18, 0.35]} />
            <meshLambertMaterial color="#6a6a72" />
          </mesh>

          {/* Head + Helmet */}
          <group position={[0, 0.75, 0]}>
            <mesh position={[0, 0.08, 0]} castShadow>
              <boxGeometry args={[0.38, 0.4, 0.38]} />
              <meshLambertMaterial color="#c4a070" />
            </mesh>
            <mesh position={[0, 0.15, 0]} castShadow>
              <boxGeometry args={[0.42, 0.3, 0.42]} />
              <meshLambertMaterial color="#5a5a62" />
            </mesh>
            <mesh position={[0, 0.35, 0]} castShadow>
              <boxGeometry args={[0.08, 0.12, 0.3]} />
              <meshLambertMaterial color="#8b2020" />
            </mesh>
            <mesh position={[0, 0.12, 0.2]} castShadow>
              <boxGeometry args={[0.28, 0.06, 0.06]} />
              <meshLambertMaterial color="#1a1a1a" />
            </mesh>
          </group>

          {/* Left arm + shield */}
          <group position={[-0.52, 0.15, 0]} rotation={[armSwing, 0, 0]}>
            <mesh position={[0, -0.15, 0]} castShadow>
              <boxGeometry args={[0.2, 0.6, 0.22]} />
              <meshLambertMaterial color="#555555" />
            </mesh>
            <mesh position={[-0.05, -0.2, 0.15]} castShadow>
              <boxGeometry args={[0.04, 0.45, 0.35]} />
              <meshLambertMaterial color="#4a3010" />
            </mesh>
          </group>

          {/* Right arm + sword */}
          <group position={[0.52, 0.15, 0]} rotation={[-armSwing + atkSwing, 0, 0]}>
            <mesh position={[0, -0.15, 0]} castShadow>
              <boxGeometry args={[0.2, 0.6, 0.22]} />
              <meshLambertMaterial color="#555555" />
            </mesh>
            {/* Sword */}
            <group position={[0, -0.55, 0.12]}>
              <mesh position={[0, -0.18, 0]} castShadow>
                <boxGeometry args={[0.22, 0.04, 0.06]} />
                <meshLambertMaterial color="#c4a040" />
              </mesh>
              <mesh position={[0, -0.55, 0]} castShadow>
                <boxGeometry args={[0.06, 0.7, 0.02]} />
                <meshLambertMaterial color="#c0c0c8" />
              </mesh>
            </group>
          </group>

          {/* Legs */}
          <group position={[-0.18, -0.5, 0]} rotation={[-legSwing, 0, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <boxGeometry args={[0.24, 0.55, 0.24]} />
              <meshLambertMaterial color="#3a3030" />
            </mesh>
            <mesh position={[0, -0.5, 0]} castShadow>
              <boxGeometry args={[0.22, 0.15, 0.26]} />
              <meshLambertMaterial color="#4a3520" />
            </mesh>
          </group>
          <group position={[0.18, -0.5, 0]} rotation={[legSwing, 0, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <boxGeometry args={[0.24, 0.55, 0.24]} />
              <meshLambertMaterial color="#3a3030" />
            </mesh>
            <mesh position={[0, -0.5, 0]} castShadow>
              <boxGeometry args={[0.22, 0.15, 0.26]} />
              <meshLambertMaterial color="#4a3520" />
            </mesh>
          </group>

          {/* Cape */}
          <mesh position={[0, 0.1, -0.24]} castShadow>
            <boxGeometry args={[0.65, 0.9, 0.04]} />
            <meshLambertMaterial color="#2a1a0a" />
          </mesh>
        </group>
      </group>
    </group>
  );
}