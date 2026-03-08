import { SurvivalState, ResourceInventory } from '../types';
import { BUILDABLES } from '../systems/BuildingData';

interface HUDProps {
  survival: SurvivalState;
  inventory: ResourceInventory;
  interactionText: string | null;
  buildMode: boolean;
  selectedBuildIndex: number;
  buildFeedback: string | null;
  damageFlash: number;
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-wider w-8 text-foreground/70">{label}</span>
      <div className="relative h-3 w-32 rounded-sm overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
        <div className="absolute inset-y-0 left-0 rounded-sm transition-all duration-300"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-foreground/60 w-8">{Math.round(value)}</span>
    </div>
  );
}

export function SurvivalHUD({
  survival, inventory, interactionText, buildMode, selectedBuildIndex, buildFeedback, damageFlash,
}: HUDProps) {
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Damage flash overlay */}
      {damageFlash > 0 && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(200,0,0,0.3) 100%)' }} />
      )}

      {/* Survival bars */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-1.5 p-3 rounded-lg"
        style={{ background: 'hsl(var(--hud-bg))', border: '1px solid hsl(var(--hud-border))' }}>
        <StatBar label="HP" value={survival.health} max={100} color="hsl(var(--health))" />
        <StatBar label="STA" value={survival.stamina} max={100} color="hsl(var(--stamina))" />
        <StatBar label="FD" value={survival.hunger} max={100} color="hsl(var(--hunger))" />
        <StatBar label="TMP" value={survival.temperature} max={100} color="hsl(var(--temperature))" />
      </div>

      {/* Inventory */}
      <div className="absolute bottom-6 right-6 flex gap-3 p-3 rounded-lg"
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

      {/* Build mode panel */}
      {buildMode && (
        <div className="absolute top-4 right-4 p-3 rounded-lg min-w-48"
          style={{ background: 'hsl(var(--hud-bg))', border: '1px solid hsl(var(--hud-border))' }}>
          <div className="text-sm font-bold text-foreground mb-2">🔨 Build Mode</div>
          {BUILDABLES.map((b, i) => (
            <div key={b.type}
              className={`text-xs py-1 px-2 rounded mb-0.5 ${i === selectedBuildIndex ? 'text-foreground font-bold' : 'text-foreground/50'}`}
              style={i === selectedBuildIndex ? { background: 'hsl(var(--primary) / 0.3)' } : {}}>
              {b.label} — {b.description}
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

      {/* Interaction prompt (non-build) */}
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
        <div><kbd className="font-mono text-foreground/70">SPACE</kbd> Jump</div>
        <div><kbd className="font-mono text-foreground/70">MOUSE</kbd> Look</div>
        <div><kbd className="font-mono text-foreground/70">CLICK</kbd> Attack</div>
        <div><kbd className="font-mono text-foreground/70">E</kbd> Gather</div>
        <div><kbd className="font-mono text-foreground/70">B</kbd> Build</div>
        <div><kbd className="font-mono text-foreground/70">SCROLL</kbd> Zoom</div>
        <div><kbd className="font-mono text-foreground/70">ESC</kbd> Release</div>
      </div>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className={`w-2 h-2 rounded-full border ${buildMode ? 'border-primary' : 'border-foreground/40'}`} />
      </div>
    </div>
  );
}
