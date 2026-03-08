interface Props {
  connected: boolean;
  roomId: string | null;
  playerCount: number;
  playerId: string;
  mockMode: boolean;
}

export function MultiplayerHUD({ connected, roomId, playerCount, playerId, mockMode }: Props) {
  if (!connected) return null;

  return (
    <div className="fixed top-24 right-4 z-40 pointer-events-none font-mono text-xs"
      style={{ background: 'rgba(0,0,0,0.6)', padding: '6px 10px', borderRadius: 6, border: '1px solid #333' }}>
      <div style={{ color: '#4a4' }}>● ONLINE {mockMode && '(MOCK)'}</div>
      <div style={{ color: '#aaa' }}>Room: {roomId?.slice(0, 16)}</div>
      <div style={{ color: '#aaa' }}>Players: {playerCount}</div>
      <div style={{ color: '#666', fontSize: 9 }}>ID: {playerId.slice(0, 10)}</div>
    </div>
  );
}
