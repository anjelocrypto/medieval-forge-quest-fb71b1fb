/**
 * Horse — companion horse with smooth ref-based approach simulation.
 * Position/rotation are ref-driven during approach. React state only for
 * high-level transitions (called→approaching→waiting→idle).
 * Animation is driven by actual velocity, not state labels.
 */
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HorseData, HORSE_APPROACH_SPEED, HORSE_APPROACH_STOP_DIST } from '../systems/HorseData';
import { getTerrainHeight } from './Terrain';
import { getBridgeHeight } from '../world/BridgeData';
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
  const groupRef = useRef<THREE.Group>(null!);
  const animTimeRef = useRef(0);
  const moveSpeedRef = useRef(0);
  const rotRef = useRef(horse.rotation);
  // Ref-based position — sole authority during approach
  const posRef = useRef<[number, number, number]>([...horse.position]);
  // Track last committed state to avoid redundant React updates
  const lastStateRef = useRef(horse.state);
  // Smooth terrain Y for visual interpolation
  const smoothYRef = useRef(horse.position[1]);

  // Sync posRef from prop when state transitions externally (mount/dismount/call)
  useEffect(() => {
    if (horse.state !== lastStateRef.current) {
      posRef.current = [...horse.position];
      rotRef.current = horse.rotation;
      smoothYRef.current = horse.position[1];
      lastStateRef.current = horse.state;
    }
  }, [horse.state, horse.position, horse.rotation]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    animTimeRef.current += dt;

    // Don't process if mounted — Player.tsx is sole authority
    if (horse.state === 'mounted' || isMounted) return;

    const playerPos = playerPositionRef.current;
    if (!playerPos) return;

    const [hx, , hz] = posRef.current;
    const dx = playerPos.x - hx;
    const dz = playerPos.z - hz;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (horse.state === 'called' || horse.state === 'approaching') {
      if (dist > HORSE_APPROACH_STOP_DIST) {
        // === TURNING — smooth arc with speed-dependent rate ===
        const wantAngle = Math.atan2(dx, dz);
        let rotDiff = wantAngle - rotRef.current;
        // Wrap to [-PI, PI]
        if (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        if (rotDiff < -Math.PI) rotDiff += Math.PI * 2;

        // Faster turn when slow/stopped, wider arcs at speed
        const speedRatio = moveSpeedRef.current / HORSE_APPROACH_SPEED;
        const turnRate = THREE.MathUtils.lerp(6, 2.5, speedRatio);
        // Exponential smoothing — never snap
        rotRef.current += rotDiff * (1 - Math.exp(-turnRate * dt));
        // Wrap
        if (rotRef.current > Math.PI) rotRef.current -= Math.PI * 2;
        if (rotRef.current < -Math.PI) rotRef.current += Math.PI * 2;

        // === SPEED — smooth acceleration with distance-based target ===
        let targetSpeed: number;
        if (dist > 30) {
          targetSpeed = HORSE_APPROACH_SPEED;
        } else if (dist > 12) {
          // Smooth blend from full to 60%
          const t = (dist - 12) / 18;
          targetSpeed = HORSE_APPROACH_SPEED * (0.6 + 0.4 * t);
        } else {
          // Final approach — smooth cubic ease to stop
          const t = Math.max(0, (dist - HORSE_APPROACH_STOP_DIST) / (12 - HORSE_APPROACH_STOP_DIST));
          targetSpeed = HORSE_APPROACH_SPEED * 0.5 * t * t; // quadratic decel
        }

        // Exponential speed smoothing — prevents frame-to-frame jitter
        moveSpeedRef.current += (targetSpeed - moveSpeedRef.current) * (1 - Math.exp(-5 * dt));

        // === MOVEMENT — ref-based, no React state ===
        const spd = moveSpeedRef.current;
        let nx = hx + Math.sin(rotRef.current) * spd * dt;
        let nz = hz + Math.cos(rotRef.current) * spd * dt;

        // Collision resolve
        const resolved = resolveCollision(nx, nz, 0.8);
        nx = resolved.x;
        nz = resolved.z;

        // Terrain/bridge grounding
        const bridgeY = getBridgeHeight(nx, nz);
        const rawY = getTerrainHeight(nx, nz);
        const targetY = bridgeY !== null ? bridgeY : rawY;

        // Smooth Y interpolation to prevent terrain snapping
        smoothYRef.current += (targetY - smoothYRef.current) * (1 - Math.exp(-12 * dt));

        posRef.current = [nx, smoothYRef.current, nz];

        // Advance animation proportional to real speed
        animTimeRef.current += dt * spd * 0.7;

        // Transition state only once: called → approaching
        if (lastStateRef.current !== 'approaching') {
          lastStateRef.current = 'approaching';
          onUpdateHorse({ state: 'approaching' });
        }
      } else {
        // === ARRIVAL — smooth decel to zero, then transition ===
        moveSpeedRef.current *= Math.exp(-8 * dt); // exponential decay

        if (moveSpeedRef.current < 0.05) {
          moveSpeedRef.current = 0;
          if (lastStateRef.current !== 'waiting') {
            lastStateRef.current = 'waiting';
            // Commit final position to React state
            onUpdateHorse({
              state: 'waiting',
              position: [...posRef.current],
              rotation: rotRef.current,
            });
          }
        }
      }
    } else if (horse.state === 'waiting') {
      // Gentle idle speed decay
      moveSpeedRef.current *= Math.exp(-6 * dt);
      if (moveSpeedRef.current < 0.01) moveSpeedRef.current = 0;

      // If player walks far, go idle
      if (dist > 50 && lastStateRef.current !== 'idle') {
        lastStateRef.current = 'idle';
        onUpdateHorse({ state: 'idle', position: [...posRef.current], rotation: rotRef.current });
      }
    } else {
      // Idle
      moveSpeedRef.current *= Math.exp(-6 * dt);
      if (moveSpeedRef.current < 0.01) moveSpeedRef.current = 0;
    }

    // === APPLY TO VISUAL GROUP (ref-based, no React re-render) ===
    if (groupRef.current) {
      groupRef.current.position.set(posRef.current[0], posRef.current[1], posRef.current[2]);
      groupRef.current.rotation.set(0, rotRef.current, 0);
    }
  });

  // Don't render if mounted (player renders horse body inline)
  if (horse.state === 'mounted' || isMounted) return null;

  // Cull if far from player
  const playerPos = playerPositionRef.current;
  if (playerPos) {
    const dx = playerPos.x - posRef.current[0];
    const dz = playerPos.z - posRef.current[2];
    if (dx * dx + dz * dz > 200 * 200) return null;
  }

  const t = animTimeRef.current;
  const ms = Math.min(1, moveSpeedRef.current / HORSE_APPROACH_SPEED);

  // Idle animation — organic varied timing
  const breath = Math.sin(t * 1.2) * 0.03 + Math.sin(t * 2.1) * 0.008;
  const headNod = Math.sin(t * 0.5) * 0.08 + Math.sin(t * 1.3) * 0.02;
  const tailSwish = Math.sin(t * 1.6) * 0.4 + Math.sin(t * 3.1) * 0.1;
  const earFlick = Math.sin(t * 2.5) > 0.85 ? 0.12 : (Math.sin(t * 1.7) > 0.9 ? -0.06 : 0);
  const weightShift = Math.sin(t * 0.25) * 0.015 * (1 - ms);
  const bodyRock = Math.sin(t * 0.4) * 0.008 * (1 - ms);

  // Locomotion — driven by actual moveSpeed
  const legFL = Math.sin(t) * 0.5 * ms;
  const legFR = Math.sin(t + Math.PI * 0.5) * 0.5 * ms;
  const legBL = Math.sin(t + Math.PI) * 0.5 * ms;
  const legBR = Math.sin(t + Math.PI * 1.5) * 0.5 * ms;
  const bodyBob = Math.abs(Math.sin(t * 2)) * 0.08 * ms;
  const neckMotion = Math.sin(t * 2 + 0.5) * 0.06 * ms;

  return (
    <group ref={groupRef}>
      {/* Body tilt group for bodyRock */}
      <group rotation={[0, 0, bodyRock]}>
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
    </group>
  );
}
