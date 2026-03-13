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

export function RemotePlayers({ remotePlayers }: Props) {
  const players = Array.from(remotePlayers.values());

  mpAuditRender('RemotePlayers render count', { count: players.length });

  if (players.length === 0) return null;

  return (
    <group>
      {players.map(p => (
        <RemotePlayer key={p.playerId} player={p} />
      ))}
    </group>
  );
}
