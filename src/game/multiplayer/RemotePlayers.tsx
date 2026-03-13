import { forwardRef } from 'react';
import * as THREE from 'three';
import { InterpolatedPlayer } from './types';
import { RemotePlayer } from './RemotePlayer';

interface Props {
  remotePlayers: Map<string, InterpolatedPlayer>;
}

const auditRenderCounts: Record<string, number> = {};
const AUDIT_RENDER_LIMIT = 3;

function mpAuditRender(label: string, data?: Record<string, unknown>) {
  const count = auditRenderCounts[label] ?? 0;
  if (count >= AUDIT_RENDER_LIMIT) return;
  auditRenderCounts[label] = count + 1;
  const suffix = data ? ' — ' + JSON.stringify(data) : '';
  console.log(`[MP-Audit] ${label}${suffix}`);
}

export const RemotePlayers = forwardRef<THREE.Group, Props>(function RemotePlayers({ remotePlayers }, ref) {
  const players = Array.from(remotePlayers.values());

  mpAuditRender('RemotePlayers render count', { count: players.length });

  if (players.length === 0) {
    return <group ref={ref} visible={false} />;
  }

  return (
    <group ref={ref}>
      {players.map(p => (
        <RemotePlayer key={p.playerId} player={p} />
      ))}
    </group>
  );
});
