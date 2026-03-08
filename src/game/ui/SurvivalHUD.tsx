import { SurvivalState, ResourceInventory } from '../types';

interface HUDProps {
  survival: SurvivalState;
  inventory: ResourceInventory;
  interactionText: string | null;
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-wider w-8 text-foreground/70">{label}</span>
      <div className="relative h-3 w-32 rounded-sm overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
        <div
          className="absolute inset-y-0 left-0 rounded-sm transition-all duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-mono text-foreground/60 w-8">{Math.round(value)}</span>
    </div>
  );
}

export function SurvivalHUD({ survival, inventory, interactionText }: HUDProps) {
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Survival bars - bottom left */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-1.5 p-3 rounded-lg"
        style={{ background: 'hsl(var(--hud-bg))', border: '1px solid hsl(var(--hud-border))' }}>
        <StatBar label="HP" value={survival.health} max={100} color="hsl(var(--health))" />
        <StatBar label="STA" value={survival.stamina} max={100} color="hsl(var(--stamina))" />
        <StatBar label="FD" value={survival.hunger} max={100} color="hsl(var(--hunger))" />
        <StatBar label="TMP" value={survival.temperature} max={100} color="hsl(var(--temperature))" />
      </div>

      {/* Inventory - bottom right */}
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

      {/* Interaction prompt - center bottom */}
      {interactionText && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-lg text-sm font-semibold text-foreground animate-pulse"
          style={{ background: 'hsl(var(--hud-bg))', border: '1px solid hsl(var(--hud-border))' }}>
          {interactionText}
        </div>
      )}

      {/* Controls hint - top left */}
      <div className="absolute top-4 left-4 p-3 rounded-lg text-xs text-foreground/50 leading-relaxed"
        style={{ background: 'hsl(var(--hud-bg))' }}>
        <div><kbd className="font-mono text-foreground/70">WASD</kbd> Move</div>
        <div><kbd className="font-mono text-foreground/70">SHIFT</kbd> Run</div>
        <div><kbd className="font-mono text-foreground/70">SPACE</kbd> Jump</div>
        <div><kbd className="font-mono text-foreground/70">MOUSE</kbd> Look (click to lock)</div>
        <div><kbd className="font-mono text-foreground/70">SCROLL</kbd> Zoom</div>
        <div><kbd className="font-mono text-foreground/70">E</kbd> Interact</div>
        <div><kbd className="font-mono text-foreground/70">ESC</kbd> Release cursor</div>
      </div>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-2 h-2 rounded-full border border-foreground/40" />
      </div>
    </div>
  );
}
