/**
 * Clan & Territory Panel — Phase 1 UI
 * Opens with 'C' key. Medieval-styled overlay for clan management and territory view.
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
} from '../hooks/useClanSystem';

interface Props {
  open: boolean;
  onClose: () => void;
  playerX: number;
  playerZ: number;
}

type Tab = 'my_clan' | 'browse' | 'territories' | 'create';

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

export function ClanPanel({ open, onClose, playerX, playerZ }: Props) {
  const clan = useClanSystem();
  const [tab, setTab] = useState<Tab>('my_clan');
  const [createName, setCreateName] = useState('');
  const [createColor, setCreateColor] = useState<ClanColor>('crimson');
  const [confirmLeave, setConfirmLeave] = useState(false);

  const wallet = loadWalletSession();
  const isWallet = !!wallet?.wallet_address && !!wallet?.session_token;

  // Refresh on open
  useEffect(() => {
    if (open) {
      clan.refresh();
      setConfirmLeave(false);
      clan.setError(null);
    }
  }, [open]); // eslint-disable-line

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [open, onClose]);

  // Auto-switch to my_clan if we have one, or create if we don't
  useEffect(() => {
    if (open && isWallet) {
      setTab(clan.myClan ? 'my_clan' : 'browse');
    }
  }, [open, clan.myClan, isWallet]);

  const handleCreate = useCallback(async () => {
    if (!createName.trim()) return;
    const result = await clan.createClan(createName.trim(), createColor);
    if (result) {
      setCreateName('');
      setTab('my_clan');
    }
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

  if (!open) return null;

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
          <button
            onClick={onClose}
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
              {(['my_clan', 'browse', 'territories', 'create'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); clan.setError(null); setConfirmLeave(false); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                  style={btnStyle(tab === t)}
                >
                  {t === 'my_clan' ? 'My Clan' : t === 'browse' ? 'Browse' : t === 'territories' ? 'Territories' : '+ Create'}
                </button>
              ))}
            </div>

            {/* Error display */}
            {clan.error && (
              <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{
                background: 'hsla(0,50%,40%,0.1)', color: 'hsl(0,60%,65%)', border: '1px solid hsla(0,50%,50%,0.2)',
              }}>
                ⚠️ {clan.error}
              </div>
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

                  {/* Owned territories */}
                  <div className="mb-4">
                    <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'hsl(40,20%,55%)' }}>
                      Owned Territories
                    </div>
                    {clan.territories.filter(t => t.owning_clan_id === clan.myClan!.clan_id).length > 0 ? (
                      clan.territories.filter(t => t.owning_clan_id === clan.myClan!.clan_id).map(t => (
                        <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1" style={{
                          background: 'hsla(120,30%,30%,0.08)', border: '1px solid hsla(120,30%,40%,0.15)',
                        }}>
                          <span className="text-xs font-bold" style={{ color: 'hsl(120,40%,65%)' }}>🏴 {t.name}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs px-3 py-2 rounded-lg" style={{
                        color: 'hsl(40,15%,40%)', background: 'hsla(0,0%,100%,0.02)',
                      }}>
                        No territories claimed yet. Visit a territory and claim it!
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleLeave}
                    disabled={clan.loading}
                    className="w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: confirmLeave ? 'hsla(0,60%,40%,0.3)' : 'hsla(0,30%,30%,0.1)',
                      color: confirmLeave ? 'hsl(0,70%,70%)' : 'hsl(0,30%,55%)',
                      border: '1px solid hsla(0,40%,40%,0.2)',
                    }}
                  >
                    {confirmLeave ? '⚠️ Confirm Leave? (territories will be released if you are the last member)' : 'Leave Clan'}
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm mb-3" style={{ color: 'hsl(40,20%,60%)' }}>You are not in a clan</p>
                  <p className="text-xs" style={{ color: 'hsl(40,15%,40%)' }}>
                    Browse existing clans to join, or create your own
                  </p>
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
                          <button
                            onClick={() => handleJoin(c.id)}
                            disabled={clan.loading || c.member_count >= c.max_members}
                            className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
                            style={{
                              background: 'hsla(120,40%,40%,0.15)',
                              color: 'hsl(120,50%,65%)',
                              border: '1px solid hsla(120,40%,50%,0.2)',
                            }}
                          >
                            Join
                          </button>
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
                    const canClaim = !t.owning_clan_id && clan.myClan?.role === 'leader' && t.war_state === 'peaceful';
                    const dist = Math.sqrt((playerX - t.center_x) ** 2 + (playerZ - t.center_z) ** 2);
                    const inRange = dist <= t.radius + 30;
                    return (
                      <div key={t.id} className="px-3 py-2.5 rounded-lg" style={{
                        background: t.owning_clan_id
                          ? `${CLAN_COLOR_HEX[t.owning_clan_color as ClanColor] || '#666'}10`
                          : 'hsla(0,0%,100%,0.03)',
                        border: t.owning_clan_id
                          ? `1px solid ${CLAN_COLOR_HEX[t.owning_clan_color as ClanColor] || '#666'}30`
                          : '1px solid hsla(0,0%,100%,0.06)',
                      }}>
                        <div className="flex items-center gap-2 mb-1">
                          {t.owning_clan_color && (
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: CLAN_COLOR_HEX[t.owning_clan_color] }} />
                          )}
                          <span className="text-xs font-bold" style={{ color: 'hsl(40,40%,80%)' }}>{t.name}</span>
                          <span className="ml-auto text-[10px]" style={{ color: 'hsl(40,15%,40%)' }}>
                            {inRange ? '📍 In range' : `${Math.round(dist)} units away`}
                          </span>
                        </div>
                        <div className="text-[10px]" style={{ color: 'hsl(40,15%,45%)' }}>
                          {t.owning_clan_name
                            ? `🏴 Owned by ${t.owning_clan_name}`
                            : '⬜ Unclaimed — available for capture'
                          }
                        </div>
                        {canClaim && (
                          <button
                            onClick={() => handleClaim(t)}
                            disabled={clan.loading || !inRange}
                            className="mt-2 w-full py-1.5 rounded text-[10px] font-bold uppercase tracking-wider disabled:opacity-40"
                            style={{
                              background: inRange ? 'hsla(40,50%,40%,0.2)' : 'hsla(0,0%,100%,0.03)',
                              color: inRange ? 'hsl(40,50%,75%)' : 'hsl(40,15%,40%)',
                              border: '1px solid hsla(40,40%,50%,0.2)',
                            }}
                          >
                            {inRange ? '🏴 Claim for ' + clan.myClan!.clan_name : 'Travel closer to claim'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
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
                    <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'hsl(40,20%,65%)' }}>
                      Clan Name
                    </label>
                    <input
                      value={createName}
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
                    <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'hsl(40,20%,65%)' }}>
                      Clan Color
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {CLAN_COLOR_OPTIONS.map(c => (
                        <button
                          key={c.value}
                          onClick={() => setCreateColor(c.value)}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all"
                          style={{
                            background: createColor === c.value ? c.hex + '25' : 'hsla(0,0%,100%,0.03)',
                            border: createColor === c.value ? `2px solid ${c.hex}` : '1px solid hsla(0,0%,100%,0.08)',
                          }}
                        >
                          <div className="w-5 h-5 rounded-full" style={{ background: c.hex }} />
                          <span className="text-[9px]" style={{ color: createColor === c.value ? c.hex : 'hsl(40,15%,45%)' }}>
                            {c.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleCreate}
                    disabled={clan.loading || createName.trim().length < 2}
                    className="w-full py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, hsl(35,60%,45%), hsl(30,50%,35%))',
                      color: 'hsl(40,30%,90%)',
                      border: '1px solid hsla(40,30%,50%,0.3)',
                    }}
                  >
                    {clan.loading ? '⏳ Creating...' : '⚔️ Create Clan'}
                  </button>
                </div>
              )
            )}
          </>
        )}

        {/* Footer info */}
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid hsla(0,0%,100%,0.05)' }}>
          <p className="text-[9px] text-center" style={{ color: 'hsl(40,15%,35%)' }}>
            Press C to toggle · Press ESC to close · Ironhold remains neutral
          </p>
        </div>
      </div>
    </div>
  );
}
