/**
 * Territory entry/exit notification — shows when player enters a territory zone.
 * Also renders floating territory banners at kingdom gates (3D markers).
 */
import { useState, useEffect, useRef } from 'react';
import { TerritoryInfo, CLAN_COLOR_HEX, ClanColor } from '../hooks/useClanSystem';

interface Props {
  territories: TerritoryInfo[];
  playerX: number;
  playerZ: number;
}

export function TerritoryIndicator({ territories, playerX, playerZ }: Props) {
  const [currentTerritory, setCurrentTerritory] = useState<TerritoryInfo | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const lastTerritoryRef = useRef<string | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // Find which territory the player is in
    let inside: TerritoryInfo | null = null;
    for (const t of territories) {
      const dx = playerX - t.center_x;
      const dz = playerZ - t.center_z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= t.radius) {
        inside = t;
        break;
      }
    }

    const newId = inside?.id ?? null;
    if (newId !== lastTerritoryRef.current) {
      lastTerritoryRef.current = newId;
      setCurrentTerritory(inside);
      if (inside) {
        setShowBanner(true);
        if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = setTimeout(() => setShowBanner(false), 4000);
      } else {
        setShowBanner(false);
      }
    }
  }, [playerX, playerZ, territories]);

  if (!showBanner || !currentTerritory) return null;

  const color = currentTerritory.owning_clan_color
    ? CLAN_COLOR_HEX[currentTerritory.owning_clan_color as ClanColor]
    : '#888';

  return (
    <div
      className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      style={{
        animation: 'fadeInSlide 0.6s ease-out',
      }}
    >
      <div
        className="px-6 py-3 rounded-xl text-center"
        style={{
          background: `linear-gradient(135deg, ${color}20, ${color}08)`,
          border: `1px solid ${color}40`,
          backdropFilter: 'blur(12px)',
          boxShadow: `0 8px 32px ${color}15`,
        }}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ background: color }} />
          <span
            className="text-sm font-bold tracking-wide"
            style={{ color: 'hsl(40,50%,88%)' }}
          >
            {currentTerritory.name}
          </span>
        </div>
        <div className="text-[10px]" style={{ color: 'hsl(40,15%,55%)' }}>
          {currentTerritory.owning_clan_name
            ? `🏴 Controlled by ${currentTerritory.owning_clan_name}`
            : '⬜ Unclaimed Territory'
          }
        </div>
      </div>

      <style>{`
        @keyframes fadeInSlide {
          from { opacity: 0; transform: translate(-50%, -12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
