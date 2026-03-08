import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HorseData, HORSE_APPROACH_SPEED, HORSE_APPROACH_STOP_DIST } from '../systems/HorseData';
import { getTerrainHeight } from './Terrain';
import { resolveCollision } from '../systems/CollisionSystem';

interface Props {
  horse: HorseData;
  playerPositionRef: React.RefObject<THREE.Vector3>;
  onUpdateHorse: (updates: Partial<HorseData>) => void;
  isMounted: boolean;
}


const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const bodyMat = new THREE.MeshLambertMaterial({ color: '#6a4a2a' });
const bodyDarkMat = new THREE.MeshLambertMaterial({ color: '#4a3218' });
const maneMat = new THREE.MeshLambertMaterial({ color: '#2a1a08' });
const hoofMat = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });
const eyeMat = new THREE.MeshBasicMaterial({ color: '#111' });
const saddleMat = new THREE.MeshLambertMaterial({ color: '#5a2010' });

export function Horse({ horse, playerPositionRef, onUpdateHorse, isMounted }: Props) {
  const animRef = useRef(0);
  const moveSpeedRef = useRef(0);
  const rotRef = useRef(horse.rotation);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    animRef.current += dt;

    // Don't process movement if mounted (player controls it)
    if (horse.state === 'mounted' || isMounted) return;

    const playerPos = playerPositionRef.current;
    if (!playerPos) return;

    const dx = playerPos.x - horse.position[0];
    const dz = playerPos.z - horse.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (horse.state === 'called' || horse.state === 'approaching') {
      // Move toward player
      if (dist > HORSE_APPROACH_STOP_DIST) {
        const wantAngle = Math.atan2(dx, dz);
        let rotDiff = wantAngle - rotRef.current;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        // Speed-dependent turning — faster approach = wider arc
        const turnRate = dist > 10 ? 3 : 5;
        rotRef.current += rotDiff * Math.min(1, turnRate * dt);

        // Smooth speed with distance-based deceleration curve
        let targetSpeed: number;
        if (dist > 20) {
          targetSpeed = HORSE_APPROACH_SPEED; // full speed far away
        } else if (dist > 8) {
          targetSpeed = HORSE_APPROACH_SPEED * 0.7; // slow down approaching
        } else {
          // Smooth deceleration — ease into stop
          const stopFactor = (dist - HORSE_APPROACH_STOP_DIST) / (8 - HORSE_APPROACH_STOP_DIST);
          targetSpeed = HORSE_APPROACH_SPEED * 0.4 * Math.max(0.15, stopFactor);
        }
        moveSpeedRef.current = THREE.MathUtils.lerp(moveSpeedRef.current, targetSpeed, dt * 4);

        const spd = moveSpeedRef.current;
        let nx = horse.position[0] + Math.sin(rotRef.current) * spd * dt;
        let nz = horse.position[2] + Math.cos(rotRef.current) * spd * dt;

        // Collision
        const resolved = resolveCollision(nx, nz, 0.8);
        nx = resolved.x;
        nz = resolved.z;

        const ny = getTerrainHeight(nx, nz);

        onUpdateHorse({
          position: [nx, ny, nz],
          rotation: rotRef.current,
          state: 'approaching',
        });

        animRef.current += dt * moveSpeedRef.current * 0.8;
      } else {
        // Arrived — gentle final stop
        moveSpeedRef.current = THREE.MathUtils.lerp(moveSpeedRef.current, 0, dt * 8);
        if (moveSpeedRef.current < 0.1) {
          moveSpeedRef.current = 0;
          onUpdateHorse({ state: 'waiting' });
        }
      }
    } else if (horse.state === 'waiting') {
      // If player walks far away, go idle
      if (dist > 50) {
        onUpdateHorse({ state: 'idle' });
      }
      moveSpeedRef.current = THREE.MathUtils.lerp(moveSpeedRef.current, 0, dt * 6);
    } else {
      // idle — gentle breathing deceleration
      moveSpeedRef.current = THREE.MathUtils.lerp(moveSpeedRef.current, 0, dt * 6);
    }
  });

  // Don't render if mounted (player renders the horse body)
  if (horse.state === 'mounted' || isMounted) return null;

  // Cull if far from player
  const playerPos = playerPositionRef.current;
  if (playerPos) {
    const dx = playerPos.x - horse.position[0];
    const dz = playerPos.z - horse.position[2];
    if (dx * dx + dz * dz > 200 * 200) return null;
  }

  const t = animRef.current;
  const ms = moveSpeedRef.current / HORSE_APPROACH_SPEED; // 0-1 normalized

  // Idle animation
  const breath = Math.sin(t * 1.2) * 0.025;
  const headNod = Math.sin(t * 0.6) * 0.06;
  const tailSwish = Math.sin(t * 1.8) * 0.35;
  const earFlick = Math.sin(t * 2.5) > 0.8 ? 0.1 : 0;
  const weightShift = Math.sin(t * 0.3) * 0.01;

  // Locomotion
  const legFL = Math.sin(t) * 0.5 * ms;
  const legFR = Math.sin(t + Math.PI * 0.5) * 0.5 * ms;
  const legBL = Math.sin(t + Math.PI) * 0.5 * ms;
  const legBR = Math.sin(t + Math.PI * 1.5) * 0.5 * ms;
  const bodyBob = Math.abs(Math.sin(t * 2)) * 0.08 * ms;
  const neckMotion = Math.sin(t * 2 + 0.5) * 0.06 * ms;

  return (
    <group position={[horse.position[0], horse.position[1], horse.position[2]]}
      rotation={[0, rotRef.current, 0]}>
      {/* Body with breathing */}
      <mesh position={[weightShift, 1.1 + breath + bodyBob, 0]} geometry={boxGeo}
        scale={[0.7, 0.65, 1.6]} material={bodyMat} castShadow />
      <mesh position={[weightShift, 1.15 + breath + bodyBob, 0.6]} geometry={boxGeo}
        scale={[0.6, 0.55, 0.4]} material={bodyMat} castShadow />
      <mesh position={[weightShift, 1.05 + breath + bodyBob, -0.65]} geometry={boxGeo}
        scale={[0.55, 0.5, 0.35]} material={bodyMat} castShadow />

      {/* Neck */}
      <group position={[0, 1.55 + breath + bodyBob + neckMotion, 0.8]} rotation={[0.5 + headNod * 0.3, 0, 0]}>
        <mesh geometry={boxGeo} scale={[0.35, 0.7, 0.35]} material={bodyMat} castShadow />
      </group>
      {/* Head */}
      <group position={[0, 1.85 + breath + bodyBob + neckMotion, 1.15 + headNod * 0.2]}>
        <mesh geometry={boxGeo} scale={[0.3, 0.28, 0.45]} material={bodyMat} castShadow />
        <mesh position={[0, -0.08, 0.25]} geometry={boxGeo}
          scale={[0.22, 0.18, 0.25]} material={bodyDarkMat} castShadow />
        <mesh position={[-0.14, 0.04, 0.08]} geometry={boxGeo}
          scale={[0.04, 0.06, 0.04]} material={eyeMat} />
        <mesh position={[0.14, 0.04, 0.08]} geometry={boxGeo}
          scale={[0.04, 0.06, 0.04]} material={eyeMat} />
        {/* Ears */}
        <mesh position={[-0.08, 0.2, 0]} rotation={[earFlick, 0, -0.1]} geometry={boxGeo}
          scale={[0.06, 0.14, 0.06]} material={bodyDarkMat} castShadow />
        <mesh position={[0.08, 0.2, 0]} rotation={[-earFlick * 0.5, 0, 0.1]} geometry={boxGeo}
          scale={[0.06, 0.14, 0.06]} material={bodyDarkMat} castShadow />
      </group>
      {/* Mane */}
      <mesh position={[0, 1.65 + breath, 0.65]} rotation={[0.4, 0, 0]}
        geometry={boxGeo} scale={[0.08, 0.5, 0.3]} material={maneMat} castShadow />
      {/* Saddle */}
      <mesh position={[0, 1.5 + breath + bodyBob, 0.05]} geometry={boxGeo}
        scale={[0.55, 0.12, 0.5]} material={saddleMat} castShadow />
      <mesh position={[0, 1.55 + breath + bodyBob, -0.2]} geometry={boxGeo}
        scale={[0.3, 0.2, 0.1]} material={saddleMat} castShadow />

      {/* Legs */}
      {([
        [-0.22, 0.5, legFL],
        [0.22, 0.5, legFR],
        [-0.22, -0.5, legBL],
        [0.22, -0.5, legBR],
      ] as [number, number, number][]).map(([lx, lz, anim], i) => (
        <group key={i} position={[lx, 0, lz]} rotation={[anim, 0, 0]}>
          <mesh position={[0, 0.55, 0]} geometry={boxGeo}
            scale={[0.16, 0.7, 0.16]} material={bodyMat} castShadow />
          <mesh position={[0, 0.12, 0]} geometry={boxGeo}
            scale={[0.14, 0.35, 0.14]} material={bodyDarkMat} castShadow />
          <mesh position={[0, -0.02, 0]} geometry={boxGeo}
            scale={[0.15, 0.08, 0.18]} material={hoofMat} castShadow />
        </group>
      ))}

      {/* Tail */}
      <group position={[0, 1.0, -0.95]} rotation={[tailSwish - 0.3, Math.sin(t * 0.9) * 0.12, 0]}>
        <mesh geometry={boxGeo} scale={[0.06, 0.5, 0.06]} material={maneMat} castShadow />
        <mesh position={[0, -0.28, 0]} geometry={boxGeo}
          scale={[0.08, 0.15, 0.08]} material={maneMat} castShadow />
      </group>
    </group>
  );
}
