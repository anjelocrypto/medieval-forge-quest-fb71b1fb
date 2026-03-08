import { InterpolatedPlayer } from './types';
import { RemotePlayer } from './RemotePlayer';

interface Props {
  remotePlayers: Map<string, InterpolatedPlayer>;
}

export function RemotePlayers({ remotePlayers }: Props) {
  const players = Array.from(remotePlayers.values());
  if (players.length === 0) return null;

  return (
    <group>
      {players.map(p => (
        <RemotePlayer key={p.playerId} player={p} />
      ))}
    </group>
  );
}
