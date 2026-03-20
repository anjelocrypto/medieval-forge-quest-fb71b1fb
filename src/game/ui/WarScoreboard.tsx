import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CLAN_COLOR_HEX, ClanColor, TerritoryInfo, ChallengeInfo } from '../hooks/useClanSystem';

interface WarScoreboardProps {
  playerX: number;
  playerZ: number;
  territories: TerritoryInfo[];
  challenges: ChallengeInfo[];
  myClan: { clan_name: string; clan_color: string; clan_id: string } | null;
}

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, hsla(0,0%,0%,0.82), hsla(0,0%,0%,0.65))',
  border: '1px solid hsla(0,60%,45%,0.4)',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 4px 24px hsla(0,0%,0%,0.5), inset 0 1px 0 hsla(40,30%,60%,0.06)',
};

export function WarScoreboard({ playerX, playerZ, territories, challenges, myClan }: WarScoreboardProps) {
  const [killStats, setKillStats] = useState<{ attacker_kills: number; defender_kills: number; total: number } | null>(null);

  // Find active/pending_resolution war the player is inside of
  const activeChallenge = challenges.find(ch => {
    if (ch.status !== 'active' && ch.status !== 'pending_resolution') return false;
    const territory = territories.find(t => t.id === ch.territory_id);
    if (!territory) return false;
    const dx = playerX - territory.center_x;
    const dz = playerZ - territory.center_z;
    return Math.sqrt(dx * dx + dz * dz) <= territory.radius * 1.3;
  });

  const territory = activeChallenge ? territories.find(t => t.id === activeChallenge.territory_id) : null;

  // Poll kill stats — faster during active war (10s), slower otherwise (30s)
  const fetchKills = useCallback(async () => {
    if (!activeChallenge) { setKillStats(null); return; }
    try {
      const { data } = await supabase.rpc('get_war_kills' as any, { _challenge_id: activeChallenge.id });
      const kd = typeof data === 'string' ? JSON.parse(data) : data;
      if (kd && typeof kd === 'object' && !Array.isArray(kd)) {
        const kills: { clan_id: string; kill_count: number }[] = kd.kills || [];
        let attackerKills = 0, defenderKills = 0;
        for (const k of kills) {
          const count = Number(k.kill_count) || 0;
          if (k.clan_id === activeChallenge.attacker_clan_id) attackerKills += count;
          else if (k.clan_id === activeChallenge.defender_clan_id) defenderKills += count;
        }
        setKillStats({ attacker_kills: attackerKills, defender_kills: defenderKills, total: Number(kd.total) || (attackerKills + defenderKills) });
      }
    } catch { /* silent */ }
  }, [activeChallenge?.id, activeChallenge?.attacker_clan_id, activeChallenge?.defender_clan_id]);

  const isActive = activeChallenge?.status === 'active';

  useEffect(() => {
    if (!activeChallenge) { setKillStats(null); return; }
    fetchKills();
    const pollMs = isActive ? 10000 : 30000;
    const interval = setInterval(() => { if (!document.hidden) fetchKills(); }, pollMs);
    return () => clearInterval(interval);
  }, [fetchKills, activeChallenge?.id, isActive]);

  if (!activeChallenge || !territory) return null;

  const ks = killStats || { attacker_kills: 0, defender_kills: 0, total: 0 };
  const attackerColor = CLAN_COLOR_HEX[activeChallenge.attacker_clan_color as ClanColor] || '#e74c3c';
  const defenderColor = CLAN_COLOR_HEX[activeChallenge.defender_clan_color as ClanColor] || '#27ae60';

  // Progress bar: ratio of attacker vs defender kills
  const totalKills = ks.attacker_kills + ks.defender_kills;
  const attackerPct = totalKills > 0 ? (ks.attacker_kills / totalKills) * 100 : 50;

  // Time remaining
  const endTime = isActive ? new Date(activeChallenge.war_ends_at).getTime() : 0;
  const remainMs = Math.max(0, endTime - Date.now());
  const remainMin = Math.floor(remainMs / 60000);
  const remainSec = Math.floor((remainMs % 60000) / 1000);

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="rounded-lg px-5 py-3 min-w-[320px]" style={panelStyle}>
        {/* Territory name + state badge */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(40,30%,85%)', letterSpacing: '0.04em' }}>
            {territory.name}
          </span>
          <span style={{
            fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
            letterSpacing: '0.1em', textTransform: 'uppercase' as const,
            color: isActive ? 'hsl(0,70%,65%)' : 'hsl(40,70%,65%)',
            background: isActive ? 'hsla(0,60%,40%,0.2)' : 'hsla(40,60%,40%,0.2)',
            border: isActive ? '1px solid hsla(0,60%,50%,0.3)' : '1px solid hsla(40,60%,50%,0.3)',
          }}>
            {isActive ? '🔥 WAR ACTIVE' : '⏳ AWAITING RESOLUTION'}
          </span>
          {isActive && remainMs > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'hsl(0,60%,60%)',
              fontFamily: 'ui-monospace, monospace',
            }}>
              {remainMin}:{remainSec.toString().padStart(2, '0')}
            </span>
          )}
        </div>

        {/* === PROGRESS BAR === */}
        <div className="mb-2 rounded overflow-hidden" style={{
          height: 8, background: 'hsla(0,0%,100%,0.06)',
          boxShadow: 'inset 0 1px 3px hsla(0,0%,0%,0.4)',
        }}>
          <div style={{
            height: '100%',
            width: `${attackerPct}%`,
            background: `linear-gradient(90deg, ${attackerColor}, ${attackerColor}cc)`,
            boxShadow: `0 0 8px ${attackerColor}40`,
            transition: 'width 0.6s ease-out',
            borderRight: totalKills > 0 ? `2px solid ${defenderColor}` : 'none',
          }} />
        </div>

        {/* Faction labels under bar */}
        <div className="flex justify-between mb-2" style={{ fontSize: 8, fontWeight: 600 }}>
          <span style={{ color: attackerColor }}>⚔️ {activeChallenge.attacker_clan_name}</span>
          <span style={{ color: defenderColor }}>{activeChallenge.defender_clan_name} 🛡️</span>
        </div>

        {/* Scoreboard */}
        <div className="flex items-center justify-between gap-3">
          {/* Attacker side */}
          <div className="flex flex-col items-center min-w-[80px]">
            <span style={{
              fontSize: 26, fontWeight: 800, color: attackerColor,
              fontFamily: 'ui-monospace, monospace',
              textShadow: `0 0 10px ${attackerColor}50`,
            }}>
              {ks.attacker_kills}
            </span>
            <span style={{ fontSize: 8, color: 'hsl(40,15%,45%)', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
              KILLS
            </span>
          </div>

          {/* VS divider */}
          <div className="flex flex-col items-center">
            <span style={{ fontSize: 10, fontWeight: 700, color: 'hsl(40,15%,40%)', letterSpacing: '0.06em' }}>VS</span>
          </div>

          {/* Defender side */}
          <div className="flex flex-col items-center min-w-[80px]">
            <span style={{
              fontSize: 26, fontWeight: 800, color: defenderColor,
              fontFamily: 'ui-monospace, monospace',
              textShadow: `0 0 10px ${defenderColor}50`,
            }}>
              {ks.defender_kills}
            </span>
            <span style={{ fontSize: 8, color: 'hsl(40,15%,45%)', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
              KILLS
            </span>
          </div>
        </div>

        {/* Alpha notice */}
        <div className="mt-2 pt-1.5 text-center" style={{ borderTop: '1px solid hsla(40,30%,45%,0.15)' }}>
          <span style={{ fontSize: 7, color: 'hsl(40,15%,35%)', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
            ⚠️ Alpha — Admin resolves winner
          </span>
        </div>
      </div>
    </div>
  );
}