import { SurvivalState, ResourceInventory, ProgressionState } from '../types';
import { BuildableConfig } from '../systems/BuildingData';
import { TIER2_KILLS_REQUIRED, TIER2_STRUCTURES_REQUIRED } from '../constants';

interface HUDProps {
  survival: SurvivalState;
  inventory: ResourceInventory;
  interactionText: string | null;
  buildMode: boolean;
  selectedBuildIndex: number;
  buildFeedback: string | null;
  damageFlash: number;
  progression: ProgressionState;
  notification: string | null;
  availableBuildables: BuildableConfig[];
  isMounted?: boolean;
}

function StatBar({ label, value, max, color, warning }: {
  label: string; value: number; max: number; color: string; warning?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-bold uppercase tracking-wider w-8 ${warning ? 'text-red-400' : 'text-foreground/70'}`}>{label}</span>
      <div className="relative h-3 w-32 rounded-sm overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
        <div className={`absolute inset-y-0 left-0 rounded-sm transition-all duration-300 ${warning ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={`text-xs font-mono w-8 ${warning ? 'text-red-400' : 'text-foreground/60'}`}>{Math.round(value)}</span>
    </div>
  );
}

export function SurvivalHUD({
  survival, inventory, interactionText, buildMode, selectedBuildIndex,
  buildFeedback, damageFlash, progression, notification, availableBuildables,
  isMounted = false,
}: HUDProps) {
  const lowHunger = survival.hunger < 20;
  const lowTemp = survival.temperature < 25;
  const lowHealth = survival.health < 25;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Damage flash */}
      {damageFlash > 0 && (
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(200,0,0,0.3) 100%)' }} />
      )}

      {/* Cold overlay */}
      {lowTemp && (
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(80,120,200,0.15) 100%)' }} />
      )}

      {/* Notification banner */}
      {notification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-sm font-bold text-foreground animate-fade-in"
          style={{ background: 'hsl(var(--hud-bg))', border: '2px solid hsl(var(--primary))' }}>
          {notification}
        </div>
      )}

      {/* Survival bars */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-1.5 p-3 rounded-lg"
        style={{ background: 'hsl(var(--hud-bg))', border: '1px solid hsl(var(--hud-border))' }}>
        <StatBar label="HP" value={survival.health} max={100} color="hsl(var(--health))" warning={lowHealth} />
        <StatBar label="STA" value={survival.stamina} max={100} color="hsl(var(--stamina))" />
        <StatBar label="FD" value={survival.hunger} max={100} color="hsl(var(--hunger))" warning={lowHunger} />
        <StatBar label="TMP" value={survival.temperature} max={100} color="hsl(var(--temperature))" warning={lowTemp} />

        {/* Status effects */}
        <div className="flex gap-1 mt-1">
          {lowHunger && <span className="text-xs px-1 rounded" style={{ background: 'rgba(200,100,0,0.3)' }}>🍖 Hungry</span>}
          {lowTemp && <span className="text-xs px-1 rounded" style={{ background: 'rgba(80,120,200,0.3)' }}>❄️ Cold</span>}
          {lowHealth && <span className="text-xs px-1 rounded" style={{ background: 'rgba(200,0,0,0.3)' }}>💔 Wounded</span>}
          {isMounted && <span className="text-xs px-1 rounded" style={{ background: 'rgba(100,80,40,0.3)' }}>🐴 Mounted</span>}
        </div>
      </div>

      {/* Inventory + food hint */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-2">
        <div className="flex gap-3 p-3 rounded-lg"
          style={{ background: 'hsl(var(--hud-bg))', border: '1px solid hsl(var(--hud-border))' }}>
          <div className="flex flex-col items-center">
            <span className="text-xs text-foreground/60">🪵</span>
            <span className="text-sm font-bold text-foreground">{inventory.wood}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs text-foreground/60">🪨</span>
            <span className="text-sm font-bold text-foreground">{inventory.stone}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs text-foreground/60">🍖</span>
            <span className="text-sm font-bold text-foreground">{inventory.food}</span>
          </div>
        </div>
        {inventory.food > 0 && lowHunger && (
          <div className="px-2 py-1 rounded text-xs text-foreground/80 animate-pulse"
            style={{ background: 'hsl(var(--hud-bg))' }}>
            Press <kbd className="font-mono font-bold">F</kbd> to eat
          </div>
        )}
      </div>

      {/* Progression panel */}
      <div className="absolute top-4 right-4 p-2 rounded-lg text-xs text-foreground/60"
        style={{ background: 'hsl(var(--hud-bg))' }}>
        <div className="text-foreground/80 font-bold mb-1">
          ⚔️ Tier {progression.tier} {progression.tier >= 2 ? '— Advanced' : '— Basic'}
        </div>
        <div>Kills: {progression.enemiesKilled}{progression.tier < 2 ? ` / ${TIER2_KILLS_REQUIRED}` : ''}</div>
        <div>Built: {progression.structuresBuilt}{progression.tier < 2 ? ` / ${TIER2_STRUCTURES_REQUIRED}` : ''}</div>
        {progression.areasSecured.length > 0 && (
          <div className="mt-1 text-foreground/50">
            🏴 Secured: {progression.areasSecured.join(', ')}
          </div>
        )}
      </div>

      {/* Build mode panel */}
      {buildMode && (
        <div className="absolute top-24 right-4 p-3 rounded-lg min-w-52"
          style={{ background: 'hsl(var(--hud-bg))', border: '1px solid hsl(var(--hud-border))' }}>
          <div className="text-sm font-bold text-foreground mb-2">🔨 Build Mode</div>
          {availableBuildables.map((b, i) => (
            <div key={b.type}
              className={`text-xs py-1 px-2 rounded mb-0.5 ${i === selectedBuildIndex ? 'text-foreground font-bold' : 'text-foreground/50'}`}
              style={i === selectedBuildIndex ? { background: 'hsl(var(--primary) / 0.3)' } : {}}>
              <div>{b.label} — {b.description}</div>
              {b.effect && i === selectedBuildIndex && (
                <div className="text-foreground/40 text-[10px] mt-0.5">{b.effect}</div>
              )}
            </div>
          ))}
          <div className="text-xs text-foreground/40 mt-2">
            <div><kbd className="font-mono text-foreground/60">Q/R</kbd> Cycle</div>
            <div><kbd className="font-mono text-foreground/60">Click</kbd> Place</div>
            <div><kbd className="font-mono text-foreground/60">B</kbd> Exit</div>
          </div>
        </div>
      )}

      {/* Build feedback */}
      {buildMode && buildFeedback && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-lg text-sm font-semibold text-foreground"
          style={{ background: 'hsl(var(--hud-bg))', border: '1px solid hsl(var(--hud-border))' }}>
          {buildFeedback}
        </div>
      )}

      {/* Interaction prompt */}
      {!buildMode && interactionText && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-lg text-sm font-semibold text-foreground animate-pulse"
          style={{ background: 'hsl(var(--hud-bg))', border: '1px solid hsl(var(--hud-border))' }}>
          {interactionText}
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-4 left-4 p-3 rounded-lg text-xs text-foreground/50 leading-relaxed"
        style={{ background: 'hsl(var(--hud-bg))' }}>
        <div><kbd className="font-mono text-foreground/70">WASD</kbd> Move</div>
        <div><kbd className="font-mono text-foreground/70">SHIFT</kbd> Run</div>
        {!isMounted && <div><kbd className="font-mono text-foreground/70">SPACE</kbd> Jump</div>}
        <div><kbd className="font-mono text-foreground/70">MOUSE</kbd> Look</div>
        {!isMounted && <div><kbd className="font-mono text-foreground/70">CLICK</kbd> Attack</div>}
        <div><kbd className="font-mono text-foreground/70">E</kbd> {isMounted ? 'Dismount' : 'Interact'}</div>
        <div><kbd className="font-mono text-foreground/70">F</kbd> Eat Food</div>
        {!isMounted && <div><kbd className="font-mono text-foreground/70">B</kbd> Build</div>}
        <div><kbd className="font-mono text-foreground/70">SCROLL</kbd> Zoom</div>
      </div>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className={`w-2 h-2 rounded-full border ${buildMode ? 'border-primary' : 'border-foreground/40'}`} />
      </div>
    </div>
  );
}
