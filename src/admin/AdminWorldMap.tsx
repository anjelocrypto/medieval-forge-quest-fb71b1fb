/**
 * Admin 2D World Map — Phase 1
 * Read-only top-down visualization of the entire Trencheria world.
 * Renders all layers from real exported game data on HTML Canvas 2D.
 */
import { useRef, useEffect, useState, useCallback } from 'react';

// ===== Real world data imports =====
import { WORLD_SIZE, HALF_WORLD } from '../game/constants';
import { REGIONS, SETTLEMENTS, ROADS, SMALL_POIS, LANDMARKS } from '../game/world/RegionData';
import { LINE_A_WAYPOINTS, LINE_B_WAYPOINTS, RAILWAY_STATIONS } from '../game/world/RailwayData';
import { RIVERS, LAKES } from '../game/world/WaterData';
import { BRIDGES } from '../game/world/BridgeData';
import { TOWN_BUILDINGS } from '../game/components/TownDistrict';
import { WILDERNESS_BUILDINGS } from '../game/components/WildernessStructures';
import {
  FORTIFIED_CITY_HOUSES, RIVER_TOWN_HOUSES, MOUNTAIN_HOLD_HOUSES,
  FRONTIER_CAMP_HOUSES, TRADE_CITY_HOUSES,
} from '../game/world/KingdomBuildingData';

// ===== Types =====
interface LayerState {
  regions: boolean;
  settlements: boolean;
  roads: boolean;
  railways: boolean;
  stations: boolean;
  water: boolean;
  bridges: boolean;
  pois: boolean;
  buildings: boolean;
  landmarks: boolean;
}

interface ViewState {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

interface HoverInfo {
  worldX: number;
  worldZ: number;
  label?: string;
  type?: string;
}

// Kingdom house mapping: settlement type → house array + settlement position
const KINGDOM_HOUSE_MAP: Record<string, { houses: typeof FORTIFIED_CITY_HOUSES; settlementId: string }> = {
  'fortified_city': { houses: FORTIFIED_CITY_HOUSES, settlementId: 'thornwall_city' },
  'river_town': { houses: RIVER_TOWN_HOUSES, settlementId: 'rivermoor_city' },
  'mountain_hold': { houses: MOUNTAIN_HOLD_HOUSES, settlementId: 'stonepeak_hold' },
  'frontier_camp': { houses: FRONTIER_CAMP_HOUSES, settlementId: 'darkhollow_camp' },
  'trade_city': { houses: TRADE_CITY_HOUSES, settlementId: 'goldenvale_city' },
};

// ===== POI type icons =====
const POI_ICONS: Record<string, string> = {
  shrine: '⛩', wagon: '🛒', bridge: '🌉', graveyard: '⚰', hunter_camp: '🏕',
  ruined_house: '🏚', watchtower: '🗼', cave: '🕳', watchpost: '👁', inn: '🏨',
  clearing: '🌿', stone_circle: '⭕', pond: '💧', burned_village: '🔥',
  supply_depot: '📦', crossroads: '✚', milestone: '🪨', lantern_post: '🏮',
  roadside_cross: '✝', abandoned_camp: '⛺', gallows: '⚖',
};

const SETTLEMENT_COLORS: Record<string, string> = {
  capital: '#ffd700',
  village: '#8bc34a',
  fort: '#ff5722',
  ruins: '#9e9e9e',
  bandit_camp: '#f44336',
  outpost: '#ff9800',
  monastery: '#ce93d8',
  fortified_city: '#b0bec5',
  river_town: '#4fc3f7',
  mountain_hold: '#78909c',
  frontier_camp: '#a1887f',
  trade_city: '#ffb74d',
};

// ===== Canvas renderer =====
function worldToScreen(wx: number, wz: number, view: ViewState, canvas: HTMLCanvasElement): [number, number] {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const sx = cx + (wx - view.offsetX) * view.zoom;
  const sy = cy + (wz - view.offsetY) * view.zoom;
  return [sx, sy];
}

function screenToWorld(sx: number, sy: number, view: ViewState, canvas: HTMLCanvasElement): [number, number] {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const wx = (sx - cx) / view.zoom + view.offsetX;
  const wz = (sy - cy) / view.zoom + view.offsetY;
  return [wx, wz];
}

function drawMap(ctx: CanvasRenderingContext2D, view: ViewState, layers: LayerState, dpr: number) {
  const canvas = ctx.canvas;
  const w = canvas.width;
  const h = canvas.height;

  // Clear
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);

  // Helper
  const toS = (wx: number, wz: number): [number, number] => worldToScreen(wx, wz, view, canvas);

  // World boundary
  {
    const [x1, y1] = toS(-HALF_WORLD, -HALF_WORLD);
    const [x2, y2] = toS(HALF_WORLD, HALF_WORLD);
    ctx.strokeStyle = '#334';
    ctx.lineWidth = 2;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    // Grid lines every 100 units
    ctx.strokeStyle = '#222238';
    ctx.lineWidth = 0.5;
    const step = 100;
    for (let g = -HALF_WORLD; g <= HALF_WORLD; g += step) {
      const [gx1, gy1] = toS(g, -HALF_WORLD);
      const [gx2, gy2] = toS(g, HALF_WORLD);
      ctx.beginPath(); ctx.moveTo(gx1, gy1); ctx.lineTo(gx2, gy2); ctx.stroke();
      const [hx1, hy1] = toS(-HALF_WORLD, g);
      const [hx2, hy2] = toS(HALF_WORLD, g);
      ctx.beginPath(); ctx.moveTo(hx1, hy1); ctx.lineTo(hx2, hy2); ctx.stroke();
    }
  }

  // ===== REGIONS =====
  if (layers.regions) {
    for (const r of REGIONS) {
      const [cx, cy] = toS(r.center[0], r.center[1]);
      const sr = r.radius * view.zoom;
      ctx.beginPath();
      ctx.arc(cx, cy, sr, 0, Math.PI * 2);
      ctx.fillStyle = r.color + '30';
      ctx.fill();
      ctx.strokeStyle = r.color + '80';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      if (view.zoom > 0.15) {
        ctx.fillStyle = r.color + 'cc';
        ctx.font = `${Math.max(9, Math.min(13, view.zoom * 14))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(r.name, cx, cy - sr - 4);
        // Danger indicator
        if (r.danger > 0) {
          ctx.fillStyle = r.danger >= 3 ? '#f44' : r.danger >= 2 ? '#fa0' : '#aa0';
          ctx.fillText(`⚠ Danger ${r.danger}`, cx, cy - sr - 16);
        }
      }
    }
  }

  // ===== WATER (rivers + lakes) =====
  if (layers.water) {
    // Rivers
    for (const river of RIVERS) {
      if (river.points.length < 2) continue;
      ctx.beginPath();
      const [sx, sy] = toS(river.points[0][0], river.points[0][2]);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < river.points.length; i++) {
        const [px, py] = toS(river.points[i][0], river.points[i][2]);
        ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#2196f380';
      ctx.lineWidth = Math.max(2, river.width * view.zoom * 0.6);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Lakes
    for (const lake of LAKES) {
      const [cx, cy] = toS(lake.position[0], lake.position[2]);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(lake.rotation);
      ctx.beginPath();
      ctx.ellipse(0, 0, lake.radiusX * view.zoom, lake.radiusZ * view.zoom, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1565c050';
      ctx.fill();
      ctx.strokeStyle = '#2196f360';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ===== ROADS =====
  if (layers.roads) {
    for (const road of ROADS) {
      const [x1, y1] = toS(road.from[0], road.from[1]);
      const [x2, y2] = toS(road.to[0], road.to[1]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#8d6e4680';
      ctx.lineWidth = Math.max(1, road.width * view.zoom * 0.3);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  // ===== BRIDGES =====
  if (layers.bridges) {
    for (const bridge of BRIDGES) {
      const [cx, cy] = toS(bridge.position[0], bridge.position[2]);
      const bLen = bridge.length * view.zoom;
      const bWid = bridge.width * view.zoom;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(bridge.rotation);
      ctx.fillStyle = bridge.style === 'grand' ? '#9e9e9e90' : bridge.style === 'stone' ? '#78909c80' : '#8d6e4680';
      ctx.fillRect(-bWid / 2, -bLen / 2, bWid, bLen);
      ctx.strokeStyle = '#fff3';
      ctx.lineWidth = 1;
      ctx.strokeRect(-bWid / 2, -bLen / 2, bWid, bLen);
      ctx.restore();

      if (view.zoom > 0.3) {
        ctx.fillStyle = '#bbb';
        ctx.font = `${Math.max(8, view.zoom * 9)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(bridge.id.replace('bridge-', ''), cx, cy - bLen / 2 - 3);
      }
    }
  }

  // ===== RAILWAYS =====
  if (layers.railways) {
    const drawLine = (wps: typeof LINE_A_WAYPOINTS, color: string) => {
      if (wps.length < 2) return;
      ctx.beginPath();
      const [sx, sy] = toS(wps[0].x, wps[0].z);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < wps.length; i++) {
        const [px, py] = toS(wps[i].x, wps[i].z);
        ctx.lineTo(px, py);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, view.zoom * 3);
      ctx.setLineDash([view.zoom * 6, view.zoom * 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Waypoint dots
      if (view.zoom > 0.3) {
        for (const wp of wps) {
          const [wx, wy] = toS(wp.x, wp.z);
          ctx.beginPath();
          ctx.arc(wx, wy, 2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
    };
    drawLine(LINE_A_WAYPOINTS, '#e91e63cc');
    drawLine(LINE_B_WAYPOINTS, '#ff9800cc');
  }

  // ===== RAILWAY STATIONS =====
  if (layers.stations) {
    for (const stn of RAILWAY_STATIONS) {
      const [sx, sy] = toS(stn.position[0], stn.position[1]);
      const r = Math.max(4, view.zoom * 5);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = stn.stationType === 'capital' ? '#ffd700' :
        stn.stationType === 'large' ? '#ff9800' :
        stn.stationType === 'medium' ? '#4caf50' : '#90a4ae';
      ctx.fill();
      ctx.strokeStyle = '#fff8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (view.zoom > 0.2) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(9, view.zoom * 11)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`🚂 ${stn.name}`, sx, sy - r - 4);
      }
    }
  }

  // ===== BUILDINGS (town district + wilderness + kingdom houses) =====
  if (layers.buildings) {
    const drawBuilding = (x: number, z: number, w: number, d: number, rot: number, color: string) => {
      const [cx, cy] = toS(x, z);
      const bw = Math.max(2, w * view.zoom);
      const bd = Math.max(2, d * view.zoom);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = color;
      ctx.fillRect(-bw / 2, -bd / 2, bw, bd);
      ctx.restore();
    };

    // Town district
    for (const b of TOWN_BUILDINGS) {
      drawBuilding(b.x, b.z, b.w, b.d, b.rot, '#8d6e4690');
    }

    // Wilderness
    for (const b of WILDERNESS_BUILDINGS) {
      const col = b.type === 'ruin' ? '#9e9e9e70' : b.type === 'camp' ? '#ff980050' :
        b.type === 'shrine_hut' ? '#ce93d860' : '#6d4c4170';
      drawBuilding(b.x, b.z, b.w, b.d, b.rot, col);
    }

    // Kingdom houses (offset from settlement centers)
    for (const [type, info] of Object.entries(KINGDOM_HOUSE_MAP)) {
      const settlement = SETTLEMENTS.find(s => s.id === info.settlementId);
      if (!settlement) continue;
      const [scx, scz] = settlement.position;
      for (const h of info.houses) {
        drawBuilding(scx + h.x, scz + h.z, h.w, h.d, h.rot, '#a1887f80');
      }
    }
  }

  // ===== SETTLEMENTS =====
  if (layers.settlements) {
    for (const s of SETTLEMENTS) {
      const [sx, sy] = toS(s.position[0], s.position[1]);
      const color = SETTLEMENT_COLORS[s.type] || '#fff';
      const r = s.size === 'large' ? 8 : s.size === 'medium' ? 5 : 3;
      const sr = Math.max(r, r * view.zoom * 0.8);

      // Influence ring
      ctx.beginPath();
      const flatR = s.size === 'large' ? 70 : s.size === 'medium' ? 35 : 25;
      ctx.arc(sx, sy, flatR * view.zoom, 0, Math.PI * 2);
      ctx.strokeStyle = color + '30';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Marker
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      if (view.zoom > 0.12) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(10, Math.min(14, view.zoom * 15))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(s.name, sx, sy - sr - 5);
        if (view.zoom > 0.3) {
          ctx.fillStyle = '#aaa';
          ctx.font = `${Math.max(8, view.zoom * 9)}px monospace`;
          ctx.fillText(s.type.replace('_', ' '), sx, sy - sr - 17);
        }
      }
    }
  }

  // ===== LANDMARKS =====
  if (layers.landmarks) {
    for (const lm of LANDMARKS) {
      const [sx, sy] = toS(lm.position[0], lm.position[1]);
      ctx.beginPath();
      // Diamond shape
      const sz = Math.max(5, view.zoom * 6);
      ctx.moveTo(sx, sy - sz);
      ctx.lineTo(sx + sz, sy);
      ctx.lineTo(sx, sy + sz);
      ctx.lineTo(sx - sz, sy);
      ctx.closePath();
      ctx.fillStyle = '#ffd70090';
      ctx.fill();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (view.zoom > 0.25) {
        ctx.fillStyle = '#ffd700';
        ctx.font = `${Math.max(8, view.zoom * 10)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(lm.name, sx, sy - sz - 4);
      }
    }
  }

  // ===== POIS =====
  if (layers.pois && view.zoom > 0.2) {
    for (const poi of SMALL_POIS) {
      const [sx, sy] = toS(poi.position[0], poi.position[1]);
      const icon = POI_ICONS[poi.type] || '•';
      ctx.font = `${Math.max(10, view.zoom * 12)}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText(icon, sx, sy + 4);

      if (view.zoom > 0.5) {
        ctx.fillStyle = '#999';
        ctx.font = `${Math.max(7, view.zoom * 8)}px monospace`;
        ctx.fillText(poi.name, sx, sy + 14);
      }
    }
  }

  // ===== ORIGIN CROSSHAIR =====
  {
    const [ox, oy] = toS(0, 0);
    ctx.strokeStyle = '#fff3';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(ox - 10, oy); ctx.lineTo(ox + 10, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, oy - 10); ctx.lineTo(ox, oy + 10); ctx.stroke();
  }
}

// ===== Hit testing =====
function getHoverInfo(wx: number, wz: number, layers: LayerState): HoverInfo {
  const info: HoverInfo = { worldX: Math.round(wx), worldZ: Math.round(wz) };

  // Settlements
  if (layers.settlements) {
    for (const s of SETTLEMENTS) {
      const dx = wx - s.position[0], dz = wz - s.position[1];
      if (dx * dx + dz * dz < 15 * 15) {
        info.label = s.name;
        info.type = s.type.replace('_', ' ');
        return info;
      }
    }
  }

  // Stations
  if (layers.stations) {
    for (const stn of RAILWAY_STATIONS) {
      const dx = wx - stn.position[0], dz = wz - stn.position[1];
      if (dx * dx + dz * dz < 12 * 12) {
        info.label = `Station: ${stn.name}`;
        info.type = `Line ${stn.line} (${stn.stationType})`;
        return info;
      }
    }
  }

  // POIs
  if (layers.pois) {
    for (const poi of SMALL_POIS) {
      const dx = wx - poi.position[0], dz = wz - poi.position[1];
      if (dx * dx + dz * dz < 8 * 8) {
        info.label = poi.name;
        info.type = poi.type.replace('_', ' ');
        return info;
      }
    }
  }

  // Landmarks
  if (layers.landmarks) {
    for (const lm of LANDMARKS) {
      const dx = wx - lm.position[0], dz = wz - lm.position[1];
      if (dx * dx + dz * dz < 10 * 10) {
        info.label = lm.name;
        info.type = lm.type.replace('_', ' ');
        return info;
      }
    }
  }

  // Regions
  if (layers.regions) {
    for (const r of REGIONS) {
      const dx = wx - r.center[0], dz = wz - r.center[1];
      if (Math.sqrt(dx * dx + dz * dz) < r.radius) {
        info.label = r.name;
        info.type = `danger ${r.danger}`;
        return info;
      }
    }
  }

  return info;
}

// ===== Component =====
export default function AdminWorldMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<ViewState>({ offsetX: 0, offsetY: 0, zoom: 0.35 });
  const [layers, setLayers] = useState<LayerState>({
    regions: true, settlements: true, roads: true, railways: true,
    stations: true, water: true, bridges: true, pois: true,
    buildings: true, landmarks: true,
  });
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number }>({ x: 0, y: 0, ox: 0, oy: 0 });

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMap(ctx, view, layers, dpr);
  }, [view, layers]);

  // Resize
  useEffect(() => {
    const handleResize = () => setView(v => ({ ...v })); // trigger re-render
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setView(v => {
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.max(0.04, Math.min(5, v.zoom * factor));
      // Zoom toward cursor
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const dpr = window.devicePixelRatio || 1;
      const [wx, wz] = screenToWorld(mx * dpr, my * dpr, v, canvas);
      const newOffsetX = wx - (mx * dpr - canvas.width / 2) / (newZoom * dpr);
      const newOffsetY = wz - (my * dpr - canvas.height / 2) / (newZoom * dpr);
      return { offsetX: v.offsetX, offsetY: v.offsetY, zoom: newZoom };
    });
  }, []);

  // Pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, ox: view.offsetX, oy: view.offsetY };
    }
  }, [view.offsetX, view.offsetY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isPanning) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setView(v => ({
        ...v,
        offsetX: panStart.current.ox - dx / v.zoom,
        offsetY: panStart.current.oy - dy / v.zoom,
      }));
    }

    // Hover
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mx = (e.clientX - rect.left) * dpr;
    const my = (e.clientY - rect.top) * dpr;
    const [wx, wz] = screenToWorld(mx, my, view, canvas);
    setHover(getHoverInfo(wx, wz, layers));
  }, [isPanning, view, layers]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const resetView = useCallback(() => setView({ offsetX: 0, offsetY: 0, zoom: 0.35 }), []);

  const toggleLayer = useCallback((key: keyof LayerState) => {
    setLayers(l => ({ ...l, [key]: !l[key] }));
  }, []);

  const toggleAll = useCallback((on: boolean) => {
    setLayers({
      regions: on, settlements: on, roads: on, railways: on,
      stations: on, water: on, bridges: on, pois: on,
      buildings: on, landmarks: on,
    });
  }, []);

  const layerDefs: { key: keyof LayerState; label: string; color: string }[] = [
    { key: 'regions', label: 'Regions', color: '#6a8a4a' },
    { key: 'settlements', label: 'Settlements', color: '#ffd700' },
    { key: 'roads', label: 'Roads', color: '#8d6e46' },
    { key: 'railways', label: 'Railways', color: '#e91e63' },
    { key: 'stations', label: 'Stations', color: '#ff9800' },
    { key: 'water', label: 'Water', color: '#2196f3' },
    { key: 'bridges', label: 'Bridges', color: '#78909c' },
    { key: 'pois', label: 'POIs', color: '#9c27b0' },
    { key: 'buildings', label: 'Buildings', color: '#8d6e46' },
    { key: 'landmarks', label: 'Landmarks', color: '#ffd700' },
  ];

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0d0d1a', fontFamily: 'monospace', color: '#ccc' }}>
      {/* Sidebar */}
      <div style={{
        width: 240, minWidth: 240, background: '#13132a', borderRight: '1px solid #2a2a4a',
        display: 'flex', flexDirection: 'column', padding: 12, gap: 8, overflowY: 'auto',
      }}>
        <h2 style={{ color: '#fff', fontSize: 15, margin: 0, borderBottom: '1px solid #333', paddingBottom: 8 }}>
          🗺 Trencheria Admin
        </h2>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
          World: {WORLD_SIZE}×{WORLD_SIZE} | Zoom: {(view.zoom * 100).toFixed(0)}%
        </div>

        <button onClick={resetView} style={btnStyle}>⟳ Reset View</button>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => toggleAll(true)} style={{ ...btnStyle, flex: 1 }}>All On</button>
          <button onClick={() => toggleAll(false)} style={{ ...btnStyle, flex: 1 }}>All Off</button>
        </div>

        <div style={{ fontSize: 11, color: '#666', marginTop: 8, borderBottom: '1px solid #222', paddingBottom: 4 }}>
          LAYERS
        </div>
        {layerDefs.map(ld => (
          <label key={ld.key} style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer',
            opacity: layers[ld.key] ? 1 : 0.4,
          }}>
            <input type="checkbox" checked={layers[ld.key]} onChange={() => toggleLayer(ld.key)}
              style={{ accentColor: ld.color }} />
            <span style={{ width: 8, height: 8, borderRadius: 2, background: ld.color, display: 'inline-block' }} />
            {ld.label}
          </label>
        ))}

        <div style={{ fontSize: 11, color: '#666', marginTop: 12, borderBottom: '1px solid #222', paddingBottom: 4 }}>
          DATA STATS
        </div>
        <div style={{ fontSize: 10, color: '#777', lineHeight: 1.6 }}>
          Regions: {REGIONS.length}<br />
          Settlements: {SETTLEMENTS.length}<br />
          Roads: {ROADS.length}<br />
          Rail waypoints: {LINE_A_WAYPOINTS.length + LINE_B_WAYPOINTS.length}<br />
          Stations: {RAILWAY_STATIONS.length}<br />
          Rivers: {RIVERS.length}<br />
          Lakes: {LAKES.length}<br />
          Bridges: {BRIDGES.length}<br />
          POIs: {SMALL_POIS.length}<br />
          Town buildings: {TOWN_BUILDINGS.length}<br />
          Wilderness: {WILDERNESS_BUILDINGS.length}<br />
          Kingdom houses: {Object.values(KINGDOM_HOUSE_MAP).reduce((s, v) => s + v.houses.length, 0)}<br />
          Landmarks: {LANDMARKS.length}
        </div>

        {/* Hover info */}
        <div style={{ fontSize: 11, color: '#666', marginTop: 12, borderBottom: '1px solid #222', paddingBottom: 4 }}>
          CURSOR
        </div>
        {hover && (
          <div style={{ fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ color: '#4fc3f7' }}>X: {hover.worldX} &nbsp; Z: {hover.worldZ}</div>
            {hover.label && <div style={{ color: '#fff' }}>{hover.label}</div>}
            {hover.type && <div style={{ color: '#aaa' }}>{hover.type}</div>}
          </div>
        )}

        <div style={{ marginTop: 'auto', fontSize: 9, color: '#444', borderTop: '1px solid #222', paddingTop: 8 }}>
          Phase 1 — Read-only view<br />
          Click + drag to pan<br />
          Scroll to zoom
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ flex: 1, cursor: isPanning ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#1e1e3a', border: '1px solid #333', color: '#aaa', padding: '6px 10px',
  borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'monospace',
};
