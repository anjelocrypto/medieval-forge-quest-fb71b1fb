import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { InterpolatedPlayer, BROADCAST_RATE_MS, EMOTES } from './types';
import { getTerrainHeight } from '../components/Terrain';
import { Html } from '@react-three/drei';
import { PLAYER_HEIGHT } from '../constants';

interface Props {
  player: InterpolatedPlayer;
}

const bodyMat = new THREE.MeshLambertMaterial({ color: '#3a5a8a' });
const headMat = new THREE.MeshLambertMaterial({ color: '#d4a574' });
const legMat = new THREE.MeshLambertMaterial({ color: '#2a3a5a' });
const armMat = new THREE.MeshLambertMaterial({ color: '#3a5a8a' });
const horseMat = new THREE.MeshLambertMaterial({ color: '#5a3a1a' });
const saddleMat = new THREE.MeshLambertMaterial({ color: '#4a2010' });
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

export function RemotePlayer({ player }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const animTime = useRef(0);
  const currentPos = useRef(new THREE.Vector3(...player.renderPosition));
  const currentRot = useRef(player.renderRotation);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);
    animTime.current += dt;

    // Interpolate position
    const lerpSpeed = 1000 / BROADCAST_RATE_MS; // match broadcast rate
    const t = Math.min(1, dt * lerpSpeed * 0.15);

    // Target with terrain grounding
    const tx = player.targetPosition[0];
    const tz = player.targetPosition[2];
    const terrainY = getTerrainHeight(tx, tz);
    const ty = player.isMounted ? terrainY : terrainY + PLAYER_HEIGHT / 2;

    currentPos.current.x += (tx - currentPos.current.x) * t;
    currentPos.current.y += (ty - currentPos.current.y) * t;
    currentPos.current.z += (tz - currentPos.current.z) * t;

    // Interpolate rotation
    let rotDiff = player.targetRotation - currentRot.current;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    currentRot.current += rotDiff * t;

    groupRef.current.position.copy(currentPos.current);
    groupRef.current.rotation.y = currentRot.current;
  });

  const healthPct = player.maxHealth > 0 ? player.health / player.maxHealth : 1;
  const emoteText = player.emote ? EMOTES[player.emote] || player.emote : null;

  return (
    <group ref={groupRef}>
      {/* Nametag + health */}
      <Html position={[0, player.isMounted ? 4.5 : 2.8, 0]} center distanceFactor={20}
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          textAlign: 'center', whiteSpace: 'nowrap',
          textShadow: '0 1px 4px rgba(0,0,0,0.8)', fontFamily: 'monospace',
        }}>
          <div style={{ color: '#fff', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
            {player.displayName}
          </div>
          {/* Health bar */}
          <div style={{
            width: 50, height: 4, background: 'rgba(0,0,0,0.6)',
            borderRadius: 2, overflow: 'hidden', margin: '0 auto',
          }}>
            <div style={{
              width: `${healthPct * 100}%`, height: '100%',
              background: healthPct > 0.5 ? '#4a4' : healthPct > 0.25 ? '#aa4' : '#a44',
              transition: 'width 0.3s',
            }} />
          </div>
          {emoteText && (
            <div style={{ fontSize: 18, marginTop: 4, animation: 'bounce 0.5s ease-out' }}>
              {emoteText}
            </div>
          )}
        </div>
      </Html>

      {player.isMounted ? (
        <MountedRemoteModel animTime={animTime.current} moveSpeed={player.moveSpeed} horsePitch={player.horsePitch} />
      ) : (
        <FootRemoteModel animTime={animTime.current} moveSpeed={player.moveSpeed} attackAnim={player.attackAnim} />
      )}
    </group>
  );
}

function FootRemoteModel({ animTime, moveSpeed, attackAnim }: { animTime: number; moveSpeed: number; attackAnim: number }) {
  const walkCycle = moveSpeed > 0.5 ? Math.sin(animTime * 8) * 0.4 : 0;
  const armSwing = attackAnim > 0 ? -1.2 : walkCycle * 0.5;

  return (
    <group>
      {/* Body */}
      <mesh geometry={boxGeo} material={bodyMat} position={[0, 1.1, 0]} scale={[0.55, 0.65, 0.35]} />
      {/* Head */}
      <mesh geometry={boxGeo} material={headMat} position={[0, 1.7, 0]} scale={[0.35, 0.35, 0.35]} />
      {/* Legs */}
      <mesh geometry={boxGeo} material={legMat}
        position={[-0.13, 0.4, Math.sin(animTime * 8) * (moveSpeed > 0.5 ? 0.2 : 0)]}
        scale={[0.2, 0.6, 0.2]} />
      <mesh geometry={boxGeo} material={legMat}
        position={[0.13, 0.4, -Math.sin(animTime * 8) * (moveSpeed > 0.5 ? 0.2 : 0)]}
        scale={[0.2, 0.6, 0.2]} />
      {/* Arms */}
      <group position={[-0.38, 1.15, 0]} rotation={[armSwing, 0, 0]}>
        <mesh geometry={boxGeo} material={armMat} position={[0, -0.22, 0]} scale={[0.18, 0.5, 0.2]} />
      </group>
      <group position={[0.38, 1.15, 0]} rotation={[-armSwing, 0, 0]}>
        <mesh geometry={boxGeo} material={armMat} position={[0, -0.22, 0]} scale={[0.18, 0.5, 0.2]} />
      </group>
    </group>
  );
}

function MountedRemoteModel({ animTime, moveSpeed, horsePitch }: { animTime: number; moveSpeed: number; horsePitch: number }) {
  const bobAmount = moveSpeed > 1 ? Math.sin(animTime * 6) * 0.08 : 0;

  return (
    <group rotation={[horsePitch, 0, 0]}>
      {/* Horse body */}
      <mesh geometry={boxGeo} material={horseMat} position={[0, 0.9, 0]} scale={[0.7, 0.7, 1.8]} />
      {/* Horse head */}
      <mesh geometry={boxGeo} material={horseMat} position={[0, 1.3, -0.9]} scale={[0.35, 0.45, 0.5]} />
      {/* Horse legs */}
      {[[-0.25, -0.5], [-0.25, 0.5], [0.25, -0.5], [0.25, 0.5]].map(([x, z], i) => (
        <mesh key={i} geometry={boxGeo} material={horseMat}
          position={[x, 0.25, z]} scale={[0.18, 0.65, 0.18]} />
      ))}
      {/* Saddle */}
      <mesh geometry={boxGeo} material={saddleMat} position={[0, 1.35, 0]} scale={[0.6, 0.12, 0.5]} />
      {/* Rider */}
      <group position={[0, 1.7 + bobAmount, 0]}>
        <mesh geometry={boxGeo} material={bodyMat} position={[0, 0.3, 0]} scale={[0.5, 0.6, 0.35]} />
        <mesh geometry={boxGeo} material={headMat} position={[0, 0.8, 0]} scale={[0.33, 0.33, 0.33]} />
      </group>
    </group>
  );
}
