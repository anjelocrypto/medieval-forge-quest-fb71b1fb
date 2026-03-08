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
}

const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _forward = new THREE.Vector3();
const _toEnemy = new THREE.Vector3();

export function Player({
  onSurvivalUpdate, survival, playerPositionRef, playerRotationRef,
  cameraAzimuthRef, enemies, onEnemyHit, onRespawn, buildMode,
  structures, lootPickups, onCollectLoot, onEatFood,
  horses, onMountHorse, onDismountHorse, mountedHorseId, onSetInteractionText,
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
  const lootCheckRef = useRef(0);
  const horseCheckRef = useRef(0);
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

    const input = getMovementInput();
    const azimuth = cameraAzimuthRef.current;

    // Eat food with F key (only when not near a horse to mount)
    if (input.eat && !isMounted) {
      onEatFood();
    }

    // Mount/dismount logic
    horseCheckRef.current += dt;
    if (horseCheckRef.current > 0.15) {
      horseCheckRef.current = 0;

      if (isMounted) {
        // Show dismount prompt
        if (input.interact) {
          onDismountHorse();
          // Move player to side of horse
          const angle = bodyRef.current.rotation.y;
          pos.x += Math.cos(angle) * DISMOUNT_OFFSET;
          pos.z -= Math.sin(angle) * DISMOUNT_OFFSET;
        }
      } else {
        // Check for nearby horses
        let nearHorse: HorseData | null = null;
        let nearHorseDist = MOUNT_RANGE;
        for (const h of horses) {
          if (h.isMounted) continue;
          const dx = pos.x - h.position[0];
          const dz = pos.z - h.position[2];
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < nearHorseDist) {
            nearHorseDist = d;
            nearHorse = h;
          }
        }
        if (nearHorse) {
          onSetInteractionText('🐴 Press E — Mount Horse');
          if (input.interact) {
            onMountHorse(nearHorse.id);
            // Snap player to horse position
            pos.x = nearHorse.position[0];
            pos.z = nearHorse.position[2];
            pos.y = nearHorse.position[1] + 1.8;
          }
        }
      }
    }

    // Movement
    _camForward.set(-Math.sin(azimuth), 0, -Math.cos(azimuth));
    _camRight.crossVectors(_up, _camForward).negate();

    _moveDir.set(0, 0, 0);
    if (input.w) _moveDir.add(_camForward);
    if (input.s) _moveDir.sub(_camForward);
    if (input.a) _moveDir.add(_camRight);
    if (input.d) _moveDir.sub(_camRight);

    const canRun = input.run && survival.stamina > 0;

    // Speed depends on mounted state
    let baseSpeed: number, runSpeed: number;
    if (isMounted) {
      baseSpeed = HORSE_SPEED;
      runSpeed = HORSE_RUN_SPEED;
    } else {
      baseSpeed = PLAYER_SPEED;
      runSpeed = PLAYER_RUN_SPEED;
    }
    const speed = canRun ? runSpeed : baseSpeed;
    const isMoving = _moveDir.lengthSq() > 0.001;

    if (isMoving) {
      _moveDir.normalize();
      vel.x = _moveDir.x * speed;
      vel.z = _moveDir.z * speed;
      const angle = Math.atan2(_moveDir.x, _moveDir.z);
      bodyRef.current.rotation.y = THREE.MathUtils.lerp(bodyRef.current.rotation.y, angle, dt * 10);
      playerRotationRef.current = bodyRef.current.rotation.y;
      const animSpeed = isMounted ? (canRun ? 18 : 12) : (canRun ? 14 : 9);
      animTimeRef.current += dt * animSpeed;
      moveSpeedRef.current = THREE.MathUtils.lerp(moveSpeedRef.current, canRun ? 1 : 0.6, dt * 8);
    } else {
      vel.x *= 0.8;
      vel.z *= 0.8;
      moveSpeedRef.current = THREE.MathUtils.lerp(moveSpeedRef.current, 0, dt * 6);
    }

    // Jump (not while mounted)
    if (!isMounted && input.jump && isGroundedRef.current) {
      vel.y = PLAYER_JUMP_FORCE;
      isGroundedRef.current = false;
    }

    // Attack (not while mounted, not in build mode)
    if (!isMounted && !buildMode && input.attack && attackCooldownRef.current <= 0) {
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

    if (!isMounted) {
      vel.y -= GRAVITY * dt;
    } else {
      vel.y = 0; // No vertical velocity while mounted
    }
    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
    pos.y += vel.y * dt;

    const heightOffset = isMounted ? 1.8 : PLAYER_HEIGHT / 2;
    const terrainY = getTerrainHeight(pos.x, pos.z) + heightOffset;
    if (pos.y <= terrainY) { pos.y = terrainY; vel.y = 0; isGroundedRef.current = true; }
    pos.x = THREE.MathUtils.clamp(pos.x, -230, 230);
    pos.z = THREE.MathUtils.clamp(pos.z, -230, 230);
    playerPositionRef.current.copy(pos);

    // Auto-collect nearby loot pickups (not while mounted for balance)
    if (!isMounted) {
      lootCheckRef.current += dt;
      if (lootCheckRef.current > 0.2) {
        lootCheckRef.current = 0;
        for (const loot of lootPickups) {
          if (loot.collected) continue;
          const dx = pos.x - loot.position[0];
          const dz = pos.z - loot.position[2];
          if (dx * dx + dz * dz < 4) {
            onCollectLoot(loot.id);
          }
        }
      }
    }

    // Survival updates
    survivalAccumRef.current += dt;
    if (survivalAccumRef.current >= 0.1) {
      const elapsed = survivalAccumRef.current;
      survivalAccumRef.current = 0;

      let nearCampfire = false;
      let nearShelter = false;
      let nearBedroll = false;
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
        if (pdx * pdx + pdz * pdz < POI_ZONE_RADIUS * POI_ZONE_RADIUS) {
          zoneTempMod += poi.tempMod;
        }
      }

      let tempChange = -TEMPERATURE_DRAIN * elapsed + zoneTempMod * elapsed;
      if (nearCampfire) tempChange += CAMPFIRE_WARMTH_RATE * elapsed;

      let hungerDrain = HUNGER_DRAIN * elapsed;
      if (nearShelter) hungerDrain *= SHELTER_HUNGER_REDUCTION;
      // Mounted travel is less tiring
      if (isMounted) hungerDrain *= 0.7;

      let staminaChange: number;
      if (canRun && isMoving) {
        // Mounted running costs less stamina
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

  // Animation values
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

  // Mounted horse animation
  const horseLegAnim = isMounted ? Math.sin(t) * 0.4 * ms : 0;
  const horseBodyBob = isMounted ? Math.abs(Math.sin(t * 2)) * 0.08 * ms : 0;

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
        {/* Horse mesh when mounted */}
        {isMounted && (
          <group position={[0, -1.8 + horseBodyBob, 0]}>
            {/* Horse body */}
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
            {/* Neck */}
            <mesh position={[0, 1.55, 0.8]} rotation={[0.5, 0, 0]} castShadow>
              <boxGeometry args={[0.35, 0.7, 0.35]} />
              <meshLambertMaterial color="#6a4a2a" />
            </mesh>
            {/* Head */}
            <mesh position={[0, 1.85, 1.15]} castShadow>
              <boxGeometry args={[0.3, 0.28, 0.45]} />
              <meshLambertMaterial color="#6a4a2a" />
            </mesh>
            <mesh position={[0, 1.77, 1.4]} castShadow>
              <boxGeometry args={[0.22, 0.18, 0.25]} />
              <meshLambertMaterial color="#4a3218" />
            </mesh>
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
            {/* Legs with animation */}
            {[
              [-0.22, 0.5, horseLegAnim],
              [0.22, 0.5, -horseLegAnim],
              [-0.22, -0.5, -horseLegAnim],
              [0.22, -0.5, horseLegAnim],
            ].map(([lx, lz, anim], i) => (
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
            <group position={[0, 1.0, -0.95]} rotation={[Math.sin(t * 1.5) * 0.3 - 0.3, 0, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.06, 0.5, 0.06]} />
                <meshLambertMaterial color="#2a1a08" />
              </mesh>
            </group>
          </group>
        )}

        {/* Player character — raised when mounted */}
        <group position={[0, (isMounted ? 0.3 : 0) + bodyBob + idleBob, 0]} rotation={[bodyTilt, atkBodyTwist, 0]}>
          {/* Torso */}
          <mesh position={[0, -0.05, 0]} castShadow>
            <boxGeometry args={[0.75, 0.5, 0.4]} />
            <meshLambertMaterial color="#555555" />
          </mesh>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.8, 0.55, 0.42]} />
            <meshLambertMaterial color="#6a6a72" />
          </mesh>
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
          {/* Left arm */}
          <group position={[-0.52, 0.15, 0]} rotation={[isMounted ? -0.3 : armSwing, 0, 0]}>
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
          <group position={[0.52, 0.15, 0]} rotation={[isMounted ? -0.3 : (-armSwing + atkSwing), 0, 0]}>
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
          {/* Legs — spread when mounted */}
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
            </>
          )}
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
