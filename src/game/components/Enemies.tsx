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

      // State transitions
      if (distToPlayer < e.attackRange) {
        newState = 'attack';
      } else if (distToPlayer < e.detectRange) {
        newState = 'chase';
      } else if (e.state === 'chase' || e.state === 'attack') {
        newState = 'patrol';
      } else if (e.state === 'idle') {
        newState = 'patrol';
      }

      // Behavior
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
        // Accumulate damage into ref instead of calling setState
        if (newCooldown <= 0) {
          pendingPlayerDamageRef.current += e.damage;
          newCooldown = ENEMY_ATTACK_COOLDOWN;
        }
        // Slight knockback push — enemy stops at attack range
      }

      const n = {
        ...e, position: newPos, state: newState as EnemyData['state'],
        attackCooldown: newCooldown, hitFlash: newFlash, patrolAngle: newAngle,
      };
      if (n.state !== e.state || n.attackCooldown !== e.attackCooldown || n.hitFlash !== e.hitFlash) changed = true;
      // Position always changes during patrol/chase
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
        const bodyColor = flash ? '#ff4444' : (isBandit ? '#6b3030' : '#5a4a3a');
        const headColor = flash ? '#ff6666' : (isBandit ? '#d4a574' : '#4a3a2a');
        const px = playerPositionRef.current?.x || 0;
        const pz = playerPositionRef.current?.z || 0;
        const faceAngle = Math.atan2(px - e.position[0], pz - e.position[2]);
        const hp = e.health / e.maxHealth;
        // Knockback visual: slight offset when hit
        const knockOffset = flash ? 0.15 : 0;
        const knockX = -Math.sin(faceAngle) * knockOffset;
        const knockZ = -Math.cos(faceAngle) * knockOffset;

        return (
          <group key={e.id} position={[e.position[0] + knockX, e.position[1], e.position[2] + knockZ]}>
            <group rotation={[0, faceAngle, 0]}>
              <mesh castShadow>
                <boxGeometry args={[isBandit ? 0.6 : 0.5, isBandit ? 0.8 : 0.5, isBandit ? 0.35 : 0.7]} />
                <meshLambertMaterial color={bodyColor} />
              </mesh>
              <mesh position={[0, isBandit ? 0.55 : 0.3, isBandit ? 0 : 0.15]} castShadow>
                <boxGeometry args={[isBandit ? 0.35 : 0.3, isBandit ? 0.35 : 0.25, isBandit ? 0.35 : 0.3]} />
                <meshLambertMaterial color={headColor} />
              </mesh>
              {isBandit && (
                <mesh position={[0.4, -0.1, 0]} rotation={[0, 0, -0.3]} castShadow>
                  <boxGeometry args={[0.08, 0.6, 0.05]} />
                  <meshLambertMaterial color="#888" />
                </mesh>
              )}
              {!isBandit && (
                <>
                  <mesh position={[-0.12, 0.45, 0.15]} castShadow>
                    <coneGeometry args={[0.06, 0.15, 4]} />
                    <meshLambertMaterial color={headColor} />
                  </mesh>
                  <mesh position={[0.12, 0.45, 0.15]} castShadow>
                    <coneGeometry args={[0.06, 0.15, 4]} />
                    <meshLambertMaterial color={headColor} />
                  </mesh>
                  <mesh position={[0, 0.1, -0.5]} rotation={[0.5, 0, 0]} castShadow>
                    <cylinderGeometry args={[0.04, 0.06, 0.4, 4]} />
                    <meshLambertMaterial color={bodyColor} />
                  </mesh>
                </>
              )}
            </group>
            {/* Health bar - always billboard facing camera */}
            {hp < 1 && (
              <group position={[0, isBandit ? 1.1 : 0.7, 0]}>
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
              <mesh position={[0, isBandit ? 1.35 : 0.95, 0]}>
                <planeGeometry args={[0.12, 0.12]} />
                <meshBasicMaterial color="#ff2222" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
