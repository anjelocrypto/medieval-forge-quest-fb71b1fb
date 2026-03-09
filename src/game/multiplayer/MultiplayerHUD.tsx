import type { ConnectionStatus } from './useMultiplayer';

interface Props {
  connectionStatus: ConnectionStatus;
  playerCount: number;
  playerId: string;
}

export function MultiplayerHUD({ connectionStatus, playerCount, playerId }: Props) {
  if (connectionStatus === 'disconnected') return null;

  const statusColor =
    connectionStatus === 'connected' ? '#4a4' :
    connectionStatus === 'reconnecting' ? '#ea4' : '#aaa';

  const statusLabel =
    connectionStatus === 'connected' ? 'ONLINE' :
    connectionStatus === 'reconnecting' ? 'RECONNECTING' : 'CONNECTING';

  return (
    <div className="fixed top-24 right-4 z-40 pointer-events-none font-mono text-xs"
      style={{ background: 'rgba(0,0,0,0.6)', padding: '6px 10px', borderRadius: 6, border: '1px solid #333' }}>
      <div style={{ color: statusColor }}>● {statusLabel}</div>
      <div style={{ color: '#aaa' }}>Players Online: {playerCount}</div>
      <div style={{ color: '#666', fontSize: 9 }}>ID: {playerId.slice(0, 10)}</div>
    </div>
  );
}
