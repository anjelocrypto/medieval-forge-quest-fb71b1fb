import { useState } from 'react';
import AdminWorldMap from '../admin/AdminWorldMap';

const ADMIN_KEY = 'trencheria_admin_verified';

export default function Admin() {
  const [verified, setVerified] = useState(() => {
    try {
      return sessionStorage.getItem(ADMIN_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple passphrase gate — not a security boundary, just prevents casual access
    if (input === 'trencheria-admin-2026') {
      setVerified(true);
      try { sessionStorage.setItem(ADMIN_KEY, 'true'); } catch {}
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  if (!verified) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a14', fontFamily: 'monospace',
      }}>
        <form onSubmit={handleSubmit} style={{ textAlign: 'center' }}>
          <div style={{ color: '#666', fontSize: 12, marginBottom: 16 }}>ADMIN ACCESS</div>
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Passphrase"
            autoFocus
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid #333',
              color: '#ccc', padding: '10px 16px', borderRadius: 6, outline: 'none',
              width: 240,
            }}
          />
          <button type="submit" style={{
            marginLeft: 8, padding: '10px 20px', background: '#333',
            color: '#aaa', border: 'none', borderRadius: 6, cursor: 'pointer',
          }}>
            Enter
          </button>
          {error && <div style={{ color: '#f44', marginTop: 12, fontSize: 12 }}>Invalid passphrase</div>}
        </form>
      </div>
    );
  }

  return <AdminWorldMap />;
}
