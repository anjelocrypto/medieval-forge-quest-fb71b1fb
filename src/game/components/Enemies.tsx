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

export function Enemies({ enemies, playerPositionRef, onEnemiesUpdate, pendingPlayerDamageRef }: Props) {
  const deathTimers = useRef<Map<string, number>>(new Map());
  const animTimers = useRef<Map<string, number>>(new Map());

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const playerPos = playerPositionRef.current;
    if (!playerPos) return;

    let changed = false;
    const updated = enemies.map(e => {
      if (e.state === 'dead') {
        const timer = (deathTimers.current.get(e.id) || 0) + dt;
        deathTimers.current.set(e.id, timer);
        return e;
      }

      // Animation timer
      const at = (animTimers.current.get(e.id) || 0) + dt * (e.state === 'chase' ? 10 : 5);
      animTimers.current.set(e.id, at);

      const dx = playerPos.x - e.position[0];
      const dz = playerPos.z - e.position[2];
      const distToPlayer = Math.sqrt(dx * dx + dz * dz);
      const dirX = distToPlayer > 0.1 ? dx / distToPlayer : 0;
      const dirZ = distToPlayer > 0.1 ? dz / distToPlayer : 0;

      let newState = e.state;
      let newPos: [number, number, number] = [...e.position];
      let newCooldown = Math.max(0, e.attackCooldown - dt);
      let newFlash = Math.max(0, e.hitFlash - dt);
      let newAngle = e.patrolAngle;

      if (distToPlayer < e.attackRange) {
        newState = 'attack';
      } else if (distToPlayer < e.detectRange) {
        newState = 'chase';
      } else if (e.state === 'chase' || e.state === 'attack') {
        newState = 'patrol';
      } else if (e.state === 'idle') {
        newState = 'patrol';
      }

      if (newState === 'chase') {
        newPos[0] += dirX * e.speed * dt;
        newPos[2] += dirZ * e.speed * dt;
        newPos[1] = getTerrainHeight(newPos[0], newPos[2]) + 0.9;
      } else if (newState === 'patrol') {
        newAngle += dt * 0.3;
        const tx = e.patrolCenter[0] + Math.cos(newAngle) * e.patrolRadius;
        const tz = e.patrolCenter[2] + Math.sin(newAngle) * e.patrolRadius;
        const pdx = tx - newPos[0];
        const pdz = tz - newPos[2];
        const pd = Math.sqrt(pdx * pdx + pdz * pdz);
        if (pd > 0.5) {
          newPos[0] += (pdx / pd) * e.speed * 0.4 * dt;
          newPos[2] += (pdz / pd) * e.speed * 0.4 * dt;
          newPos[1] = getTerrainHeight(newPos[0], newPos[2]) + 0.9;
        }
      } else if (newState === 'attack') {
        if (newCooldown <= 0) {
          pendingPlayerDamageRef.current += e.damage;
          newCooldown = ENEMY_ATTACK_COOLDOWN;
        }
      }

      const n = {
        ...e, position: newPos, state: newState as EnemyData['state'],
        attackCooldown: newCooldown, hitFlash: newFlash, patrolAngle: newAngle,
      };
      if (n.state !== e.state || n.attackCooldown !== e.attackCooldown || n.hitFlash !== e.hitFlash) changed = true;
      if (newState === 'chase' || newState === 'patrol') changed = true;
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

        if (e.state === 'dead') {
          const timer = deathTimers.current.get(e.id) || 0;
          const fade = Math.max(0, 1 - timer / ENEMY_DESPAWN_TIME);
          return (
            <group key={e.id} position={[e.position[0], e.position[1] - 0.5, e.position[2]]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <boxGeometry args={[0.6, 0.8, 0.3]} />
                <meshLambertMaterial color="#4a2020" transparent opacity={fade} />
              </mesh>
            </group>
          );
        }

        const isBandit = e.type === 'bandit';
        const flash = e.hitFlash > 0;
        const px = playerPositionRef.current?.x || 0;
        const pz = playerPositionRef.current?.z || 0;
        const faceAngle = Math.atan2(px - e.position[0], pz - e.position[2]);
        const hp = e.health / e.maxHealth;
        const knockOffset = flash ? 0.15 : 0;
        const knockX = -Math.sin(faceAngle) * knockOffset;
        const knockZ = -Math.cos(faceAngle) * knockOffset;

        const isMoving = e.state === 'chase' || e.state === 'patrol';
        const ms = isMoving ? (e.state === 'chase' ? 1 : 0.4) : 0;
        const legAnim = Math.sin(animT) * 0.5 * ms;
        const armAnim = Math.sin(animT) * 0.4 * ms;
        const bodyBob = Math.abs(Math.sin(animT * 2)) * 0.04 * ms;
        const atkAnim = e.state === 'attack' ? Math.sin(Date.now() * 0.008) * 0.8 : 0;

        if (isBandit) {
          const bodyColor = flash ? '#ff4444' : '#5a3828';
          const tunicColor = flash ? '#ff6666' : '#6b4030';
          const headColor = flash ? '#ff8888' : '#c4a070';
          return (
            <group key={e.id} position={[e.position[0] + knockX, e.position[1] + bodyBob, e.position[2] + knockZ]}>
              <group rotation={[0, faceAngle, 0]}>
                {/* ── Torso ── */}
                <mesh position={[0, 0, 0]} castShadow>
                  <boxGeometry args={[0.65, 0.75, 0.35]} />
                  <meshLambertMaterial color={tunicColor} />
                </mesh>
                {/* Leather vest */}
                <mesh position={[0, 0.05, 0.18]} castShadow>
                  <boxGeometry args={[0.45, 0.5, 0.04]} />
                  <meshLambertMaterial color="#3a2510" />
                </mesh>
                {/* Belt */}
                <mesh position={[0, -0.25, 0]} castShadow>
                  <boxGeometry args={[0.7, 0.08, 0.38]} />
                  <meshLambertMaterial color="#2a1a0a" />
                </mesh>

                {/* ── Head ── */}
                <group position={[0, 0.55, 0]}>
                  <mesh castShadow>
                    <boxGeometry args={[0.35, 0.38, 0.35]} />
                    <meshLambertMaterial color={headColor} />
                  </mesh>
                  {/* Hood / head wrap */}
                  <mesh position={[0, 0.05, -0.02]} castShadow>
                    <boxGeometry args={[0.38, 0.25, 0.38]} />
                    <meshLambertMaterial color={bodyColor} />
                  </mesh>
                  {/* Eyes */}
                  <mesh position={[0, -0.02, 0.175]}>
                    <boxGeometry args={[0.2, 0.04, 0.02]} />
                    <meshLambertMaterial color="#1a1a1a" />
                  </mesh>
                </group>

                {/* ── Left arm ── */}
                <group position={[-0.42, 0.05, 0]} rotation={[armAnim, 0, 0]}>
                  <mesh position={[0, -0.1, 0]} castShadow>
                    <boxGeometry args={[0.18, 0.55, 0.18]} />
                    <meshLambertMaterial color={tunicColor} />
                  </mesh>
                  <mesh position={[0, -0.4, 0]} castShadow>
                    <boxGeometry args={[0.14, 0.12, 0.14]} />
                    <meshLambertMaterial color={headColor} />
                  </mesh>
                </group>

                {/* ── Right arm + weapon ── */}
                <group position={[0.42, 0.05, 0]} rotation={[-armAnim + atkAnim, 0, 0]}>
                  <mesh position={[0, -0.1, 0]} castShadow>
                    <boxGeometry args={[0.18, 0.55, 0.18]} />
                    <meshLambertMaterial color={tunicColor} />
                  </mesh>
                  <mesh position={[0, -0.4, 0]} castShadow>
                    <boxGeometry args={[0.14, 0.12, 0.14]} />
                    <meshLambertMaterial color={headColor} />
                  </mesh>
                  {/* Sword */}
                  <mesh position={[0, -0.55, 0.1]} castShadow>
                    <boxGeometry args={[0.05, 0.6, 0.03]} />
                    <meshLambertMaterial color="#999" />
                  </mesh>
                  <mesh position={[0, -0.22, 0.1]} castShadow>
                    <boxGeometry args={[0.16, 0.04, 0.05]} />
                    <meshLambertMaterial color="#6b4f10" />
                  </mesh>
                </group>

                {/* ── Legs ── */}
                <group position={[-0.16, -0.55, 0]} rotation={[-legAnim, 0, 0]}>
                  <mesh position={[0, -0.1, 0]} castShadow>
                    <boxGeometry args={[0.22, 0.4, 0.22]} />
                    <meshLambertMaterial color="#3a3020" />
                  </mesh>
                  <mesh position={[0, -0.35, 0]} castShadow>
                    <boxGeometry args={[0.2, 0.15, 0.24]} />
                    <meshLambertMaterial color="#2a1a0a" />
                  </mesh>
                </group>
                <group position={[0.16, -0.55, 0]} rotation={[legAnim, 0, 0]}>
                  <mesh position={[0, -0.1, 0]} castShadow>
                    <boxGeometry args={[0.22, 0.4, 0.22]} />
                    <meshLambertMaterial color="#3a3020" />
                  </mesh>
                  <mesh position={[0, -0.35, 0]} castShadow>
                    <boxGeometry args={[0.2, 0.15, 0.24]} />
                    <meshLambertMaterial color="#2a1a0a" />
                  </mesh>
                </group>
              </group>

              {/* Health bar */}
              {hp < 1 && (
                <group position={[0, 1.3, 0]}>
                  <mesh>
                    <planeGeometry args={[0.8, 0.1]} />
                    <meshBasicMaterial color="#222" transparent opacity={0.8} />
                  </mesh>
                  <mesh position={[(hp - 1) * 0.4, 0, 0.001]}>
                    <planeGeometry args={[0.8 * hp, 0.1]} />
                    <meshBasicMaterial color={hp > 0.5 ? '#44aa44' : '#cc4444'} />
                  </mesh>
                </group>
              )}
              {(e.state === 'chase' || e.state === 'attack') && (
                <mesh position={[0, 1.55, 0]}>
                  <planeGeometry args={[0.12, 0.12]} />
                  <meshBasicMaterial color="#ff2222" />
                </mesh>
              )}
            </group>
          );
        }

        // ── Wolf ──
        const wolfColor = flash ? '#ff4444' : '#5a4a3a';
        const wolfLight = flash ? '#ff6666' : '#7a6a5a';
        return (
          <group key={e.id} position={[e.position[0] + knockX, e.position[1] + bodyBob, e.position[2] + knockZ]}>
            <group rotation={[0, faceAngle, 0]}>
              {/* Body */}
              <mesh position={[0, 0, 0]} castShadow>
                <boxGeometry args={[0.4, 0.35, 0.8]} />
                <meshLambertMaterial color={wolfColor} />
              </mesh>
              {/* Chest */}
              <mesh position={[0, 0.05, 0.2]} castShadow>
                <boxGeometry args={[0.35, 0.3, 0.25]} />
                <meshLambertMaterial color={wolfLight} />
              </mesh>
              {/* Head */}
              <group position={[0, 0.15, 0.5]}>
                <mesh castShadow>
                  <boxGeometry args={[0.28, 0.25, 0.3]} />
                  <meshLambertMaterial color={wolfColor} />
                </mesh>
                {/* Snout */}
                <mesh position={[0, -0.05, 0.18]} castShadow>
                  <boxGeometry args={[0.18, 0.12, 0.15]} />
                  <meshLambertMaterial color={wolfLight} />
                </mesh>
                {/* Ears */}
                <mesh position={[-0.1, 0.15, -0.02]} castShadow>
                  <coneGeometry args={[0.06, 0.14, 4]} />
                  <meshLambertMaterial color={wolfColor} />
                </mesh>
                <mesh position={[0.1, 0.15, -0.02]} castShadow>
                  <coneGeometry args={[0.06, 0.14, 4]} />
                  <meshLambertMaterial color={wolfColor} />
                </mesh>
                {/* Eyes */}
                <mesh position={[-0.08, 0.02, 0.14]}>
                  <boxGeometry args={[0.04, 0.04, 0.02]} />
                  <meshBasicMaterial color="#ccaa00" />
                </mesh>
                <mesh position={[0.08, 0.02, 0.14]}>
                  <boxGeometry args={[0.04, 0.04, 0.02]} />
                  <meshBasicMaterial color="#ccaa00" />
                </mesh>
              </group>
              {/* Tail */}
              <mesh position={[0, 0.1, -0.5]} rotation={[0.5 + Math.sin(animT * 0.5) * 0.3, 0, 0]} castShadow>
                <boxGeometry args={[0.08, 0.08, 0.35]} />
                <meshLambertMaterial color={wolfColor} />
              </mesh>
              {/* Front legs */}
              <group position={[-0.14, -0.25, 0.2]} rotation={[-legAnim * 0.7, 0, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.1, 0.35, 0.1]} />
                  <meshLambertMaterial color={wolfColor} />
                </mesh>
              </group>
              <group position={[0.14, -0.25, 0.2]} rotation={[legAnim * 0.7, 0, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.1, 0.35, 0.1]} />
                  <meshLambertMaterial color={wolfColor} />
                </mesh>
              </group>
              {/* Back legs */}
              <group position={[-0.14, -0.25, -0.2]} rotation={[legAnim * 0.7, 0, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.1, 0.35, 0.1]} />
                  <meshLambertMaterial color={wolfColor} />
                </mesh>
              </group>
              <group position={[0.14, -0.25, -0.2]} rotation={[-legAnim * 0.7, 0, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.1, 0.35, 0.1]} />
                  <meshLambertMaterial color={wolfColor} />
                </mesh>
              </group>
            </group>

            {/* Health bar */}
            {hp < 1 && (
              <group position={[0, 0.7, 0]}>
                <mesh>
                  <planeGeometry args={[0.6, 0.08]} />
                  <meshBasicMaterial color="#222" transparent opacity={0.8} />
                </mesh>
                <mesh position={[(hp - 1) * 0.3, 0, 0.001]}>
                  <planeGeometry args={[0.6 * hp, 0.08]} />
                  <meshBasicMaterial color={hp > 0.5 ? '#44aa44' : '#cc4444'} />
                </mesh>
              </group>
            )}
            {(e.state === 'chase' || e.state === 'attack') && (
              <mesh position={[0, 0.9, 0]}>
                <planeGeometry args={[0.1, 0.1]} />
                <meshBasicMaterial color="#ff2222" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}