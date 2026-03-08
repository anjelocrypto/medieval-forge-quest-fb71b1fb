import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EnemyData, ENEMY_ATTACK_COOLDOWN, ENEMY_DESPAWN_TIME } from '../systems/EnemyData';
import { getTerrainHeight } from './Terrain';
import { COLORS } from '../constants';

interface Props {
  enemies: EnemyData[];
  playerPositionRef: React.RefObject<THREE.Vector3>;
  onEnemiesUpdate: (enemies: EnemyData[]) => void;
  onPlayerDamage: (amount: number) => void;
}

export function Enemies({ enemies, playerPositionRef, onEnemiesUpdate, onPlayerDamage }: Props) {
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
      } else if (e.state === 'chase') {
        newState = 'patrol'; // lost player
      } else if (e.state === 'idle') {
        // Transition to patrol after a moment
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
          const moveSpeed = e.speed * 0.4;
          newPos[0] += (pdx / pd) * moveSpeed * dt;
          newPos[2] += (pdz / pd) * moveSpeed * dt;
          newPos[1] = getTerrainHeight(newPos[0], newPos[2]) + 0.9;
        }
      } else if (newState === 'attack') {
        if (newCooldown <= 0) {
          onPlayerDamage(e.damage);
          newCooldown = ENEMY_ATTACK_COOLDOWN;
        }
      }

      const n = {
        ...e,
        position: newPos,
        state: newState as EnemyData['state'],
        attackCooldown: newCooldown,
        hitFlash: newFlash,
        patrolAngle: newAngle,
      };

      if (n.state !== e.state || n.position !== e.position || n.attackCooldown !== e.attackCooldown || n.hitFlash !== e.hitFlash) {
        changed = true;
      }
      return n;
    });

    // Remove despawned
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
          const fadeOpacity = Math.max(0, 1 - timer / ENEMY_DESPAWN_TIME);
          return (
            <group key={e.id} position={[e.position[0], e.position[1] - 0.5, e.position[2]]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <boxGeometry args={[0.6, 0.8, 0.3]} />
                <meshLambertMaterial color="#4a2020" transparent opacity={fadeOpacity} />
              </mesh>
            </group>
          );
        }

        const isBandit = e.type === 'bandit';
        const isFlashing = e.hitFlash > 0;
        const bodyColor = isFlashing ? '#ff4444' : (isBandit ? '#6b3030' : '#5a4a3a');
        const headColor = isFlashing ? '#ff6666' : (isBandit ? '#d4a574' : '#4a3a2a');

        // Face toward player when chasing/attacking
        const px = playerPositionRef.current?.x || 0;
        const pz = playerPositionRef.current?.z || 0;
        const faceAngle = Math.atan2(px - e.position[0], pz - e.position[2]);

        // Health bar
        const healthPct = e.health / e.maxHealth;

        return (
          <group key={e.id} position={e.position}>
            <group rotation={[0, faceAngle, 0]}>
              {/* Body */}
              <mesh position={[0, 0, 0]} castShadow>
                <boxGeometry args={[isBandit ? 0.6 : 0.5, isBandit ? 0.8 : 0.5, isBandit ? 0.35 : 0.7]} />
                <meshLambertMaterial color={bodyColor} />
              </mesh>
              {/* Head */}
              <mesh position={[0, isBandit ? 0.55 : 0.3, isBandit ? 0 : 0.15]} castShadow>
                <boxGeometry args={[isBandit ? 0.35 : 0.3, isBandit ? 0.35 : 0.25, isBandit ? 0.35 : 0.3]} />
                <meshLambertMaterial color={headColor} />
              </mesh>
              {isBandit && (
                // Weapon (sword in hand)
                <mesh position={[0.4, -0.1, 0]} rotation={[0, 0, -0.3]} castShadow>
                  <boxGeometry args={[0.08, 0.6, 0.05]} />
                  <meshLambertMaterial color="#888" />
                </mesh>
              )}
              {!isBandit && (
                // Wolf ears
                <>
                  <mesh position={[-0.12, 0.45, 0.15]} castShadow>
                    <coneGeometry args={[0.06, 0.15, 4]} />
                    <meshLambertMaterial color={headColor} />
                  </mesh>
                  <mesh position={[0.12, 0.45, 0.15]} castShadow>
                    <coneGeometry args={[0.06, 0.15, 4]} />
                    <meshLambertMaterial color={headColor} />
                  </mesh>
                  {/* Tail */}
                  <mesh position={[0, 0.1, -0.5]} rotation={[0.5, 0, 0]} castShadow>
                    <cylinderGeometry args={[0.04, 0.06, 0.4, 4]} />
                    <meshLambertMaterial color={bodyColor} />
                  </mesh>
                </>
              )}
            </group>
            {/* Health bar */}
            {healthPct < 1 && (
              <group position={[0, isBandit ? 1.1 : 0.7, 0]}>
                <mesh>
                  <planeGeometry args={[0.8, 0.08]} />
                  <meshBasicMaterial color="#333" />
                </mesh>
                <mesh position={[(healthPct - 1) * 0.4, 0, 0.001]}>
                  <planeGeometry args={[0.8 * healthPct, 0.08]} />
                  <meshBasicMaterial color={healthPct > 0.5 ? '#44aa44' : '#cc4444'} />
                </mesh>
              </group>
            )}
            {/* Aggro indicator */}
            {(e.state === 'chase' || e.state === 'attack') && (
              <mesh position={[0, isBandit ? 1.3 : 0.9, 0]}>
                <planeGeometry args={[0.15, 0.15]} />
                <meshBasicMaterial color="#ff3333" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
