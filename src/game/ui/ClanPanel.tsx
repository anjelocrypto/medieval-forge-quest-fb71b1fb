/**
 * Clan & Territory Panel — Phase 2 UI
 * Opens with 'C' key. Medieval-styled overlay for clan management, territory view, and challenges.
 */
import { useState, useEffect, useCallback } from 'react';
import { loadWalletSession } from '../hooks/usePlayerAccount';
import {
  useClanSystem,
  ClanColor,
  CLAN_COLOR_OPTIONS,
  CLAN_COLOR_HEX,
  ClanInfo,
  TerritoryInfo,
  ClanMemberInfo,
  ChallengeInfo,
  TerritoryHistoryEntry,
} from '../hooks/useClanSystem';

interface Props {
  open: boolean;
  onClose: () => void;
  playerX: number;
  playerZ: number;
}

type Tab = 'my_clan' | 'browse' | 'territories' | 'history' | 'create';

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, hsla(0,0%,6%,0.97), hsla(0,0%,10%,0.97))',
  border: '1px solid hsla(40,30%,35%,0.5)',
  boxShadow: '0 24px 80px rgba(0,0,0,0.8), inset 0 1px 0 hsla(40,30%,50%,0.1)',
  backdropFilter: 'blur(20px)',
};

const btnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? 'hsla(40,40%,40%,0.25)' : 'hsla(0,0%,100%,0.03)',
  color: active ? 'hsl(40,50%,80%)' : 'hsl(40,15%,50%)',
  border: active ? '1px solid hsla(40,40%,50%,0.3)' : '1px solid hsla(0,0%,100%,0.08)',
});

const inputStyle: React.CSSProperties = {
  background: 'hsla(0,0%,100%,0.06)',
  border: '1px solid hsla(0,0%,100%,0.1)',
  color: 'hsl(40,30%,85%)',
};

// ── Countdown helper ──
function formatCountdown(targetIso: string): string {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return 'Now';
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

// ── War state badge ──
function WarStateBadge({ state, challenge }: { state: string; challenge?: ChallengeInfo }) {
  const configs: Record<string, { icon: string; label: string; bg: string; color: string; border: string }> = {
    peaceful: { icon: '☮️', label: 'Peaceful', bg: 'hsla(120,30%,30%,0.1)', color: 'hsl(120,40%,60%)', border: 'hsla(120,30%,40%,0.2)' },
    contested: { icon: '⚔️', label: 'Challenged', bg: 'hsla(30,60%,40%,0.15)', color: 'hsl(30,70%,65%)', border: 'hsla(30,60%,50%,0.3)' },
    active_war: { icon: '🔥', label: 'WAR ACTIVE', bg: 'hsla(0,60%,40%,0.2)', color: 'hsl(0,70%,65%)', border: 'hsla(0,60%,50%,0.4)' },
    pending_resolution: { icon: '⏳', label: 'AWAITING RESOLUTION', bg: 'hsla(40,60%,40%,0.15)', color: 'hsl(40,70%,65%)', border: 'hsla(40,60%,50%,0.3)' },
    cooldown: { icon: '🛡️', label: 'Cooldown', bg: 'hsla(210,40%,40%,0.1)', color: 'hsl(210,50%,65%)', border: 'hsla(210,40%,50%,0.2)' },
  };
  const c = configs[state] || configs.peaceful;
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <span style={{ fontSize: 12 }}>{c.icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: c.color, letterSpacing: '0.06em' }}>{c.label}</span>
      {challenge && state === 'contested' && (
        <span style={{ fontSize: 9, color: 'hsl(30,50%,55%)', marginLeft: 4 }}>
          War in {formatCountdown(challenge.war_starts_at)}
        </span>
      )}
      {challenge && state === 'active_war' && (
        <span style={{ fontSize: 9, color: 'hsl(0,50%,55%)', marginLeft: 4 }}>
          Ends {formatCountdown(challenge.war_ends_at)}
        </span>
      )}
      {state === 'pending_resolution' && (
        <span style={{ fontSize: 9, color: 'hsl(40,50%,55%)', marginLeft: 4 }}>
          Admin review
        </span>
      )}
    </div>
  );
}

export function ClanPanel({ open, onClose, playerX, playerZ }: Props) {
  const clan = useClanSystem();
  const [tab, setTab] = useState<Tab>('my_clan');
  const [createName, setCreateName] = useState('');
  const [createColor, setCreateColor] = useState<ClanColor>('crimson');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);
  const [confirmChallenge, setConfirmChallenge] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const wallet = loadWalletSession();
  const isWallet = !!wallet?.wallet_address && !!wallet?.session_token;

  // Countdown ticker — refresh every second when challenges exist
  useEffect(() => {
    if (!open || clan.challenges.length === 0) return;
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, [open, clan.challenges.length]);

  useEffect(() => {
    if (open) { clan.refresh(); setConfirmLeave(false); setConfirmRelease(null); setConfirmChallenge(null); setConfirmCancel(null); clan.setError(null); }
  }, [open]); // eslint-disable-line

  useEffect(() => {
    if (open && clan.myClan) clan.loadClanMembers(clan.myClan.clan_id);
  }, [open, clan.myClan?.clan_id]); // eslint-disable-line

  // Load history when history tab is selected
  useEffect(() => {
    if (open && tab === 'history') clan.loadHistory();
  }, [open, tab]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [open, onClose]);

  useEffect(() => {
    if (open && isWallet) setTab(clan.myClan ? 'my_clan' : 'browse');
  }, [open, clan.myClan, isWallet]);

  const handleCreate = useCallback(async () => {
    if (!createName.trim()) return;
    const result = await clan.createClan(createName.trim(), createColor);
    if (result) { setCreateName(''); setTab('my_clan'); }
  }, [clan, createName, createColor]);

  const handleJoin = useCallback(async (clanId: string) => {
    const ok = await clan.joinClan(clanId);
    if (ok) setTab('my_clan');
  }, [clan]);

  const handleLeave = useCallback(async () => {
    if (!confirmLeave) { setConfirmLeave(true); return; }
    await clan.leaveClan();
    setConfirmLeave(false);
  }, [clan, confirmLeave]);

  const handleClaim = useCallback(async (t: TerritoryInfo) => {
    await clan.claimTerritory(t.id, playerX, playerZ);
  }, [clan, playerX, playerZ]);

  const handleRelease = useCallback(async (territoryId: string) => {
    if (confirmRelease !== territoryId) { setConfirmRelease(territoryId); return; }
    const ok = await clan.releaseTerritory(territoryId);
    if (ok) setConfirmRelease(null);
  }, [clan, confirmRelease]);

  const handleChallenge = useCallback(async (territoryId: string) => {
    if (confirmChallenge !== territoryId) { setConfirmChallenge(territoryId); return; }
    const ok = await clan.challengeTerritory(territoryId);
    if (ok) setConfirmChallenge(null);
  }, [clan, confirmChallenge]);

  const handleCancelChallenge = useCallback(async (challengeId: string) => {
    if (confirmCancel !== challengeId) { setConfirmCancel(challengeId); return; }
    const ok = await clan.cancelChallenge(challengeId);
    if (ok) setConfirmCancel(null);
  }, [clan, confirmCancel]);

  if (!open) return null;

  const ownedTerritories = clan.territories.filter(t => t.owning_clan_id === clan.myClan?.clan_id);
  // Challenges involving my clan
  const myChallenges = clan.challenges.filter(
    c => c.attacker_clan_id === clan.myClan?.clan_id || c.defender_clan_id === clan.myClan?.clan_id
  );

  // Helper: find challenge for a territory
  const getChallengeForTerritory = (tid: string) => clan.challenges.find(c => c.territory_id === tid);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 max-w-xl w-full mx-4 max-h-[85vh] overflow-y-auto"
        style={panelStyle}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold tracking-wide" style={{ color: 'hsl(40,50%,88%)' }}>
            ⚔️ CLANS & TERRITORIES
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'hsla(0,0%,100%,0.05)', color: 'hsl(40,15%,55%)', border: '1px solid hsla(0,0%,100%,0.1)' }}
          >✕</button>
        </div>

        {!isWallet ? (
          <div className="px-4 py-6 rounded-lg text-center" style={{
            background: 'hsla(0,0%,100%,0.03)', border: '1px dashed hsla(0,0%,100%,0.1)',
          }}>
            <p className="text-sm mb-2" style={{ color: 'hsl(40,20%,65%)' }}>🔒 Clan System</p>
            <p className="text-xs" style={{ color: 'hsl(40,15%,40%)' }}>
              Connect a Phantom wallet and register an account to create or join clans
            </p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              {(['my_clan', 'browse', 'territories', 'history', 'create'] as Tab[]).map(t => (
                <button key={t}
                  onClick={() => { setTab(t); clan.setError(null); setConfirmLeave(false); setConfirmRelease(null); setConfirmChallenge(null); setConfirmCancel(null); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                  style={btnStyle(tab === t)}
                >
                  {t === 'my_clan' ? 'My Clan' : t === 'browse' ? 'Browse' : t === 'territories' ? 'Territories' : t === 'history' ? 'History' : '+ Create'}
                </button>
              ))}
            </div>

            {/* Error display */}
            {clan.error && (
              <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{
                background: 'hsla(0,50%,40%,0.1)', color: 'hsl(0,60%,65%)', border: '1px solid hsla(0,50%,50%,0.2)',
              }}>⚠️ {clan.error}</div>
            )}

            {/* MY CLAN TAB */}
            {tab === 'my_clan' && (
              clan.myClan ? (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                      style={{ background: CLAN_COLOR_HEX[clan.myClan.clan_color] + '30', border: `2px solid ${CLAN_COLOR_HEX[clan.myClan.clan_color]}`, color: CLAN_COLOR_HEX[clan.myClan.clan_color] }}>
                      {clan.myClan.clan_name[0]}
                    </div>
                    <div>
                      <div className="text-sm font-bold" style={{ color: 'hsl(40,50%,85%)' }}>{clan.myClan.clan_name}</div>
                      <div className="text-xs" style={{ color: 'hsl(40,15%,45%)' }}>
                        {clan.myClan.role === 'leader' ? '👑 Leader' : '⚔️ Member'} · {clan.myClan.member_count}/{clan.myClan.max_members} members
                      </div>
                    </div>
                    <div className="ml-auto w-5 h-5 rounded-full" style={{ background: CLAN_COLOR_HEX[clan.myClan.clan_color] }} />
                  </div>

                  {/* Active challenges for my clan */}
                  {myChallenges.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'hsl(30,50%,60%)' }}>
                        ⚔️ Active Challenges
                      </div>
                      {myChallenges.map(ch => {
                        const isAttacker = ch.attacker_clan_id === clan.myClan?.clan_id;
                        return (
                          <div key={ch.id} className="px-3 py-2.5 rounded-lg mb-1.5" style={{
                            background: 'hsla(30,50%,30%,0.1)', border: '1px solid hsla(30,50%,40%,0.2)',
                          }}>
                            <div className="flex items-center gap-2 mb-1">
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(30,60%,70%)' }}>
                                {ch.territory_name}
                              </span>
                              <span style={{ fontSize: 9, color: 'hsl(40,15%,45%)' }}>
                                {isAttacker ? '(Attacking)' : '(Defending)'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: CLAN_COLOR_HEX[ch.attacker_clan_color as ClanColor] || '#888' }} />
                              <span style={{ fontSize: 10, color: 'hsl(40,30%,70%)' }}>{ch.attacker_clan_name}</span>
                              <span style={{ fontSize: 10, color: 'hsl(40,15%,45%)' }}>vs</span>
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: CLAN_COLOR_HEX[ch.defender_clan_color as ClanColor] || '#888' }} />
                              <span style={{ fontSize: 10, color: 'hsl(40,30%,70%)' }}>{ch.defender_clan_name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span style={{ fontSize: 9, color: 'hsl(30,50%,55%)' }}>
                                {ch.status === 'pending' ? `⏳ War in ${formatCountdown(ch.war_starts_at)}`
                                  : ch.status === 'active' ? `🔥 Ends ${formatCountdown(ch.war_ends_at)}`
                                  : ch.status === 'pending_resolution' ? `⏳ Awaiting admin resolution`
                                  : `🛡️ Cooldown ${formatCountdown(ch.cooldown_ends_at)}`}
                              </span>
                              {isAttacker && ch.status === 'pending' && clan.myClan?.role === 'leader' && (
                                <button
                                  onClick={() => handleCancelChallenge(ch.id)}
                                  disabled={clan.loading}
                                  className="ml-auto px-2 py-0.5 rounded text-[9px] font-bold uppercase"
                                  style={{
                                    background: confirmCancel === ch.id ? 'hsla(0,60%,40%,0.25)' : 'hsla(0,30%,30%,0.1)',
                                    color: confirmCancel === ch.id ? 'hsl(0,70%,70%)' : 'hsl(0,25%,55%)',
                                    border: '1px solid hsla(0,30%,40%,0.2)',
                                  }}
                                >
                                  {confirmCancel === ch.id ? 'Confirm?' : 'Cancel'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Owned territories with release */}
                  <div className="mb-4">
                    <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'hsl(40,20%,55%)' }}>
                      Owned Territories
                    </div>
                    {ownedTerritories.length > 0 ? (
                      ownedTerritories.map(t => {
                        const ch = getChallengeForTerritory(t.id);
                        return (
                          <div key={t.id} className="px-3 py-2 rounded-lg mb-1" style={{
                            background: 'hsla(120,30%,30%,0.08)', border: '1px solid hsla(120,30%,40%,0.15)',
                          }}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold flex-1" style={{ color: 'hsl(120,40%,65%)' }}>🏴 {t.name}</span>
                              <WarStateBadge state={t.war_state} challenge={ch} />
                              {clan.myClan?.role === 'leader' && t.war_state === 'peaceful' && (
                                <button
                                  onClick={() => handleRelease(t.id)}
                                  disabled={clan.loading}
                                  className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
                                  style={{
                                    background: confirmRelease === t.id ? 'hsla(0,60%,40%,0.25)' : 'hsla(0,30%,30%,0.1)',
                                    color: confirmRelease === t.id ? 'hsl(0,70%,70%)' : 'hsl(0,25%,55%)',
                                    border: '1px solid hsla(0,30%,40%,0.2)',
                                  }}
                                >
                                  {confirmRelease === t.id ? '⚠️ Confirm?' : 'Release'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs px-3 py-2 rounded-lg" style={{
                        color: 'hsl(40,15%,40%)', background: 'hsla(0,0%,100%,0.02)',
                      }}>No territories claimed yet.</div>
                    )}
                  </div>

                  {/* Member roster */}
                  <div className="mb-4">
                    <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'hsl(40,20%,55%)' }}>
                      Members ({clan.clanMembers.length})
                    </div>
                    <div className="space-y-1 max-h-[25vh] overflow-y-auto">
                      {clan.clanMembers.map((m: ClanMemberInfo) => (
                        <div key={m.wallet_address} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{
                          background: m.role === 'leader' ? 'hsla(45,50%,40%,0.08)' : 'hsla(0,0%,100%,0.02)',
                          border: m.role === 'leader' ? '1px solid hsla(45,50%,50%,0.12)' : '1px solid hsla(0,0%,100%,0.04)',
                        }}>
                          <span style={{ fontSize: 12 }}>{m.role === 'leader' ? '👑' : '⚔️'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold truncate" style={{ color: 'hsl(40,40%,80%)' }}>{m.display_name}</div>
                            <div className="text-[9px]" style={{ color: 'hsl(40,15%,40%)' }}>{m.role} · {m.character_type}</div>
                          </div>
                          <div className="text-[9px]" style={{ color: 'hsl(40,15%,35%)' }}>{new Date(m.joined_at).toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button onClick={handleLeave} disabled={clan.loading}
                    className="w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: confirmLeave ? 'hsla(0,60%,40%,0.3)' : 'hsla(0,30%,30%,0.1)',
                      color: confirmLeave ? 'hsl(0,70%,70%)' : 'hsl(0,30%,55%)',
                      border: '1px solid hsla(0,40%,40%,0.2)',
                    }}
                  >
                    {confirmLeave ? '⚠️ Confirm Leave? (territories released if last member)' : 'Leave Clan'}
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm mb-3" style={{ color: 'hsl(40,20%,60%)' }}>You are not in a clan</p>
                  <p className="text-xs" style={{ color: 'hsl(40,15%,40%)' }}>Browse existing clans to join, or create your own</p>
                </div>
              )
            )}

            {/* BROWSE TAB */}
            {tab === 'browse' && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'hsl(40,20%,55%)' }}>
                  Active Clans ({clan.clans.length})
                </div>
                {clan.clans.length === 0 ? (
                  <div className="text-xs text-center py-6" style={{ color: 'hsl(40,15%,40%)' }}>
                    No clans exist yet. Be the first to create one!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    {clan.clans.map((c: ClanInfo) => (
                      <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{
                        background: 'hsla(0,0%,100%,0.03)', border: '1px solid hsla(0,0%,100%,0.06)',
                      }}>
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: CLAN_COLOR_HEX[c.color as ClanColor] }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate" style={{ color: 'hsl(40,40%,80%)' }}>{c.name}</div>
                          <div className="text-[10px]" style={{ color: 'hsl(40,15%,40%)' }}>{c.member_count}/{c.max_members} members</div>
                        </div>
                        {!clan.myClan && (
                          <button onClick={() => handleJoin(c.id)} disabled={clan.loading || c.member_count >= c.max_members}
                            className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
                            style={{ background: 'hsla(120,40%,40%,0.15)', color: 'hsl(120,50%,65%)', border: '1px solid hsla(120,40%,50%,0.2)' }}
                          >Join</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TERRITORIES TAB */}
            {tab === 'territories' && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'hsl(40,20%,55%)' }}>
                  Territories ({clan.territories.length})
                </div>
                <div className="space-y-2">
                  {clan.territories.map((t: TerritoryInfo) => {
                    const alreadyOwnsTerritory = clan.territories.some(tt => tt.owning_clan_id === clan.myClan?.clan_id);
                    const ch = getChallengeForTerritory(t.id);
                    const hasOutgoingChallenge = clan.challenges.some(
                      c => c.attacker_clan_id === clan.myClan?.clan_id && (c.status === 'pending' || c.status === 'active')
                    );
                    const canClaim = !t.owning_clan_id && clan.myClan?.role === 'leader' && t.war_state === 'peaceful' && !alreadyOwnsTerritory;
                    const canChallenge = !!t.owning_clan_id
                      && t.owning_clan_id !== clan.myClan?.clan_id
                      && clan.myClan?.role === 'leader'
                      && t.war_state === 'peaceful'
                      && !hasOutgoingChallenge;
                    const dist = Math.sqrt((playerX - t.center_x) ** 2 + (playerZ - t.center_z) ** 2);
                    const inRange = dist <= t.radius + 30;

                    return (
                      <div key={t.id} className="px-3 py-2.5 rounded-lg" style={{
                        background: t.war_state === 'contested' || t.war_state === 'active_war'
                          ? 'hsla(30,50%,30%,0.1)'
                          : t.owning_clan_id ? `${CLAN_COLOR_HEX[t.owning_clan_color as ClanColor] || '#666'}10` : 'hsla(0,0%,100%,0.03)',
                        border: t.war_state === 'contested' || t.war_state === 'active_war'
                          ? '1px solid hsla(30,50%,50%,0.3)'
                          : t.owning_clan_id ? `1px solid ${CLAN_COLOR_HEX[t.owning_clan_color as ClanColor] || '#666'}30` : '1px solid hsla(0,0%,100%,0.06)',
                      }}>
                        <div className="flex items-center gap-2 mb-1">
                          {t.owning_clan_color && (
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: CLAN_COLOR_HEX[t.owning_clan_color] }} />
                          )}
                          <span className="text-xs font-bold" style={{ color: 'hsl(40,40%,80%)' }}>{t.name}</span>
                          <WarStateBadge state={t.war_state} challenge={ch} />
                          <span className="ml-auto text-[10px]" style={{ color: 'hsl(40,15%,40%)' }}>
                            {inRange ? '📍 In range' : `${Math.round(dist)}u`}
                          </span>
                        </div>
                        <div className="text-[10px] mb-1" style={{ color: 'hsl(40,15%,45%)' }}>
                          {t.owning_clan_name ? `🏴 Owned by ${t.owning_clan_name}` : '⬜ Unclaimed — available for capture'}
                        </div>
                        {/* Challenge info */}
                        {ch && (
                          <div className="text-[10px] px-2 py-1 rounded mb-1" style={{
                            background: 'hsla(30,40%,30%,0.1)', color: 'hsl(30,50%,60%)',
                          }}>
                            ⚔️ {ch.attacker_clan_name} → {ch.defender_clan_name}
                            {ch.status === 'pending' && ` · War in ${formatCountdown(ch.war_starts_at)}`}
                            {ch.status === 'active' && ` · War ends ${formatCountdown(ch.war_ends_at)}`}
                            {ch.status === 'resolved' && ` · ${ch.resolution === 'defender_held' ? 'Defender held' : 'Resolved'}`}
                          </div>
                        )}
                        {/* Claim button */}
                        {canClaim && (
                          <button onClick={() => handleClaim(t)} disabled={clan.loading || !inRange}
                            className="mt-1 w-full py-1.5 rounded text-[10px] font-bold uppercase tracking-wider disabled:opacity-40"
                            style={{
                              background: inRange ? 'hsla(40,50%,40%,0.2)' : 'hsla(0,0%,100%,0.03)',
                              color: inRange ? 'hsl(40,50%,75%)' : 'hsl(40,15%,40%)',
                              border: '1px solid hsla(40,40%,50%,0.2)',
                            }}
                          >
                            {inRange ? `🏴 Claim for ${clan.myClan!.clan_name}` : 'Travel closer to claim'}
                          </button>
                        )}
                        {/* Challenge button */}
                        {canChallenge && (
                          <button onClick={() => handleChallenge(t.id)} disabled={clan.loading}
                            className="mt-1 w-full py-1.5 rounded text-[10px] font-bold uppercase tracking-wider"
                            style={{
                              background: confirmChallenge === t.id ? 'hsla(0,60%,40%,0.2)' : 'hsla(30,50%,40%,0.15)',
                              color: confirmChallenge === t.id ? 'hsl(0,60%,65%)' : 'hsl(30,60%,65%)',
                              border: confirmChallenge === t.id ? '1px solid hsla(0,50%,50%,0.3)' : '1px solid hsla(30,50%,50%,0.25)',
                            }}
                          >
                            {confirmChallenge === t.id ? '⚠️ Confirm Challenge? War in 15 min' : `⚔️ Challenge ${t.owning_clan_name}`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* HISTORY TAB */}
            {tab === 'history' && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'hsl(40,20%,55%)' }}>
                  📜 Territory History ({clan.history.length})
                </div>
                {clan.history.length === 0 ? (
                  <div className="text-xs text-center py-6" style={{ color: 'hsl(40,15%,40%)' }}>
                    No territory events recorded yet.
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                    {clan.history.map((h: TerritoryHistoryEntry) => {
                      const eventConfig: Record<string, { icon: string; label: string; color: string }> = {
                        claimed: { icon: '🏴', label: 'Claimed', color: 'hsl(120,40%,60%)' },
                        released: { icon: '🏳️', label: 'Released', color: 'hsl(40,40%,60%)' },
                        dissolved: { icon: '💀', label: 'Dissolved', color: 'hsl(0,40%,55%)' },
                        challenged: { icon: '⚔️', label: 'Challenged', color: 'hsl(30,60%,60%)' },
                        war_cancelled: { icon: '🚫', label: 'Challenge Cancelled', color: 'hsl(0,30%,55%)' },
                        war_started: { icon: '🔥', label: 'War Started', color: 'hsl(0,60%,60%)' },
                        war_resolved_defender_held: { icon: '🛡️', label: 'Defender Held', color: 'hsl(210,50%,60%)' },
                      };
                      const cfg = eventConfig[h.event_type] || { icon: '📋', label: h.event_type, color: 'hsl(40,15%,55%)' };
                      const clanHex = h.clan_color ? (CLAN_COLOR_HEX[h.clan_color as ClanColor] || '#888') : null;
                      const timeAgo = (() => {
                        const diff = Date.now() - new Date(h.created_at).getTime();
                        const mins = Math.floor(diff / 60000);
                        if (mins < 1) return 'just now';
                        if (mins < 60) return `${mins}m ago`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `${hrs}h ago`;
                        return `${Math.floor(hrs / 24)}d ago`;
                      })();

                      return (
                        <div key={h.id} className="flex items-start gap-2.5 px-3 py-2 rounded-lg" style={{
                          background: 'hsla(0,0%,100%,0.02)', border: '1px solid hsla(0,0%,100%,0.04)',
                        }}>
                          <span style={{ fontSize: 13, lineHeight: '18px' }}>{cfg.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                              <span style={{ fontSize: 9, color: 'hsl(40,15%,40%)' }}>·</span>
                              <span className="truncate" style={{ fontSize: 10, fontWeight: 600, color: 'hsl(40,30%,70%)' }}>{h.territory_name}</span>
                            </div>
                            {h.clan_name && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {clanHex && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: clanHex }} />}
                                <span style={{ fontSize: 9, color: clanHex || 'hsl(40,15%,45%)' }}>{h.clan_name}</span>
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 9, color: 'hsl(40,15%,35%)', whiteSpace: 'nowrap' }}>{timeAgo}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CREATE TAB */}
            {tab === 'create' && (
              clan.myClan ? (
                <div className="text-center py-6">
                  <p className="text-xs" style={{ color: 'hsl(40,15%,45%)' }}>
                    You are already in <strong style={{ color: 'hsl(40,40%,70%)' }}>{clan.myClan.clan_name}</strong>. Leave your current clan first.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'hsl(40,20%,65%)' }}>Clan Name</label>
                    <input value={createName}
                      onChange={e => { setCreateName(e.target.value); clan.setError(null); }}
                      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleCreate(); }}
                      onKeyUp={e => e.stopPropagation()}
                      placeholder="Enter clan name (2-24 chars)..."
                      maxLength={24}
                      className="w-full px-4 py-3 rounded-lg text-sm outline-none"
                      style={inputStyle}
                    />
                    <div className="text-[10px] mt-1 px-1" style={{ color: 'hsl(40,15%,40%)' }}>
                      {createName.length}/24 · Letters, numbers, spaces, hyphens, underscores
                    </div>
                  </div>
                  <div className="mb-5">
                    <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'hsl(40,20%,65%)' }}>Clan Color</label>
                    <div className="grid grid-cols-5 gap-2">
                      {CLAN_COLOR_OPTIONS.map(c => (
                        <button key={c.value} onClick={() => setCreateColor(c.value)}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all"
                          style={{
                            background: createColor === c.value ? c.hex + '25' : 'hsla(0,0%,100%,0.03)',
                            border: createColor === c.value ? `2px solid ${c.hex}` : '1px solid hsla(0,0%,100%,0.08)',
                          }}
                        >
                          <div className="w-5 h-5 rounded-full" style={{ background: c.hex }} />
                          <span className="text-[9px]" style={{ color: createColor === c.value ? c.hex : 'hsl(40,15%,45%)' }}>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleCreate} disabled={clan.loading || createName.trim().length < 2}
                    className="w-full py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, hsl(35,60%,45%), hsl(30,50%,35%))',
                      color: 'hsl(40,30%,90%)', border: '1px solid hsla(40,30%,50%,0.3)',
                    }}
                  >
                    {clan.loading ? '⏳ Creating...' : '⚔️ Create Clan'}
                  </button>
                </div>
              )
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid hsla(0,0%,100%,0.05)' }}>
          <p className="text-[9px] text-center" style={{ color: 'hsl(40,15%,35%)' }}>
            Press C to toggle · ESC to close · 1 territory per clan · 15 min challenge countdown
          </p>
        </div>
      </div>
    </div>
  );
}
