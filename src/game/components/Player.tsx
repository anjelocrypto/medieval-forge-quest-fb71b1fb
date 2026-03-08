import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTerrainHeight } from './Terrain';
import { getMovementInput } from '../systems/InputSystem';
import {
  PLAYER_SPEED, PLAYER_RUN_SPEED, PLAYER_JUMP_FORCE,
  PLAYER_HEIGHT, GRAVITY, STAMINA_DRAIN, STAMINA_REGEN, HUNGER_DRAIN,
  TEMPERATURE_DRAIN, CAMPFIRE_WARMTH_RANGE, CAMPFIRE_WARMTH_RATE,
  SHELTER_EFFECT_RANGE, SHELTER_HUNGER_REDUCTION, SHELTER_STAMINA_BONUS,
  LOW_HUNGER_THRESHOLD, LOW_TEMP_THRESHOLD, COLD_DAMAGE_RATE,
  POIS, POI_ZONE_RADIUS,
} from '../constants';
import { PLAYER_ATTACK_COOLDOWN, PLAYER_ATTACK_RANGE, PLAYER_ATTACK_DAMAGE, PLAYER_ATTACK_ARC } from '../systems/EnemyData';
import { SurvivalState, LootPickup } from '../types';
import { EnemyData } from '../systems/EnemyData';
import { PlacedStructure } from '../systems/BuildingData';
import { HorseData, HORSE_SPEED, HORSE_RUN_SPEED, MOUNT_RANGE, DISMOUNT_OFFSET } from '../systems/HorseData';
import { resolveCollision, rebuildObstacles } from '../systems/CollisionSystem';
import { WorldResource } from '../systems/WorldResources';

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
  structures: PlacedStructure[];
  lootPickups: LootPickup[];
  onCollectLoot: (id: string) => void;
  onEatFood: () => void;
  horses: HorseData[];
  onMountHorse: (id: string) => void;
  onDismountHorse: () => void;
  mountedHorseId: string | null;
  onSetInteractionText: (text: string | null) => void;
  resources: WorldResource[];
}

const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _forward = new THREE.Vector3();
const _toEnemy = new THREE.Vector3();

// Movement feel constants
const ACCEL_GROUND = 35;
const ACCEL_GROUND_RUN = 40;
const DECEL_GROUND = 18;
const ACCEL_MOUNTED = 14; // slower acceleration = heavier feel
const DECEL_MOUNTED = 6; // slower decel = momentum
const TURN_SPEED_FOOT = 12;
const TURN_SPEED_MOUNTED = 3.5; // much wider turning arc
const HORSE_TURN_SPEED_STANDING = 5; // faster turn when slow/standing
const PLAYER_RADIUS = 0.4;
const MOUNTED_RADIUS = 1.0; // larger collision footprint when riding

export function Player({
  onSurvivalUpdate, survival, playerPositionRef, playerRotationRef,
  cameraAzimuthRef, enemies, onEnemyHit, onRespawn, buildMode,
  structures, lootPickups, onCollectLoot, onEatFood,
  horses, onMountHorse, onDismountHorse, mountedHorseId, onSetInteractionText,
  resources,
}: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const velocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const isGroundedRef = useRef(true);
  const animTimeRef = useRef(0);
  const attackCooldownRef = useRef(0);
  const attackAnimRef = useRef(0);
  const comboRef = useRef(0); // 0 = no combo, 1 = first swing done, can chain
  const comboWindowRef = useRef(0);
  const moveSpeedRef = useRef(0);
  const currentSpeedRef = useRef(0); // actual interpolated speed for acceleration feel
  const survivalAccumRef = useRef(0);
  const lootCheckRef = useRef(0);
  
  const landingImpactRef = useRef(0);
  const wasInAirRef = useRef(false);
  const targetRotRef = useRef(0);
  const leanRef = useRef(0); // lateral lean
  const hipSwayRef = useRef(0);
  const idleShiftRef = useRef(0);
  const collisionRebuildTimer = useRef(0);
  const horseRotRef = useRef(0); // horse's own facing for smooth turning
  const isDead = survival.health <= 0;
  const isMounted = mountedHorseId !== null;

  useEffect(() => {
    if (groupRef.current) {
      const startY = getTerrainHeight(0, 0) + PLAYER_HEIGHT / 2;
      groupRef.current.position.set(0, startY, 0);
      playerPositionRef.current.set(0, startY, 0);
    }
  }, []);

  useEffect(() => {
    if (isDead) {
      if (isMounted) onDismountHorse();
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
    comboWindowRef.current = Math.max(0, comboWindowRef.current - dt);
    landingImpactRef.current = Math.max(0, landingImpactRef.current - dt * 4);
    idleShiftRef.current += dt;

    if (comboWindowRef.current <= 0) comboRef.current = 0;

    // Rebuild collision obstacles periodically
    collisionRebuildTimer.current += dt;
    if (collisionRebuildTimer.current > 0.5) {
      collisionRebuildTimer.current = 0;
      rebuildObstacles(resources, structures, horses, mountedHorseId);
    }

    const input = getMovementInput();
    const azimuth = cameraAzimuthRef.current;

    if (input.eat && !isMounted) onEatFood();

    // === HORSE INTERACTION — checked EVERY frame (input.interact is single-frame) ===
    {
      if (isMounted) {
        onSetInteractionText('🐴 Press E — Dismount');
        if (input.interact) {
          onDismountHorse();
          const angle = horseRotRef.current;
          pos.x += Math.cos(angle + Math.PI * 0.5) * DISMOUNT_OFFSET;
          pos.z -= Math.sin(angle + Math.PI * 0.5) * DISMOUNT_OFFSET;
          pos.y = getTerrainHeight(pos.x, pos.z) + PLAYER_HEIGHT / 2;
        }
      } else {
        // Find nearest horse
        let nearHorse: HorseData | null = null;
        let nearHorseDist = MOUNT_RANGE;
        for (const h of horses) {
          if (h.isMounted) continue;
          const dx = pos.x - h.position[0];
          const dz = pos.z - h.position[2];
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < nearHorseDist) { nearHorseDist = d; nearHorse = h; }
        }
        if (nearHorse) {
          // Horse takes priority over all other interactions
          onSetInteractionText('🐴 Press E — Mount Horse');
          if (input.interact) {
            onMountHorse(nearHorse.id);
            pos.x = nearHorse.position[0];
            pos.z = nearHorse.position[2];
            pos.y = nearHorse.position[1] + 2.2;
            horseRotRef.current = nearHorse.rotation;
            bodyRef.current.rotation.y = nearHorse.rotation;
            playerRotationRef.current = nearHorse.rotation;
            vel.set(0, 0, 0);
            currentSpeedRef.current = 0;
            rebuildObstacles(resources, structures, horses, nearHorse.id);
          }
          // Mark that horse has claimed the interaction this frame
          (input as any)._horseClaimed = true;
        }
      }
    }

    // === MOVEMENT ===
    _camForward.set(-Math.sin(azimuth), 0, -Math.cos(azimuth));
    _camRight.crossVectors(_up, _camForward).negate();

    _moveDir.set(0, 0, 0);
    if (input.w) _moveDir.add(_camForward);
    if (input.s) _moveDir.sub(_camForward);
    if (input.a) _moveDir.add(_camRight);
    if (input.d) _moveDir.sub(_camRight);

    const canRun = input.run && survival.stamina > 0;
    let baseSpeed: number, runSpeed: number;
    if (isMounted) { baseSpeed = HORSE_SPEED; runSpeed = HORSE_RUN_SPEED; }
    else { baseSpeed = PLAYER_SPEED; runSpeed = PLAYER_RUN_SPEED; }
    const targetSpeed = canRun ? runSpeed : baseSpeed;
    const isMoving = _moveDir.lengthSq() > 0.001;

    const accel = isMounted ? ACCEL_MOUNTED : (canRun ? ACCEL_GROUND_RUN : ACCEL_GROUND);
    const decel = isMounted ? DECEL_MOUNTED : DECEL_GROUND;

    if (isMoving) {
      _moveDir.normalize();

      if (isMounted) {
        // Horse steering: horse faces toward desired direction with speed-dependent turn rate
        const wantAngle = Math.atan2(_moveDir.x, _moveDir.z);
        let rotDiff = wantAngle - horseRotRef.current;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;

        // Turn rate depends on speed — slower = tighter turns, faster = wider arcs
        const speedFactor = currentSpeedRef.current / HORSE_RUN_SPEED;
        const turnRate = THREE.MathUtils.lerp(HORSE_TURN_SPEED_STANDING, TURN_SPEED_MOUNTED, speedFactor);
        horseRotRef.current += rotDiff * Math.min(1, turnRate * dt);
        // Wrap
        if (horseRotRef.current > Math.PI) horseRotRef.current -= Math.PI * 2;
        if (horseRotRef.current < -Math.PI) horseRotRef.current += Math.PI * 2;

        bodyRef.current.rotation.y = horseRotRef.current;
        playerRotationRef.current = horseRotRef.current;

        // Lean into turn
        leanRef.current = THREE.MathUtils.lerp(leanRef.current, -rotDiff * 0.3 * speedFactor, dt * 5);

        // Move in horse's facing direction (not input direction)
        currentSpeedRef.current = THREE.MathUtils.lerp(
          currentSpeedRef.current, targetSpeed, 1 - Math.exp(-accel * dt / targetSpeed)
        );
        const spd = currentSpeedRef.current;
        vel.x = Math.sin(horseRotRef.current) * spd;
        vel.z = Math.cos(horseRotRef.current) * spd;
      } else {
        // Foot movement — direct control
        currentSpeedRef.current = THREE.MathUtils.lerp(
          currentSpeedRef.current, targetSpeed, 1 - Math.exp(-accel * dt / targetSpeed)
        );
        const spd = currentSpeedRef.current;
        vel.x = _moveDir.x * spd;
        vel.z = _moveDir.z * spd;

        // Smooth turning
        const angle = Math.atan2(_moveDir.x, _moveDir.z);
        targetRotRef.current = angle;
        let rotDiff = angle - bodyRef.current.rotation.y;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        bodyRef.current.rotation.y += rotDiff * Math.min(1, TURN_SPEED_FOOT * dt);
        playerRotationRef.current = bodyRef.current.rotation.y;

        leanRef.current = THREE.MathUtils.lerp(leanRef.current, -rotDiff * 0.4, dt * 6);
      }

      const animSpeed = isMounted ? (canRun ? 20 : 13) : (canRun ? 16 : 10);
      animTimeRef.current += dt * animSpeed;
      moveSpeedRef.current = THREE.MathUtils.lerp(
        moveSpeedRef.current, canRun ? 1 : 0.55, dt * 6
      );
    } else {
      // Decelerate
      const curSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      if (curSpeed > 0.1) {
        const newSpeed = Math.max(0, curSpeed - decel * dt);
        const ratio = newSpeed / curSpeed;
        vel.x *= ratio;
        vel.z *= ratio;
        currentSpeedRef.current = newSpeed;
      } else {
        vel.x = 0;
        vel.z = 0;
        currentSpeedRef.current = 0;
      }
      moveSpeedRef.current = THREE.MathUtils.lerp(moveSpeedRef.current, 0, dt * 5);
      leanRef.current = THREE.MathUtils.lerp(leanRef.current, 0, dt * 4);
    }

    // Hip sway
    hipSwayRef.current = THREE.MathUtils.lerp(
      hipSwayRef.current,
      isMoving ? Math.sin(animTimeRef.current * 0.5) * 0.03 * moveSpeedRef.current : 0,
      dt * 8
    );

    // Jump
    if (!isMounted && input.jump && isGroundedRef.current) {
      vel.y = PLAYER_JUMP_FORCE;
      isGroundedRef.current = false;
      wasInAirRef.current = true;
    }

    // === COMBO ATTACK SYSTEM ===
    if (!isMounted && !buildMode && input.attack && attackCooldownRef.current <= 0) {
      const isCombo = comboRef.current === 1 && comboWindowRef.current > 0;
      const atkDuration = isCombo ? 0.3 : 0.4;
      const atkDamage = isCombo ? PLAYER_ATTACK_DAMAGE * 1.3 : PLAYER_ATTACK_DAMAGE;

      attackCooldownRef.current = isCombo ? PLAYER_ATTACK_COOLDOWN * 0.8 : PLAYER_ATTACK_COOLDOWN;
      attackAnimRef.current = atkDuration;
      comboRef.current = isCombo ? 0 : 1;
      comboWindowRef.current = isCombo ? 0 : 0.6;

      const playerAngle = bodyRef.current.rotation.y;
      if (!isMoving) {
        vel.x += Math.sin(playerAngle) * 3;
        vel.z += Math.cos(playerAngle) * 3;
      }

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
          onEnemyHit(enemy.id, atkDamage);
        }
      }
    }

    // Gravity & position update
    if (!isMounted) {
      vel.y -= GRAVITY * dt;
    } else {
      vel.y = 0;
    }
    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
    pos.y += vel.y * dt;

    // === COLLISION RESOLUTION ===
    const colRadius = isMounted ? MOUNTED_RADIUS : PLAYER_RADIUS;
    const resolved = resolveCollision(pos.x, pos.z, colRadius);
    // If collision pushed us, also zero out velocity in that direction
    const pushX = resolved.x - pos.x;
    const pushZ = resolved.z - pos.z;
    if (Math.abs(pushX) > 0.001 || Math.abs(pushZ) > 0.001) {
      pos.x = resolved.x;
      pos.z = resolved.z;
      // Cancel velocity component into obstacle
      if (pushX * vel.x < 0) vel.x *= 0.1;
      if (pushZ * vel.z < 0) vel.z *= 0.1;
    }

    const heightOffset = isMounted ? 2.2 : PLAYER_HEIGHT / 2;
    const terrainY = getTerrainHeight(pos.x, pos.z) + heightOffset;
    if (pos.y <= terrainY) {
      if (wasInAirRef.current && vel.y < -3) {
        landingImpactRef.current = Math.min(1, Math.abs(vel.y) / 15);
      }
      pos.y = terrainY;
      vel.y = 0;
      isGroundedRef.current = true;
      wasInAirRef.current = false;
    } else {
      wasInAirRef.current = true;
    }
    pos.x = THREE.MathUtils.clamp(pos.x, -230, 230);
    pos.z = THREE.MathUtils.clamp(pos.z, -230, 230);
    playerPositionRef.current.copy(pos);

    // Loot collection
    if (!isMounted) {
      lootCheckRef.current += dt;
      if (lootCheckRef.current > 0.2) {
        lootCheckRef.current = 0;
        for (const loot of lootPickups) {
          if (loot.collected) continue;
          const dx = pos.x - loot.position[0];
          const dz = pos.z - loot.position[2];
          if (dx * dx + dz * dz < 4) onCollectLoot(loot.id);
        }
      }
    }

    // Survival updates
    survivalAccumRef.current += dt;
    if (survivalAccumRef.current >= 0.1) {
      const elapsed = survivalAccumRef.current;
      survivalAccumRef.current = 0;

      let nearCampfire = false, nearShelter = false, nearBedroll = false;
      for (const s of structures) {
        const sdx = pos.x - s.position[0];
        const sdz = pos.z - s.position[2];
        const sdist = sdx * sdx + sdz * sdz;
        if (s.type === 'campfire' && sdist < CAMPFIRE_WARMTH_RANGE * CAMPFIRE_WARMTH_RANGE) nearCampfire = true;
        if (s.type === 'shelter' && sdist < SHELTER_EFFECT_RANGE * SHELTER_EFFECT_RANGE) nearShelter = true;
        if (s.type === 'bedroll' && sdist < 4 * 4) nearBedroll = true;
      }

      let zoneTempMod = 0;
      for (const poi of Object.values(POIS)) {
        const pdx = pos.x - poi.x;
        const pdz = pos.z - poi.z;
        if (pdx * pdx + pdz * pdz < POI_ZONE_RADIUS * POI_ZONE_RADIUS) zoneTempMod += poi.tempMod;
      }

      let tempChange = -TEMPERATURE_DRAIN * elapsed + zoneTempMod * elapsed;
      if (nearCampfire) tempChange += CAMPFIRE_WARMTH_RATE * elapsed;

      let hungerDrain = HUNGER_DRAIN * elapsed;
      if (nearShelter) hungerDrain *= SHELTER_HUNGER_REDUCTION;
      if (isMounted) hungerDrain *= 0.7;

      let staminaChange: number;
      if (canRun && isMoving) {
        staminaChange = -(isMounted ? STAMINA_DRAIN * 0.4 : STAMINA_DRAIN) * elapsed;
      } else {
        let regenRate = STAMINA_REGEN;
        if (survival.hunger < LOW_HUNGER_THRESHOLD) regenRate *= 0.5;
        if (nearShelter) regenRate += SHELTER_STAMINA_BONUS;
        if (nearBedroll && !isMoving) regenRate += 12;
        staminaChange = regenRate * elapsed;
      }

      let healthChange = 0;
      if (survival.hunger <= 0) healthChange -= 2 * elapsed;
      if (survival.temperature < LOW_TEMP_THRESHOLD) healthChange -= COLD_DAMAGE_RATE * elapsed;
      if (nearCampfire) healthChange += 1.5 * elapsed;
      if (nearShelter && survival.hunger > 30) healthChange += 0.8 * elapsed;

      onSurvivalUpdate({
        stamina: survival.stamina + staminaChange,
        hunger: survival.hunger - hungerDrain,
        temperature: survival.temperature + tempChange,
        health: survival.health + healthChange,
      });
    }
  });

  // === RICH PROCEDURAL ANIMATION ===
  const t = animTimeRef.current;
  const ms = moveSpeedRef.current;
  const attackT = attackAnimRef.current;
  const attacking = attackT > 0;
  const inAir = wasInAirRef.current;
  const landImpact = landingImpactRef.current;
  const lean = leanRef.current;
  const hipSway = hipSwayRef.current;
  const isComboSwing = comboRef.current === 0 && attacking; // second swing

  // Locomotion
  const legSwing = Math.sin(t) * 0.7 * ms;
  const legSwingBack = Math.sin(t + Math.PI) * 0.7 * ms;
  const armSwing = Math.sin(t + 0.3) * 0.55 * ms;
  const armSwingBack = Math.sin(t + Math.PI + 0.3) * 0.55 * ms;
  const bodyBob = Math.abs(Math.sin(t * 2)) * 0.08 * ms - landImpact * 0.15;
  const bodyForwardLean = ms * 0.06 + (ms > 0.8 ? 0.04 : 0); // lean forward when running
  const shoulderRoll = Math.sin(t) * 0.04 * ms; // subtle shoulder twist
  const torsoTwist = Math.sin(t) * 0.06 * ms; // upper body counter-rotation

  // Attack animation — multi-phase with wind-up
  let atkSwingR = 0, atkSwingL = 0, atkBodyTwist = 0, atkLunge = 0;
  if (attacking) {
    const duration = isComboSwing ? 0.3 : 0.4;
    const phase = 1 - attackT / duration;

    if (isComboSwing) {
      // Second swing — backhand from left
      if (phase < 0.15) {
        // Wind-up
        atkSwingR = 0.3 * (phase / 0.15);
        atkSwingL = -0.8 * (phase / 0.15);
        atkBodyTwist = 0.2 * (phase / 0.15);
      } else if (phase < 0.4) {
        // Strike
        const sp = (phase - 0.15) / 0.25;
        atkSwingR = 0.3 - sp * 0.3;
        atkSwingL = -0.8 + sp * 2.2;
        atkBodyTwist = 0.2 - sp * 0.5;
        atkLunge = sp * 0.15;
      } else {
        // Recovery
        const rp = (phase - 0.4) / 0.6;
        atkSwingL = 1.4 * (1 - rp);
        atkBodyTwist = -0.3 * (1 - rp);
      }
    } else {
      // First swing — overhead/diagonal from right
      if (phase < 0.2) {
        // Wind-up: raise sword
        const wp = phase / 0.2;
        atkSwingR = -1.2 * wp;
        atkBodyTwist = -0.15 * wp;
      } else if (phase < 0.45) {
        // Strike: swing down
        const sp = (phase - 0.2) / 0.25;
        atkSwingR = -1.2 + sp * 2.8;
        atkBodyTwist = -0.15 + sp * 0.4;
        atkLunge = sp * 0.2;
      } else {
        // Recovery
        const rp = (phase - 0.45) / 0.55;
        atkSwingR = 1.6 * (1 - rp * rp);
        atkBodyTwist = 0.25 * (1 - rp);
        atkLunge = 0.2 * (1 - rp);
      }
    }
  }

  // Idle animation — weight shifting and breathing
  const idleT = idleShiftRef.current;
  const idleBreath = ms < 0.1 ? Math.sin(idleT * 1.8) * 0.012 : 0;
  const idleWeightShift = ms < 0.1 ? Math.sin(idleT * 0.4) * 0.02 : 0;
  const idleSway = ms < 0.1 ? Math.sin(idleT * 0.7) * 0.015 : 0;

  // In-air pose
  const airLegSpread = inAir ? 0.15 : 0;
  const airArmRaise = inAir ? -0.3 : 0;

  // Horse animation
  const horseLegFL = isMounted ? Math.sin(t) * 0.5 * ms : 0;
  const horseLegFR = isMounted ? Math.sin(t + Math.PI * 0.5) * 0.5 * ms : 0;
  const horseLegBL = isMounted ? Math.sin(t + Math.PI) * 0.5 * ms : 0;
  const horseLegBR = isMounted ? Math.sin(t + Math.PI * 1.5) * 0.5 * ms : 0;
  const horseBodyBob = isMounted ? Math.abs(Math.sin(t * 2)) * 0.1 * ms : 0;
  const horseNeckBob = isMounted ? Math.sin(t * 2 + 0.5) * 0.08 * ms : 0;
  const horseHeadNod = isMounted ? Math.sin(t * 2 + 1) * 0.05 * ms : 0;
  const riderBounce = isMounted ? Math.abs(Math.sin(t * 2)) * 0.06 * ms : 0;
  const riderSway = isMounted ? Math.sin(t) * 0.03 * ms : 0;

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

  const playerY = isMounted ? 0.5 + riderBounce : bodyBob + idleBreath;

  return (
    <group ref={groupRef}>
      <group ref={bodyRef}>
        {/* ===== MOUNTED HORSE ===== */}
        {isMounted && (
          <group position={[0, -2.2 + horseBodyBob, 0]}>
            {/* Body */}
            <mesh position={[0, 1.1, 0]} castShadow>
              <boxGeometry args={[0.7, 0.65, 1.6]} />
              <meshLambertMaterial color="#6a4a2a" />
            </mesh>
            <mesh position={[0, 1.15, 0.6]} castShadow>
              <boxGeometry args={[0.6, 0.55, 0.4]} />
              <meshLambertMaterial color="#6a4a2a" />
            </mesh>
            <mesh position={[0, 1.05, -0.65]} castShadow>
              <boxGeometry args={[0.55, 0.5, 0.35]} />
              <meshLambertMaterial color="#6a4a2a" />
            </mesh>
            {/* Neck with bob */}
            <group position={[0, 1.55 + horseNeckBob, 0.8]} rotation={[0.5 + horseHeadNod, 0, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.35, 0.7, 0.35]} />
                <meshLambertMaterial color="#6a4a2a" />
              </mesh>
            </group>
            {/* Head with nod */}
            <group position={[0, 1.85 + horseNeckBob, 1.15 + horseHeadNod * 0.5]}>
              <mesh castShadow>
                <boxGeometry args={[0.3, 0.28, 0.45]} />
                <meshLambertMaterial color="#6a4a2a" />
              </mesh>
              <mesh position={[0, -0.08, 0.25]} castShadow>
                <boxGeometry args={[0.22, 0.18, 0.25]} />
                <meshLambertMaterial color="#4a3218" />
              </mesh>
              <mesh position={[-0.08, 0.2, 0]} castShadow>
                <boxGeometry args={[0.06, 0.14, 0.06]} />
                <meshLambertMaterial color="#4a3218" />
              </mesh>
              <mesh position={[0.08, 0.2, 0]} castShadow>
                <boxGeometry args={[0.06, 0.14, 0.06]} />
                <meshLambertMaterial color="#4a3218" />
              </mesh>
            </group>
            {/* Mane */}
            <mesh position={[0, 1.65, 0.65]} rotation={[0.4, 0, 0]} castShadow>
              <boxGeometry args={[0.08, 0.5, 0.3]} />
              <meshLambertMaterial color="#2a1a08" />
            </mesh>
            {/* Saddle */}
            <mesh position={[0, 1.5, 0.05]} castShadow>
              <boxGeometry args={[0.55, 0.12, 0.5]} />
              <meshLambertMaterial color="#5a2010" />
            </mesh>
            {/* Legs — proper gait cycle */}
            {([
              [-0.22, 0.5, horseLegFL],
              [0.22, 0.5, horseLegFR],
              [-0.22, -0.5, horseLegBL],
              [0.22, -0.5, horseLegBR],
            ] as [number, number, number][]).map(([lx, lz, anim], i) => (
              <group key={i} position={[lx, 0.55, lz]} rotation={[anim, 0, 0]}>
                <mesh position={[0, 0, 0]} castShadow>
                  <boxGeometry args={[0.16, 0.7, 0.16]} />
                  <meshLambertMaterial color="#6a4a2a" />
                </mesh>
                <mesh position={[0, -0.43, 0]} castShadow>
                  <boxGeometry args={[0.14, 0.35, 0.14]} />
                  <meshLambertMaterial color="#4a3218" />
                </mesh>
                <mesh position={[0, -0.58, 0]} castShadow>
                  <boxGeometry args={[0.15, 0.08, 0.18]} />
                  <meshLambertMaterial color="#1a1a1a" />
                </mesh>
              </group>
            ))}
            {/* Tail */}
            <group position={[0, 1.0, -0.95]}
              rotation={[Math.sin(t * 1.5 + 1) * 0.35 * Math.max(0.3, ms) - 0.3, Math.sin(t * 0.7) * 0.1, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.06, 0.5, 0.06]} />
                <meshLambertMaterial color="#2a1a08" />
              </mesh>
            </group>
          </group>
        )}

        {/* ===== PLAYER CHARACTER ===== */}
        <group
          position={[hipSway + idleWeightShift, playerY, atkLunge]}
          rotation={[
            bodyForwardLean + idleSway,
            torsoTwist + atkBodyTwist + (isMounted ? riderSway : 0),
            lean
          ]}
        >
          {/* Torso - lower */}
          <mesh position={[0, -0.05, 0]} castShadow>
            <boxGeometry args={[0.75, 0.5, 0.4]} />
            <meshLambertMaterial color="#555555" />
          </mesh>
          {/* Torso - upper with shoulder roll */}
          <group position={[0, 0.3, 0]} rotation={[0, shoulderRoll, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.8, 0.55, 0.42]} />
              <meshLambertMaterial color="#6a6a72" />
            </mesh>
          </group>
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
          {/* Head + helmet */}
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
          {/* Left arm — shield side */}
          <group position={[-0.52, 0.15, 0]}
            rotation={[
              isMounted ? -0.3 : (armSwing + airArmRaise + atkSwingL),
              0,
              isMounted ? -0.15 : 0
            ]}>
            <mesh position={[0, -0.15, 0]} castShadow>
              <boxGeometry args={[0.2, 0.6, 0.22]} />
              <meshLambertMaterial color="#555555" />
            </mesh>
            <mesh position={[-0.05, -0.2, 0.15]} castShadow>
              <boxGeometry args={[0.04, 0.45, 0.35]} />
              <meshLambertMaterial color="#4a3010" />
            </mesh>
          </group>
          {/* Right arm — sword */}
          <group position={[0.52, 0.15, 0]}
            rotation={[
              isMounted ? -0.3 : (armSwingBack + airArmRaise + atkSwingR),
              0,
              isMounted ? 0.15 : 0
            ]}>
            <mesh position={[0, -0.15, 0]} castShadow>
              <boxGeometry args={[0.2, 0.6, 0.22]} />
              <meshLambertMaterial color="#555555" />
            </mesh>
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
          {isMounted ? (
            <>
              <group position={[-0.25, -0.5, 0]} rotation={[0, 0, 0.3]}>
                <mesh position={[0, -0.2, 0]} castShadow>
                  <boxGeometry args={[0.24, 0.55, 0.24]} />
                  <meshLambertMaterial color="#3a3030" />
                </mesh>
                <mesh position={[0, -0.5, 0]} castShadow>
                  <boxGeometry args={[0.22, 0.15, 0.26]} />
                  <meshLambertMaterial color="#4a3520" />
                </mesh>
              </group>
              <group position={[0.25, -0.5, 0]} rotation={[0, 0, -0.3]}>
                <mesh position={[0, -0.2, 0]} castShadow>
                  <boxGeometry args={[0.24, 0.55, 0.24]} />
                  <meshLambertMaterial color="#3a3030" />
                </mesh>
                <mesh position={[0, -0.5, 0]} castShadow>
                  <boxGeometry args={[0.22, 0.15, 0.26]} />
                  <meshLambertMaterial color="#4a3520" />
                </mesh>
              </group>
            </>
          ) : (
            <>
              <group position={[-0.18, -0.5, 0]}
                rotation={[-legSwing - airLegSpread, 0, 0]}>
                <mesh position={[0, -0.2, 0]} castShadow>
                  <boxGeometry args={[0.24, 0.55, 0.24]} />
                  <meshLambertMaterial color="#3a3030" />
                </mesh>
                <mesh position={[0, -0.5, 0]} castShadow>
                  <boxGeometry args={[0.22, 0.15, 0.26]} />
                  <meshLambertMaterial color="#4a3520" />
                </mesh>
              </group>
              <group position={[0.18, -0.5, 0]}
                rotation={[-legSwingBack + airLegSpread, 0, 0]}>
                <mesh position={[0, -0.2, 0]} castShadow>
                  <boxGeometry args={[0.24, 0.55, 0.24]} />
                  <meshLambertMaterial color="#3a3030" />
                </mesh>
                <mesh position={[0, -0.5, 0]} castShadow>
                  <boxGeometry args={[0.22, 0.15, 0.26]} />
                  <meshLambertMaterial color="#4a3520" />
                </mesh>
              </group>
            </>
          )}
          {/* Cape — sways with movement */}
          <group position={[0, 0.1, -0.24]}
            rotation={[ms * 0.15 + (isMounted ? ms * 0.3 : 0), Math.sin(t * 0.8) * 0.05 * ms, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.65, 0.9, 0.04]} />
              <meshLambertMaterial color="#2a1a0a" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
