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

  useFrame((state, delta) => {
    if (!groupRef.current || !bodyRef.current || isDead) return;
    const dt = Math.min(delta, 0.05);
    const pos = groupRef.current.position;
    const vel = velocityRef.current;
    const time = state.clock.elapsedTime;

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
    const isMoving = moveDir.length() > 0;

    if (isMoving) {
      moveDir.normalize();
      vel.x = moveDir.x * speed;
      vel.z = moveDir.z * speed;
      const angle = Math.atan2(moveDir.x, moveDir.z);
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
      const forward = new THREE.Vector3(Math.sin(playerAngle), 0, Math.cos(playerAngle));

      for (const enemy of enemies) {
        if (enemy.state === 'dead') continue;
        const dx = enemy.position[0] - pos.x;
        const dz = enemy.position[2] - pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > PLAYER_ATTACK_RANGE) continue;
        const toEnemy = new THREE.Vector3(dx, 0, dz).normalize();
        if (forward.dot(toEnemy) > Math.cos(PLAYER_ATTACK_ARC)) {
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

  // ── Procedural animation values ──
  const t = animTimeRef.current;
  const ms = moveSpeedRef.current;
  const attackT = attackAnimRef.current;
  const attacking = attackT > 0;

  // Walk cycle
  const legSwing = Math.sin(t) * 0.6 * ms;
  const armSwing = Math.sin(t) * 0.5 * ms;
  const bodyBob = Math.abs(Math.sin(t * 2)) * 0.06 * ms;
  const bodyTilt = Math.sin(t) * 0.03 * ms;
  const shoulderRoll = Math.sin(t) * 0.04 * ms;

  // Attack animation - powerful swing
  const atkPhase = attacking ? (1 - attackT / 0.35) : 0;
  const atkSwing = attacking
    ? (atkPhase < 0.3 ? -0.5 * (atkPhase / 0.3) : -0.5 + (atkPhase - 0.3) * 3.5)
    : 0;
  const atkBodyTwist = attacking ? Math.sin(atkPhase * Math.PI) * 0.15 : 0;

  // Idle breathing
  const idleBob = ms < 0.1 ? Math.sin(Date.now() * 0.002) * 0.015 : 0;

  if (isDead) {
    return (
      <group ref={groupRef}>
        <group rotation={[Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
          {/* Dead body */}
          <mesh castShadow>
            <boxGeometry args={[0.7, 1, 0.35]} />
            <meshLambertMaterial color="#4a3520" />
          </mesh>
          <mesh position={[0, 0.6, 0]} castShadow>
            <boxGeometry args={[0.35, 0.35, 0.35]} />
            <meshLambertMaterial color="#c4a070" />
          </mesh>
        </group>
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      <group ref={bodyRef}>
        {/* Body bob */}
        <group position={[0, bodyBob + idleBob, 0]} rotation={[bodyTilt, atkBodyTwist, shoulderRoll]}>
          {/* ── Torso ── */}
          {/* Lower torso - chainmail */}
          <mesh position={[0, -0.05, 0]} castShadow>
            <boxGeometry args={[0.75, 0.5, 0.4]} />
            <meshLambertMaterial color="#555555" />
          </mesh>
          {/* Upper torso - armor plate */}
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.8, 0.55, 0.42]} />
            <meshLambertMaterial color="#6a6a72" />
          </mesh>
          {/* Chest plate detail */}
          <mesh position={[0, 0.32, 0.22]} castShadow>
            <boxGeometry args={[0.5, 0.35, 0.05]} />
            <meshLambertMaterial color="#7a7a82" />
          </mesh>
          {/* Belt */}
          <mesh position={[0, -0.1, 0]} castShadow>
            <boxGeometry args={[0.82, 0.1, 0.44]} />
            <meshLambertMaterial color="#3a2810" />
          </mesh>
          {/* Belt buckle */}
          <mesh position={[0, -0.1, 0.23]} castShadow>
            <boxGeometry args={[0.1, 0.08, 0.02]} />
            <meshLambertMaterial color="#c4a040" />
          </mesh>

          {/* ── Shoulder pauldrons ── */}
          <mesh position={[-0.48, 0.42, 0]} castShadow>
            <boxGeometry args={[0.22, 0.18, 0.35]} />
            <meshLambertMaterial color="#6a6a72" />
          </mesh>
          <mesh position={[0.48, 0.42, 0]} castShadow>
            <boxGeometry args={[0.22, 0.18, 0.35]} />
            <meshLambertMaterial color="#6a6a72" />
          </mesh>

          {/* ── Head ── */}
          <group position={[0, 0.75, 0]}>
            {/* Neck */}
            <mesh position={[0, -0.12, 0]} castShadow>
              <boxGeometry args={[0.2, 0.1, 0.2]} />
              <meshLambertMaterial color="#c4a070" />
            </mesh>
            {/* Head */}
            <mesh position={[0, 0.08, 0]} castShadow>
              <boxGeometry args={[0.38, 0.4, 0.38]} />
              <meshLambertMaterial color="#c4a070" />
            </mesh>
            {/* Helmet base */}
            <mesh position={[0, 0.15, 0]} castShadow>
              <boxGeometry args={[0.42, 0.3, 0.42]} />
              <meshLambertMaterial color="#5a5a62" />
            </mesh>
            {/* Helmet crest */}
            <mesh position={[0, 0.35, 0]} castShadow>
              <boxGeometry args={[0.08, 0.12, 0.3]} />
              <meshLambertMaterial color="#8b2020" />
            </mesh>
            {/* Visor slit */}
            <mesh position={[0, 0.12, 0.2]} castShadow>
              <boxGeometry args={[0.28, 0.06, 0.06]} />
              <meshLambertMaterial color="#1a1a1a" />
            </mesh>
            {/* Nose guard */}
            <mesh position={[0, 0.08, 0.2]} castShadow>
              <boxGeometry args={[0.04, 0.18, 0.06]} />
              <meshLambertMaterial color="#5a5a62" />
            </mesh>
          </group>

          {/* ── Left Arm (shield side) ── */}
          <group position={[-0.52, 0.15, 0]} rotation={[armSwing, 0, 0]}>
            {/* Upper arm */}
            <mesh position={[0, -0.05, 0]} castShadow>
              <boxGeometry args={[0.2, 0.4, 0.22]} />
              <meshLambertMaterial color="#555555" />
            </mesh>
            {/* Forearm + gauntlet */}
            <mesh position={[0, -0.35, 0]} castShadow>
              <boxGeometry args={[0.18, 0.3, 0.2]} />
              <meshLambertMaterial color="#6a6a72" />
            </mesh>
            {/* Small shield */}
            <mesh position={[-0.05, -0.2, 0.15]} castShadow>
              <boxGeometry args={[0.04, 0.45, 0.35]} />
              <meshLambertMaterial color="#4a3010" />
            </mesh>
            <mesh position={[-0.05, -0.2, 0.15]} castShadow>
              <boxGeometry args={[0.06, 0.15, 0.12]} />
              <meshLambertMaterial color="#8a8a8a" />
            </mesh>
          </group>

          {/* ── Right Arm (sword side) ── */}
          <group position={[0.52, 0.15, 0]} rotation={[-armSwing + atkSwing, 0, 0]}>
            {/* Upper arm */}
            <mesh position={[0, -0.05, 0]} castShadow>
              <boxGeometry args={[0.2, 0.4, 0.22]} />
              <meshLambertMaterial color="#555555" />
            </mesh>
            {/* Forearm + gauntlet */}
            <mesh position={[0, -0.35, 0]} castShadow>
              <boxGeometry args={[0.18, 0.3, 0.2]} />
              <meshLambertMaterial color="#6a6a72" />
            </mesh>
            {/* Hand */}
            <mesh position={[0, -0.52, 0]} castShadow>
              <boxGeometry args={[0.14, 0.1, 0.14]} />
              <meshLambertMaterial color="#c4a070" />
            </mesh>
            {/* Sword */}
            <group position={[0, -0.55, 0.12]}>
              {/* Pommel */}
              <mesh position={[0, 0.05, 0]} castShadow>
                <sphereGeometry args={[0.04, 6, 6]} />
                <meshLambertMaterial color="#6b4f10" />
              </mesh>
              {/* Grip */}
              <mesh position={[0, -0.08, 0]} castShadow>
                <boxGeometry args={[0.06, 0.2, 0.06]} />
                <meshLambertMaterial color="#3a2510" />
              </mesh>
              {/* Crossguard */}
              <mesh position={[0, -0.18, 0]} castShadow>
                <boxGeometry args={[0.22, 0.04, 0.06]} />
                <meshLambertMaterial color="#c4a040" />
              </mesh>
              {/* Blade */}
              <mesh position={[0, -0.55, 0]} castShadow>
                <boxGeometry args={[0.06, 0.7, 0.02]} />
                <meshLambertMaterial color="#c0c0c8" />
              </mesh>
              {/* Blade edge highlight */}
              <mesh position={[0, -0.55, 0.015]} castShadow>
                <boxGeometry args={[0.04, 0.68, 0.005]} />
                <meshLambertMaterial color="#e0e0e8" />
              </mesh>
            </group>
          </group>

          {/* ── Legs ── */}
          {/* Left leg */}
          <group position={[-0.18, -0.5, 0]} rotation={[-legSwing, 0, 0]}>
            {/* Thigh */}
            <mesh position={[0, -0.1, 0]} castShadow>
              <boxGeometry args={[0.24, 0.35, 0.24]} />
              <meshLambertMaterial color="#3a3030" />
            </mesh>
            {/* Shin + boot */}
            <mesh position={[0, -0.4, 0]} castShadow>
              <boxGeometry args={[0.22, 0.3, 0.26]} />
              <meshLambertMaterial color="#4a3520" />
            </mesh>
            {/* Knee guard */}
            <mesh position={[0, -0.25, 0.12]} castShadow>
              <boxGeometry args={[0.14, 0.1, 0.06]} />
              <meshLambertMaterial color="#6a6a72" />
            </mesh>
          </group>
          {/* Right leg */}
          <group position={[0.18, -0.5, 0]} rotation={[legSwing, 0, 0]}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <boxGeometry args={[0.24, 0.35, 0.24]} />
              <meshLambertMaterial color="#3a3030" />
            </mesh>
            <mesh position={[0, -0.4, 0]} castShadow>
              <boxGeometry args={[0.22, 0.3, 0.26]} />
              <meshLambertMaterial color="#4a3520" />
            </mesh>
            <mesh position={[0, -0.25, 0.12]} castShadow>
              <boxGeometry args={[0.14, 0.1, 0.06]} />
              <meshLambertMaterial color="#6a6a72" />
            </mesh>
          </group>

          {/* ── Cape / Cloak ── */}
          <mesh position={[0, 0.1, -0.24]} castShadow>
            <boxGeometry args={[0.65, 0.9, 0.04]} />
            <meshLambertMaterial color="#2a1a0a" />
          </mesh>
        </group>
      </group>
    </group>
  );
}