import { useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { InterpolatedPlayer, BROADCAST_RATE_MS, EMOTES } from './types';
import { getTerrainHeight } from '../components/Terrain';
import { Html } from '@react-three/drei';
import { PLAYER_HEIGHT } from '../constants';
import { RemoteGoblinModel } from './RemoteGoblinModel';
import { RemoteSoldierModel } from './RemoteSoldierModel';

interface Props {
  player: InterpolatedPlayer;
}

const horseMat = new THREE.MeshLambertMaterial({ color: '#5a3a1a' });
const saddleMat = new THREE.MeshLambertMaterial({ color: '#4a2010' });
const bodyMat = new THREE.MeshLambertMaterial({ color: '#3a5a8a' });
const headMat = new THREE.MeshLambertMaterial({ color: '#d4a574' });
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

export function RemotePlayer({ player }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const currentPos = useRef(new THREE.Vector3(...player.renderPosition));
  const currentRot = useRef(player.renderRotation);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);

    const lerpSpeed = 1000 / BROADCAST_RATE_MS;
    const t = Math.min(1, dt * lerpSpeed * 0.15);

    const tx = player.targetPosition[0];
    const tz = player.targetPosition[2];
    const terrainY = getTerrainHeight(tx, tz);
    const ty = terrainY; // GLB models have feet at Y=0, no offset needed

    currentPos.current.x += (tx - currentPos.current.x) * t;
    currentPos.current.y += (ty - currentPos.current.y) * t;
    currentPos.current.z += (tz - currentPos.current.z) * t;

    let rotDiff = player.targetRotation - currentRot.current;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    currentRot.current += rotDiff * t;

    groupRef.current.position.copy(currentPos.current);
    groupRef.current.rotation.y = currentRot.current;
  });

  const healthPct = player.maxHealth > 0 ? player.health / player.maxHealth : 1;
  const emoteText = player.emote ? EMOTES[player.emote] || player.emote : null;
  const charType = player.characterType || 'soldier';

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
            {player.isSpeaking && <span style={{ marginRight: 3 }}>🎙️</span>}
            {player.displayName}
          </div>
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
          {player.isSpeaking && (
            <div style={{
              marginTop: 3, fontSize: 9, color: '#6f6',
              animation: 'pulse 1s infinite',
            }}>
              SPEAKING
            </div>
          )}
        </div>
      </Html>

      {player.isMounted ? (
        <MountedRemoteModel moveSpeed={player.moveSpeed} horsePitch={player.horsePitch} charType={charType} />
      ) : (
        <Suspense fallback={<FallbackBox />}>
          {charType === 'goblin' ? (
            <RemoteGoblinModel
              moveSpeed={player.moveSpeed}
              isRunning={player.isRunning}
              attackAnim={player.attackAnim}
              health={player.health}
              emote={player.emote}
            />
          ) : (
            <RemoteSoldierModel
              moveSpeed={player.moveSpeed}
              isRunning={player.isRunning}
              attackAnim={player.attackAnim}
              health={player.health}
              emote={player.emote}
            />
          )}
        </Suspense>
      )}
    </group>
  );
}

function FallbackBox() {
  return (
    <group>
      <mesh position={[0, 1.1, 0]} scale={[0.55, 0.65, 0.35]}>
        <boxGeometry />
        <meshLambertMaterial color="#3a5a8a" />
      </mesh>
      <mesh position={[0, 1.7, 0]} scale={[0.35, 0.35, 0.35]}>
        <boxGeometry />
        <meshLambertMaterial color="#d4a574" />
      </mesh>
    </group>
  );
}

function MountedRemoteModel({ moveSpeed, horsePitch, charType }: { moveSpeed: number; horsePitch: number; charType: string }) {
  const bobAmount = moveSpeed > 1 ? Math.sin(Date.now() * 0.006) * 0.08 : 0;

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
