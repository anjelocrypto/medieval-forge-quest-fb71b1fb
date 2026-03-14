import { useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { InterpolatedPlayer, BROADCAST_RATE_MS, EMOTES } from './types';
import { getTerrainHeight } from '../components/Terrain';
import { getBridgeHeight } from '../world/BridgeData';
import { Html } from '@react-three/drei';
import { HorseGLBModel } from '../components/HorseGLBModel';

import { RemoteGoblinModel } from './RemoteGoblinModel';
import { RemoteSoldierModel } from './RemoteSoldierModel';
import { RemoteOctopusModel } from './RemoteOctopusModel';

interface Props {
  player: InterpolatedPlayer;
}

// Nametag heights per character type
const NAMETAG_HEIGHT_GOBLIN = 2.0;
const NAMETAG_HEIGHT_SOLDIER = 2.8;
const NAMETAG_HEIGHT_OCTOPUS = 2.0;
const NAMETAG_HEIGHT_MOUNTED = 4.5;

const remoteAuditCounts: Record<string, number> = {};
const REMOTE_AUDIT_LIMIT = 3;

function mpAuditRemote(label: string, data?: Record<string, unknown>) {
  const count = remoteAuditCounts[label] ?? 0;
  if (count >= REMOTE_AUDIT_LIMIT) return;
  remoteAuditCounts[label] = count + 1;
  const suffix = data ? ' — ' + JSON.stringify(data) : '';
  console.log(`[MP-Audit] ${label}${suffix}`);
}

export function RemotePlayer({ player }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const currentPos = useRef(new THREE.Vector3(...player.renderPosition));
  const currentRot = useRef(player.renderRotation);

  mpAuditRemote('RemotePlayer mounted', {
    id: player.playerId,
    charType: player.characterType,
    pos: player.targetPosition,
  });

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);

    const lerpSpeed = 1000 / BROADCAST_RATE_MS;
    const t = Math.min(1, dt * lerpSpeed * 0.15);

    const tx = player.targetPosition[0];
    const tz = player.targetPosition[2];

    // Use bridge height if available, otherwise terrain height
    const bridgeY = getBridgeHeight(tx, tz);
    const rawTerrainY = getTerrainHeight(tx, tz);
    const groundY = bridgeY !== null ? bridgeY : rawTerrainY;

    // GLB models have feet at Y=0, so ground level is the target Y
    const ty = groundY;

    currentPos.current.x += (tx - currentPos.current.x) * t;
    // Faster Y lerp for snappy grounding
    const yLerp = Math.min(1, dt * lerpSpeed * 0.3);
    currentPos.current.y += (ty - currentPos.current.y) * yLerp;
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
  const charType = player.characterType || 'goblin';
  const nametagY = player.isMounted
    ? NAMETAG_HEIGHT_MOUNTED
    : charType === 'goblin' ? NAMETAG_HEIGHT_GOBLIN
    : charType === 'octopus' ? NAMETAG_HEIGHT_OCTOPUS
    : NAMETAG_HEIGHT_SOLDIER;

  return (
    <group ref={groupRef}>
      {/* Nametag + health */}
      <Html position={[0, nametagY, 0]} center distanceFactor={20}
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
        <MountedRemoteModel moveSpeed={player.moveSpeed} horsePitch={player.horsePitch} />
      ) : (
        <Suspense fallback={null}>
          {charType === 'goblin' ? (
            <RemoteGoblinModel
              moveSpeed={player.moveSpeed}
              isRunning={player.isRunning}
              isGrounded={player.isGrounded}
              attackAnim={player.attackAnim}
              health={player.health}
              emote={player.emote}
            />
          ) : charType === 'octopus' ? (
            <RemoteOctopusModel
              moveSpeed={player.moveSpeed}
              isRunning={player.isRunning}
              isGrounded={player.isGrounded}
              attackAnim={player.attackAnim}
              health={player.health}
              emote={player.emote}
            />
          ) : (
            <RemoteSoldierModel
              moveSpeed={player.moveSpeed}
              isRunning={player.isRunning}
              isGrounded={player.isGrounded}
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

function MountedRemoteModel({ moveSpeed, horsePitch }: { moveSpeed: number; horsePitch: number }) {
  return (
    <group rotation={[horsePitch, 0, 0]}>
      <Suspense fallback={null}>
        <HorseGLBModel moveSpeed={moveSpeed} renderPath="mounted-remote" />
      </Suspense>
    </group>
  );
}
