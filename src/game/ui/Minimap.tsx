/**
 * Minimap HUD — top-right corner showing player position, settlements, roads, horse, territory ownership.
 * Medieval-styled circular minimap with parchment aesthetic.
 */
import { useRef, useEffect, useCallback } from 'react';
import { SETTLEMENTS, REGIONS, ROADS, SMALL_POIS, LANDMARKS, getRegionAt } from '../world/RegionData';
import { TerritoryInfo, CLAN_COLOR_HEX, ClanColor } from '../hooks/useClanSystem';

interface MinimapProps {
  playerX: number;
  playerZ: number;
  playerRotation: number;
  horseX: number;
  horseZ: number;
  isMounted: boolean;
  mapOpen: boolean;
  onCloseMap: () => void;
  territories?: TerritoryInfo[];
}

const MAP_SIZE = 160; // minimap size in pixels
const MAP_WORLD_RADIUS = 120; // world units visible from center
const FULL_MAP_WORLD = 850; // full map view radius — expanded world

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  size: number,
  worldRadius: number,
  playerX: number,
  playerZ: number,
  playerRot: number,
  horseX: number,
  horseZ: number,
  isMounted: boolean,
  fullMap: boolean,
  territories?: TerritoryInfo[],
) {
  const half = size / 2;
  const scale = half / worldRadius;

  ctx.clearRect(0, 0, size, size);

  // Background
  if (fullMap) {
    ctx.fillStyle = '#d4c8a0';
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.fillStyle = '#c4b890';
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Transform: center on player (or world center for full map)
  const cx = fullMap ? 0 : playerX;
  const cz = fullMap ? 0 : playerZ;

  // Region colors (base) — war-state aware
  for (const r of REGIONS) {
    const rx = (r.center[0] - cx) * scale + half;
    const rz = (r.center[1] - cz) * scale + half;
    const rr = r.radius * scale;
    const territory = territories?.find(t => t.id === r.id);
    const warState = territory?.war_state || 'peaceful';
    if (territory?.owning_clan_color) {
      const clanHex = CLAN_COLOR_HEX[territory.owning_clan_color as ClanColor] || r.color;
      ctx.fillStyle = clanHex + '50';
      ctx.beginPath();
      ctx.arc(rx, rz, rr, 0, Math.PI * 2);
      ctx.fill();
      // War-state ring styling
      if (warState === 'contested') {
        ctx.strokeStyle = '#e67e22cc';
        ctx.lineWidth = fullMap ? 3 : 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (warState === 'active_war') {
        ctx.strokeStyle = '#e74c3cee';
        ctx.lineWidth = fullMap ? 3.5 : 2.5;
        ctx.stroke();
        // Pulsing inner glow
        ctx.strokeStyle = '#e74c3c60';
        ctx.lineWidth = fullMap ? 6 : 4;
        ctx.stroke();
      } else if (warState === 'cooldown') {
        ctx.strokeStyle = '#3498db80';
        ctx.lineWidth = fullMap ? 2 : 1.5;
        ctx.setLineDash([3, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = clanHex + '80';
        ctx.lineWidth = fullMap ? 2.5 : 1.5;
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = r.color + '40';
      ctx.beginPath();
      ctx.arc(rx, rz, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Roads
  ctx.strokeStyle = '#6b5b47';
  ctx.lineWidth = fullMap ? 2 : 1.5;
  for (const road of ROADS) {
    const fx = (road.from[0] - cx) * scale + half;
    const fz = (road.from[1] - cz) * scale + half;
    const tx = (road.to[0] - cx) * scale + half;
    const tz = (road.to[1] - cz) * scale + half;
    ctx.beginPath();
    ctx.moveTo(fx, fz);
    ctx.lineTo(tx, tz);
    ctx.stroke();
  }

  // Small POIs
  if (fullMap) {
    ctx.fillStyle = '#8a7a5a';
    for (const poi of SMALL_POIS) {
      const sx = (poi.position[0] - cx) * scale + half;
      const sz = (poi.position[1] - cz) * scale + half;
      ctx.beginPath();
      ctx.arc(sx, sz, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Settlements
  for (const s of SETTLEMENTS) {
    const sx = (s.position[0] - cx) * scale + half;
    const sz = (s.position[1] - cz) * scale + half;
    if (!fullMap && (sx < -10 || sx > size + 10 || sz < -10 || sz > size + 10)) continue;

    const dotSize = s.size === 'large' ? 5 : s.size === 'medium' ? 3.5 : 2.5;
    const color = s.type === 'capital' ? '#c4a040' :
      s.type === 'village' ? '#4a8a3a' :
      s.type === 'fort' ? '#6a6a8a' :
      s.type === 'ruins' ? '#7a6a4a' :
      s.type === 'bandit_camp' ? '#8a3a3a' :
      s.type === 'monastery' ? '#9a9aaa' : '#5a7a4a';

    ctx.fillStyle = color;
    if (s.type === 'capital') {
      // Diamond shape for capital
      ctx.beginPath();
      ctx.moveTo(sx, sz - dotSize);
      ctx.lineTo(sx + dotSize, sz);
      ctx.lineTo(sx, sz + dotSize);
      ctx.lineTo(sx - dotSize, sz);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8a7020';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(sx, sz, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Labels on full map
    if (fullMap) {
      ctx.fillStyle = '#2a1a0a';
      ctx.font = s.size === 'large' ? 'bold 11px serif' : '9px serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.name, sx, sz - dotSize - 4);
    }
  }

  // Landmarks on full map
  if (fullMap) {
    for (const lm of LANDMARKS) {
      const lx = (lm.position[0] - cx) * scale + half;
      const lz = (lm.position[1] - cz) * scale + half;
      ctx.fillStyle = '#5a4a2a';
      ctx.beginPath();
      ctx.moveTo(lx, lz - 4);
      ctx.lineTo(lx + 3, lz + 2);
      ctx.lineTo(lx - 3, lz + 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Territory ownership labels on full map
  if (fullMap && territories) {
    for (const t of territories) {
      const tx = (t.center_x - cx) * scale + half;
      const tz = (t.center_z - cz) * scale + half;
      if (t.owning_clan_name && t.owning_clan_color) {
        const cHex = CLAN_COLOR_HEX[t.owning_clan_color as ClanColor] || '#888';
        ctx.fillStyle = cHex;
        ctx.font = 'bold 8px serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🏴 ${t.owning_clan_name}`, tx, tz + 12);
      } else {
        ctx.fillStyle = '#6a6a6a80';
        ctx.font = 'italic 7px serif';
        ctx.textAlign = 'center';
        ctx.fillText('Unclaimed', tx, tz + 12);
      }
    }
  }

  // Horse position
  if (!isMounted) {
    const hx = (horseX - cx) * scale + half;
    const hz = (horseZ - cz) * scale + half;
    if (hx > 0 && hx < size && hz > 0 && hz < size) {
      ctx.fillStyle = '#6a4a2a';
      ctx.beginPath();
      ctx.arc(hx, hz, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4a3218';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Player indicator
  const ppx = (playerX - cx) * scale + half;
  const ppz = (playerZ - cz) * scale + half;
  ctx.save();
  ctx.translate(ppx, ppz);
  ctx.rotate(playerRot);
  ctx.fillStyle = '#e0c040';
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(3.5, 4);
  ctx.lineTo(-3.5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8a7020';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Minimap border
  if (!fullMap) {
    ctx.strokeStyle = '#4a3a20';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.stroke();
    // Compass N
    ctx.fillStyle = '#8a2020';
    ctx.font = 'bold 10px serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', half, 14);
  }

  // Region name at bottom
  if (!fullMap) {
    const region = getRegionAt(playerX, playerZ);
    if (region) {
      ctx.fillStyle = '#2a1a0a';
      ctx.font = '8px serif';
      ctx.textAlign = 'center';
      ctx.fillText(region.name, half, size - 6);
    }
  }

  // Full map title and frame
  if (fullMap) {
    // Parchment border
    ctx.strokeStyle = '#4a3a20';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, size - 4, size - 4);
    ctx.strokeStyle = '#8a7a5a';
    ctx.lineWidth = 1;
    ctx.strokeRect(6, 6, size - 12, size - 12);

    // Title
    ctx.fillStyle = '#2a1a0a';
    ctx.font = 'bold 16px serif';
    ctx.textAlign = 'center';
    ctx.fillText('The Realm', size / 2, 24);

    // Region names
    for (const r of REGIONS) {
      const rx = (r.center[0] - cx) * scale + half;
      const rz = (r.center[1] - cz) * scale + half;
      ctx.fillStyle = '#4a3a2a80';
      ctx.font = 'italic 9px serif';
      ctx.fillText(r.name, rx, rz + r.radius * scale * 0.5);
    }

    ctx.fillStyle = '#4a3a2a';
    ctx.font = '10px serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press M to close', size / 2, size - 10);
  }
}

export function Minimap({
  playerX, playerZ, playerRotation,
  horseX, horseZ, isMounted, mapOpen, onCloseMap, territories,
}: MinimapProps) {
  const miniRef = useRef<HTMLCanvasElement>(null);
  const fullRef = useRef<HTMLCanvasElement>(null);

  const drawMini = useCallback(() => {
    const canvas = miniRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawMinimap(ctx, MAP_SIZE, MAP_WORLD_RADIUS, playerX, playerZ, playerRotation,
      horseX, horseZ, isMounted, false, territories);
  }, [playerX, playerZ, playerRotation, horseX, horseZ, isMounted, territories]);

  const drawFull = useCallback(() => {
    const canvas = fullRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawMinimap(ctx, 600, FULL_MAP_WORLD, playerX, playerZ, playerRotation,
      horseX, horseZ, isMounted, true, territories);
  }, [playerX, playerZ, playerRotation, horseX, horseZ, isMounted, territories]);

  useEffect(() => {
    if (!mapOpen) drawMini();
    else drawFull();
  }, [drawMini, drawFull, mapOpen]);

  return (
    <>
      {/* Minimap — top right */}
      {!mapOpen && (
        <div className="absolute right-4 pointer-events-none" style={{ width: MAP_SIZE, height: MAP_SIZE, top: 130, zIndex: 50 }}>
          <canvas ref={miniRef} width={MAP_SIZE} height={MAP_SIZE}
            style={{ width: MAP_SIZE, height: MAP_SIZE, borderRadius: '50%' }} />
        </div>
      )}

      {/* Full map overlay */}
      {mapOpen && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto"
          style={{ background: 'rgba(0,0,0,0.6)', zIndex: 60 }} onClick={onCloseMap}>
          <canvas ref={fullRef} width={600} height={600}
            style={{ width: 600, height: 600, borderRadius: 8, boxShadow: '0 0 40px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
