import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EnemyData, ENEMY_ATTACK_COOLDOWN, ENEMY_DESPAWN_TIME } from '../systems/EnemyData';
import { getTerrainHeight } from './Terrain';

interface Props {
  enemies: EnemyData[];
  playerPositionRef: React.RefObject<THREE.Vector3>;
  onEnemiesUpdate: (enemies: EnemyData[]) => void;
  pendingPlayerDamageRef: React.MutableRefObject<number>;
}

// Shared materials
const banditBodyMat = new THREE.MeshLambertMaterial({ color: '#6b4030' });
const banditHeadMat = new THREE.MeshLambertMaterial({ color: '#c4a070' });
const banditLegMat = new THREE.MeshLambertMaterial({ color: '#3a3020' });
const banditBootMat = new THREE.MeshLambertMaterial({ color: '#2a1a0a' });
const banditWeaponMat = new THREE.MeshLambertMaterial({ color: '#999' });
const wolfBodyMat = new THREE.MeshLambertMaterial({ color: '#5a4a3a' });
const wolfLightMat = new THREE.MeshLambertMaterial({ color: '#7a6a5a' });
const wolfEyeMat = new THREE.MeshBasicMaterial({ color: '#ccaa00' });
const hitMat = new THREE.MeshLambertMaterial({ color: '#ff4444' });
const deadMat = new THREE.MeshLambertMaterial({ color: '#4a2020', transparent: true });
const hpBgMat = new THREE.MeshBasicMaterial({ color: '#222', transparent: true, opacity: 0.8 });
const hpGreenMat = new THREE.MeshBasicMaterial({ color: '#44aa44' });
const hpRedMat = new THREE.MeshBasicMaterial({ color: '#cc4444' });
const aggroMat = new THREE.MeshBasicMaterial({ color: '#ff2222' });

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const planeGeo = new THREE.PlaneGeometry(1, 1);

// Stagger data stored per-enemy
interface StaggerState {
  x: number;
  z: number;
  timer: number;
}

export function Enemies({ enemies, playerPositionRef, onEnemiesUpdate, pendingPlayerDamageRef }: Props) {
  const deathTimers = useRef<Map<string, number>>(new Map());
  const animTimers = useRef<Map<string, number>>(new Map());
  const staggerMap = useRef<Map<string, StaggerState>>(new Map());
  const atkWindupMap = useRef<Map<string, number>>(new Map());

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const playerPos = playerPositionRef.current;
    if (!playerPos) return;

    let changed = false;
    const px = playerPos.x, pz = playerPos.z;

    const updated = enemies.map(e => {
      if (e.state === 'dead') {
        const timer = (deathTimers.current.get(e.id) || 0) + dt;
        deathTimers.current.set(e.id, timer);
        return e;
      }

      // Update stagger
      const stagger = staggerMap.current.get(e.id);
      if (stagger && stagger.timer > 0) {
        stagger.timer -= dt;
      }

      const isStaggered = stagger && stagger.timer > 0;
      const chaseAnimSpeed = e.type === 'wolf' ? 14 : 11;
      const patrolAnimSpeed = e.type === 'wolf' ? 7 : 5;
      animTimers.current.set(e.id,
        (animTimers.current.get(e.id) || 0) + dt * (e.state === 'chase' ? chaseAnimSpeed : patrolAnimSpeed)
      );

      const dx = px - e.position[0];
      const dz = pz - e.position[2];
      const distSq = dx * dx + dz * dz;
      const distToPlayer = Math.sqrt(distSq);

      if (distSq > 10000) return e;

      const dirX = distToPlayer > 0.1 ? dx / distToPlayer : 0;
      const dirZ = distToPlayer > 0.1 ? dz / distToPlayer : 0;

      let newState = e.state;
      let newPos: [number, number, number] = [...e.position];
      let newCooldown = Math.max(0, e.attackCooldown - dt);
      let newFlash = Math.max(0, e.hitFlash - dt);
      let newAngle = e.patrolAngle;

      // Stagger knockback
      if (isStaggered && stagger) {
        newPos[0] += stagger.x * 4 * dt * stagger.timer;
        newPos[2] += stagger.z * 4 * dt * stagger.timer;
        newPos[1] = getTerrainHeight(newPos[0], newPos[2]) + 0.9;
        changed = true;
      }

      // When hit, register stagger
      if (e.hitFlash > 0 && newFlash > 0 && !staggerMap.current.has(e.id)) {
        staggerMap.current.set(e.id, { x: -dirX, z: -dirZ, timer: 0.25 });
      }
      if (newFlash <= 0) {
        const s = staggerMap.current.get(e.id);
        if (s && s.timer <= 0) staggerMap.current.delete(e.id);
      }

      if (isStaggered) {
        // Don't change state while staggered
      } else if (distToPlayer < e.attackRange) {
        newState = 'attack';
      } else if (distToPlayer < e.detectRange) {
        newState = 'chase';
      } else if (e.state === 'chase' || e.state === 'attack') {
        newState = 'patrol';
      } else if (e.state === 'idle') {
        newState = 'patrol';
      }

      if (!isStaggered) {
        if (newState === 'chase') {
          // Wolves are more agile — strafe slightly
          const strafeAngle = e.type === 'wolf' ? Math.sin((animTimers.current.get(e.id) || 0) * 0.3) * 0.3 : 0;
          const cos = Math.cos(strafeAngle), sin = Math.sin(strafeAngle);
          const mx = dirX * cos - dirZ * sin;
          const mz = dirX * sin + dirZ * cos;
          newPos[0] += mx * e.speed * dt;
          newPos[2] += mz * e.speed * dt;
          newPos[1] = getTerrainHeight(newPos[0], newPos[2]) + 0.9;
        } else if (newState === 'patrol') {
          newAngle += dt * 0.3;
          const tx = e.patrolCenter[0] + Math.cos(newAngle) * e.patrolRadius;
          const tz = e.patrolCenter[2] + Math.sin(newAngle) * e.patrolRadius;
          const pdx = tx - newPos[0], pdz = tz - newPos[2];
          const pd = Math.sqrt(pdx * pdx + pdz * pdz);
          if (pd > 0.5) {
            newPos[0] += (pdx / pd) * e.speed * 0.4 * dt;
            newPos[2] += (pdz / pd) * e.speed * 0.4 * dt;
            newPos[1] = getTerrainHeight(newPos[0], newPos[2]) + 0.9;
          }
        } else if (newState === 'attack') {
          // Track wind-up
          const windupTime = atkWindupMap.current.get(e.id) || 0;
          if (newCooldown <= 0) {
            if (windupTime < 0.3) {
              // Wind-up phase — don't attack yet, just telegraph
              atkWindupMap.current.set(e.id, windupTime + dt);
            } else {
              // Strike!
              pendingPlayerDamageRef.current += e.damage;
              newCooldown = ENEMY_ATTACK_COOLDOWN;
              atkWindupMap.current.set(e.id, 0);
            }
          }
        }
      }

      const n = {
        ...e, position: newPos, state: newState as EnemyData['state'],
        attackCooldown: newCooldown, hitFlash: newFlash, patrolAngle: newAngle,
      };
      if (n.state !== e.state || n.hitFlash !== e.hitFlash) changed = true;
      if (newState === 'chase' || newState === 'patrol' || newState === 'attack') changed = true;
      return n;
    });

    const filtered = updated.filter(e => {
      if (e.state !== 'dead') return true;
      return (deathTimers.current.get(e.id) || 0) < ENEMY_DESPAWN_TIME;
    });

    if (changed || filtered.length !== enemies.length) {
      onEnemiesUpdate(filtered);
    }
  });

  return (
    <group>
      {enemies.map(e => {
        const animT = animTimers.current.get(e.id) || 0;
        const playerPos = playerPositionRef.current;

        if (playerPos) {
          const dx = playerPos.x - e.position[0];
          const dz = playerPos.z - e.position[2];
          if (dx * dx + dz * dz > 120 * 120) return null;
        }

        if (e.state === 'dead') {
          const timer = deathTimers.current.get(e.id) || 0;
          const fade = Math.max(0, 1 - timer / ENEMY_DESPAWN_TIME);
          deadMat.opacity = fade;
          // Death tumble
          const deathRoll = Math.min(timer * 4, Math.PI / 2);
          const deathSlide = Math.min(timer * 2, 1);
          return (
            <group key={e.id} position={[e.position[0], e.position[1] - 0.3 - deathSlide * 0.3, e.position[2]]}>
              <mesh rotation={[deathRoll, 0, deathRoll * 0.3]} geometry={boxGeo}
                scale={[0.6, 0.8, 0.3]} material={deadMat} />
            </group>
          );
        }

        const isBandit = e.type === 'bandit';
        const flash = e.hitFlash > 0;
        const stagger = staggerMap.current.get(e.id);
        const isStaggered = stagger && stagger.timer > 0;
        const staggerRecoil = isStaggered ? stagger.timer * 0.5 : 0;

        const faceAngle = Math.atan2(
          (playerPos?.x || 0) - e.position[0],
          (playerPos?.z || 0) - e.position[2]
        );
        const hp = e.health / e.maxHealth;
        const isMoving = e.state === 'chase' || e.state === 'patrol';
        const isChasing = e.state === 'chase';
        const ms = isMoving ? (isChasing ? 1 : 0.4) : 0;

        // Richer locomotion
        const legAnim = Math.sin(animT) * 0.6 * ms;
        const legAnimOff = Math.sin(animT + Math.PI) * 0.6 * ms;
        const armAnim = Math.sin(animT + 0.3) * 0.45 * ms;
        const armAnimOff = Math.sin(animT + Math.PI + 0.3) * 0.45 * ms;
        const bodyBob = Math.abs(Math.sin(animT * 2)) * 0.05 * ms;
        const bodyLean = ms * 0.05 * (isChasing ? 1.5 : 1); // lean forward when chasing
        const shoulderTwist = Math.sin(animT) * 0.04 * ms;

        // Attack with wind-up telegraph
        const windupTime = atkWindupMap.current.get(e.id) || 0;
        const isWindingUp = e.state === 'attack' && e.attackCooldown <= 0 && windupTime > 0;
        const windupPhase = Math.min(windupTime / 0.3, 1);
        const atkStrikeAnim = e.state === 'attack' && e.attackCooldown > ENEMY_ATTACK_COOLDOWN * 0.7;
        const atkAnim = isWindingUp
          ? -1.2 * windupPhase // Raise weapon
          : (atkStrikeAnim ? 1.5 : 0); // Swing down
        const atkBodyTwist = isWindingUp ? -0.15 * windupPhase : (atkStrikeAnim ? 0.2 : 0);

        const bodyMat = flash ? hitMat : (isBandit ? banditBodyMat : wolfBodyMat);

        if (isBandit) {
          return (
            <group key={e.id} position={[e.position[0], e.position[1] + bodyBob, e.position[2]]}>
              <group rotation={[0, faceAngle, 0]}>
                <group rotation={[bodyLean - staggerRecoil, atkBodyTwist + shoulderTwist, 0]}>
                  {/* Torso */}
                  <mesh geometry={boxGeo} scale={[0.65, 0.75, 0.35]} material={bodyMat} castShadow />
                  {/* Head */}
                  <mesh position={[0, 0.55, 0]} geometry={boxGeo}
                    scale={[0.35, 0.38, 0.35]} material={flash ? hitMat : banditHeadMat} castShadow />
                  <mesh position={[0, 0.6, -0.02]} geometry={boxGeo}
                    scale={[0.38, 0.25, 0.38]} material={bodyMat} castShadow />
                  {/* Left arm */}
                  <group position={[-0.42, 0.05, 0]} rotation={[armAnim, 0, 0]}>
                    <mesh geometry={boxGeo} scale={[0.18, 0.55, 0.18]} material={bodyMat} castShadow />
                  </group>
                  {/* Right arm + weapon */}
                  <group position={[0.42, 0.05, 0]} rotation={[armAnimOff + atkAnim, 0, 0]}>
                    <mesh geometry={boxGeo} scale={[0.18, 0.55, 0.18]} material={bodyMat} castShadow />
                    <mesh position={[0, -0.45, 0.1]} geometry={boxGeo}
                      scale={[0.05, 0.6, 0.03]} material={banditWeaponMat} castShadow />
                  </group>
                </group>
                {/* Legs outside body twist group */}
                <group position={[-0.16, -0.55, 0]} rotation={[-legAnim, 0, 0]}>
                  <mesh geometry={boxGeo} scale={[0.22, 0.4, 0.22]} material={flash ? hitMat : banditLegMat} castShadow />
                  <mesh position={[0, -0.25, 0]} geometry={boxGeo}
                    scale={[0.2, 0.15, 0.24]} material={flash ? hitMat : banditBootMat} castShadow />
                </group>
                <group position={[0.16, -0.55, 0]} rotation={[-legAnimOff, 0, 0]}>
                  <mesh geometry={boxGeo} scale={[0.22, 0.4, 0.22]} material={flash ? hitMat : banditLegMat} castShadow />
                  <mesh position={[0, -0.25, 0]} geometry={boxGeo}
                    scale={[0.2, 0.15, 0.24]} material={flash ? hitMat : banditBootMat} castShadow />
                </group>
              </group>
              {/* HP bar */}
              {hp < 1 && (
                <group position={[0, 1.3, 0]}>
                  <mesh geometry={planeGeo} scale={[0.8, 0.1, 1]} material={hpBgMat} />
                  <mesh position={[(hp - 1) * 0.4, 0, 0.001]} geometry={planeGeo}
                    scale={[0.8 * hp, 0.1, 1]} material={hp > 0.5 ? hpGreenMat : hpRedMat} />
                </group>
              )}
              {(isChasing || e.state === 'attack') && (
                <mesh position={[0, 1.55, 0]} geometry={planeGeo}
                  scale={[0.12, 0.12, 1]} material={aggroMat} />
              )}
            </group>
          );
        }

        // === WOLF — more aggressive animation ===
        const wolfLunge = e.state === 'chase' ? Math.sin(animT * 1.5) * 0.08 : 0;
        const wolfCrouch = e.state === 'attack' ? -0.08 : 0;
        const wolfSnarlHead = e.state === 'attack' || isChasing ? -0.15 : 0;
        const wolfTailAggro = (isChasing || e.state === 'attack')
          ? Math.sin(animT * 3) * 0.15 + 0.5 // stiff raised tail
          : Math.sin(animT * 1.5) * 0.3; // relaxed wag

        return (
          <group key={e.id} position={[e.position[0], e.position[1] + bodyBob + wolfCrouch, e.position[2]]}>
            <group rotation={[0, faceAngle, 0]}>
              <group rotation={[bodyLean - staggerRecoil + wolfLunge, 0, 0]}>
                <mesh geometry={boxGeo} scale={[0.4, 0.35, 0.8]} material={bodyMat} castShadow />
                <mesh position={[0, 0.05, 0.2]} geometry={boxGeo}
                  scale={[0.35, 0.3, 0.25]} material={flash ? hitMat : wolfLightMat} castShadow />
                {/* Head — snarl when aggressive */}
                <group position={[0, 0.15, 0.5]} rotation={[wolfSnarlHead, 0, 0]}>
                  <mesh geometry={boxGeo}
                    scale={[0.28, 0.25, 0.3]} material={bodyMat} castShadow />
                  <mesh position={[0, -0.05, 0.18]} geometry={boxGeo}
                    scale={[0.18, 0.12, 0.15]} material={flash ? hitMat : wolfLightMat} castShadow />
                  {/* Jaw open when attacking */}
                  {(e.state === 'attack' || isWindingUp) && (
                    <mesh position={[0, -0.12, 0.14]} geometry={boxGeo}
                      scale={[0.14, 0.05, 0.1]} material={bodyMat} castShadow />
                  )}
                  {/* Eyes */}
                  <mesh position={[-0.08, 0.07, 0.14]} geometry={boxGeo}
                    scale={[0.04, 0.04, 0.02]} material={wolfEyeMat} />
                  <mesh position={[0.08, 0.07, 0.14]} geometry={boxGeo}
                    scale={[0.04, 0.04, 0.02]} material={wolfEyeMat} />
                </group>
              </group>
              {/* Legs with proper gait */}
              <group position={[-0.14, -0.25, 0.2]} rotation={[-legAnim * 0.8, 0, 0]}>
                <mesh geometry={boxGeo} scale={[0.1, 0.35, 0.1]} material={bodyMat} castShadow />
              </group>
              <group position={[0.14, -0.25, 0.2]} rotation={[-legAnimOff * 0.8, 0, 0]}>
                <mesh geometry={boxGeo} scale={[0.1, 0.35, 0.1]} material={bodyMat} castShadow />
              </group>
              <group position={[-0.14, -0.25, -0.2]} rotation={[-legAnimOff * 0.8, 0, 0]}>
                <mesh geometry={boxGeo} scale={[0.1, 0.35, 0.1]} material={bodyMat} castShadow />
              </group>
              <group position={[0.14, -0.25, -0.2]} rotation={[-legAnim * 0.8, 0, 0]}>
                <mesh geometry={boxGeo} scale={[0.1, 0.35, 0.1]} material={bodyMat} castShadow />
              </group>
              {/* Tail */}
              <group position={[0, 0.1, -0.45]} rotation={[wolfTailAggro - 0.3, 0, 0]}>
                <mesh geometry={boxGeo} scale={[0.06, 0.06, 0.3]} material={bodyMat} castShadow />
              </group>
            </group>
            {hp < 1 && (
              <group position={[0, 0.7, 0]}>
                <mesh geometry={planeGeo} scale={[0.6, 0.08, 1]} material={hpBgMat} />
                <mesh position={[(hp - 1) * 0.3, 0, 0.001]} geometry={planeGeo}
                  scale={[0.6 * hp, 0.08, 1]} material={hp > 0.5 ? hpGreenMat : hpRedMat} />
              </group>
            )}
            {(isChasing || e.state === 'attack') && (
              <mesh position={[0, 0.9, 0]} geometry={planeGeo}
                scale={[0.1, 0.1, 1]} material={aggroMat} />
            )}
          </group>
        );
      })}
    </group>
  );
}
