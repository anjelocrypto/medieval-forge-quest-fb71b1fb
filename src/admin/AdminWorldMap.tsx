/**
 * Admin 2D World Map — Phase 1 Complete
 * Full read-only top-down visualization of the entire Trencheria world.
 * Terrain heightmap, collision overlays, full coordinate inspection.
 */
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';

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
import { getTerrainHeight } from '../game/components/Terrain';

// ===== Types =====
interface LayerState {
  terrain: boolean;
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
  collision: boolean;
  gridLabels: boolean;
  railLabels: boolean;
}

interface ViewState {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

interface InspectInfo {
  name: string;
  type: string;
  layer: string;
  x: number;
  z: number;
  extra?: Record<string, string | number>;
}

interface HoverInfo {
  worldX: number;
  worldZ: number;
  terrainH: number;
  label?: string;
  type?: string;
}

// ===== Kingdom house map =====
const KINGDOM_HOUSE_MAP: { type: string; houses: typeof FORTIFIED_CITY_HOUSES; settlementId: string }[] = [
  { type: 'fortified_city', houses: FORTIFIED_CITY_HOUSES, settlementId: 'thornwall_city' },
  { type: 'river_town', houses: RIVER_TOWN_HOUSES, settlementId: 'rivermoor_city' },
  { type: 'mountain_hold', houses: MOUNTAIN_HOLD_HOUSES, settlementId: 'stonepeak_hold' },
  { type: 'frontier_camp', houses: FRONTIER_CAMP_HOUSES, settlementId: 'darkhollow_camp' },
  { type: 'trade_city', houses: TRADE_CITY_HOUSES, settlementId: 'goldenvale_city' },
];

// ===== Precompute terrain heightmap =====
const TERRAIN_GRID_SIZE = 6; // sample every 6 world units
const TERRAIN_COLS = Math.ceil(WORLD_SIZE / TERRAIN_GRID_SIZE) + 1;
const TERRAIN_ROWS = TERRAIN_COLS;

let _terrainCache: Float32Array | null = null;
let _terrainMin = 0;
let _terrainMax = 0;

function getTerrainCache(): { data: Float32Array; min: number; max: number } {
  if (_terrainCache) return { data: _terrainCache, min: _terrainMin, max: _terrainMax };
  const data = new Float32Array(TERRAIN_COLS * TERRAIN_ROWS);
  let min = Infinity, max = -Infinity;
  for (let row = 0; row < TERRAIN_ROWS; row++) {
    const z = -HALF_WORLD + row * TERRAIN_GRID_SIZE;
    for (let col = 0; col < TERRAIN_COLS; col++) {
      const x = -HALF_WORLD + col * TERRAIN_GRID_SIZE;
      const h = getTerrainHeight(x, z);
      data[row * TERRAIN_COLS + col] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  _terrainCache = data;
  _terrainMin = min;
  _terrainMax = max;
  console.log(`[AdminMap] Terrain grid: ${TERRAIN_COLS}x${TERRAIN_ROWS} = ${data.length} samples, range [${min.toFixed(1)}, ${max.toFixed(1)}]`);
  return { data, min, max };
}

// ===== Build collision data for overlay =====
interface CollisionCircle { x: number; z: number; radius: number; id: string }
interface CollisionBox { cx: number; cz: number; halfW: number; halfD: number; rotation: number; id: string }

function buildCollisionData(): { circles: CollisionCircle[]; boxes: CollisionBox[] } {
  // We manually reconstruct from the same source data used by CollisionSystem
  // This avoids importing the mutable collision system state
  const circles: CollisionCircle[] = [];
  const boxes: CollisionBox[] = [];

  // Town district buildings
  for (const b of TOWN_BUILDINGS) {
    boxes.push({ cx: b.x, cz: b.z, halfW: b.w / 2, halfD: b.d / 2, rotation: b.rot, id: `town-${b.x.toFixed(0)}-${b.z.toFixed(0)}` });
  }

  // Wilderness buildings
  for (const b of WILDERNESS_BUILDINGS) {
    if (b.type === 'camp' || b.type === 'shrine_hut') {
      circles.push({ x: b.x, z: b.z, radius: b.type === 'camp' ? 0.8 : 0.6, id: `wild-${b.type}` });
    } else {
      boxes.push({ cx: b.x, cz: b.z, halfW: b.w / 2, halfD: b.d / 2, rotation: b.rot, id: `wild-${b.type}` });
    }
  }

  // Kingdom houses
  for (const km of KINGDOM_HOUSE_MAP) {
    const s = SETTLEMENTS.find(s => s.id === km.settlementId);
    if (!s) continue;
    for (let i = 0; i < km.houses.length; i++) {
      const h = km.houses[i];
      boxes.push({ cx: s.position[0] + h.x, cz: s.position[1] + h.z, halfW: h.w / 2, halfD: h.d / 2, rotation: h.rot, id: `${km.type}-house-${i}` });
    }
  }

  // POI obstacles
  for (const poi of SMALL_POIS) {
    const [px, pz] = poi.position;
    if (poi.type === 'inn') boxes.push({ cx: px, cz: pz, halfW: 3.5, halfD: 3, rotation: 0, id: `poi-${poi.id}` });
    else if (poi.type === 'watchtower') circles.push({ x: px, z: pz, radius: 1.5, id: `poi-${poi.id}` });
    else if (poi.type === 'supply_depot') boxes.push({ cx: px, cz: pz, halfW: 2, halfD: 1.5, rotation: 0, id: `poi-${poi.id}` });
    else if (poi.type === 'hunter_camp') circles.push({ x: px, z: pz, radius: 1.2, id: `poi-${poi.id}` });
    else if (poi.type === 'ruined_house') boxes.push({ cx: px, cz: pz, halfW: 2.5, halfD: 2, rotation: 0, id: `poi-${poi.id}` });
    else if (poi.type === 'cave') circles.push({ x: px, z: pz, radius: 2, id: `poi-${poi.id}` });
    else if (poi.type === 'stone_circle') circles.push({ x: px, z: pz, radius: 1.2, id: `poi-${poi.id}` });
    else if (poi.type === 'wagon') boxes.push({ cx: px, cz: pz, halfW: 0.75, halfD: 1.5, rotation: 0, id: `poi-${poi.id}` });
  }

  return { circles, boxes };
}

// ===== POI icons =====
const POI_ICONS: Record<string, string> = {
  shrine: '⛩', wagon: '🛒', bridge: '🌉', graveyard: '⚰', hunter_camp: '🏕',
  ruined_house: '🏚', watchtower: '🗼', cave: '🕳', watchpost: '👁', inn: '🏨',
  clearing: '🌿', stone_circle: '⭕', pond: '💧', burned_village: '🔥',
  supply_depot: '📦', crossroads: '✚', milestone: '🪨', lantern_post: '🏮',
  roadside_cross: '✝', abandoned_camp: '⛺', gallows: '⚖',
};

const SETTLEMENT_COLORS: Record<string, string> = {
  capital: '#ffd700', village: '#8bc34a', fort: '#ff5722', ruins: '#9e9e9e',
  bandit_camp: '#f44336', outpost: '#ff9800', monastery: '#ce93d8',
  fortified_city: '#b0bec5', river_town: '#4fc3f7', mountain_hold: '#78909c',
  frontier_camp: '#a1887f', trade_city: '#ffb74d',
};

// ===== Screen transforms =====
function worldToScreen(wx: number, wz: number, view: ViewState, cw: number, ch: number): [number, number] {
  return [cw / 2 + (wx - view.offsetX) * view.zoom, ch / 2 + (wz - view.offsetY) * view.zoom];
}

function screenToWorld(sx: number, sy: number, view: ViewState, cw: number, ch: number): [number, number] {
  return [(sx - cw / 2) / view.zoom + view.offsetX, (sy - ch / 2) / view.zoom + view.offsetY];
}

// ===== Terrain color =====
function terrainColor(h: number, min: number, max: number): string {
  const range = max - min || 1;
  const t = (h - min) / range; // 0..1
  // Deep water → lowland green → highland → mountain gray → snow white
  if (h < -0.5) return `hsl(210, 40%, ${15 + t * 10}%)`;
  if (t < 0.25) return `hsl(${120 + t * 40}, ${30 + t * 20}%, ${18 + t * 15}%)`;
  if (t < 0.45) return `hsl(${100 - (t - 0.25) * 200}, ${25 + t * 10}%, ${22 + t * 12}%)`;
  if (t < 0.65) return `hsl(${40 - (t - 0.45) * 80}, ${20}%, ${28 + t * 12}%)`;
  if (t < 0.85) return `hsl(${25}, ${10}%, ${35 + (t - 0.65) * 40}%)`;
  return `hsl(${220}, ${5}%, ${55 + (t - 0.85) * 100}%)`;
}

// ===== Terrain ImageData (cached) =====
let _terrainImageData: ImageData | null = null;

function getTerrainImageData(): ImageData {
  if (_terrainImageData) return _terrainImageData;
  const { data, min, max } = getTerrainCache();
  const img = new ImageData(TERRAIN_COLS, TERRAIN_ROWS);
  const range = max - min || 1;
  for (let i = 0; i < data.length; i++) {
    const t = (data[i] - min) / range;
    const h = data[i];
    let r: number, g: number, b: number;
    if (h < -0.5) {
      r = 20; g = 35; b = 60;
    } else if (t < 0.25) {
      r = 30 + t * 60; g = 55 + t * 80; b = 30 + t * 30;
    } else if (t < 0.45) {
      const u = (t - 0.25) / 0.2;
      r = 45 + u * 40; g = 75 - u * 10; b = 37 - u * 5;
    } else if (t < 0.65) {
      const u = (t - 0.45) / 0.2;
      r = 85 + u * 25; g = 65 + u * 10; b = 32 + u * 20;
    } else if (t < 0.85) {
      const u = (t - 0.65) / 0.2;
      r = 110 + u * 30; g = 100 + u * 25; b = 90 + u * 20;
    } else {
      const u = (t - 0.85) / 0.15;
      r = 140 + u * 70; g = 135 + u * 70; b = 130 + u * 70;
    }
    const idx = i * 4;
    img.data[idx] = Math.min(255, r);
    img.data[idx + 1] = Math.min(255, g);
    img.data[idx + 2] = Math.min(255, b);
    img.data[idx + 3] = 200;
  }
  _terrainImageData = img;
  return img;
}

// ===== Main draw =====
function drawMap(
  ctx: CanvasRenderingContext2D,
  view: ViewState,
  layers: LayerState,
  collisionData: { circles: CollisionCircle[]; boxes: CollisionBox[] },
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const toS = (wx: number, wz: number) => worldToScreen(wx, wz, view, W, H);

  // Clear
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, W, H);

  // ===== TERRAIN HEIGHTMAP =====
  if (layers.terrain) {
    const imgData = getTerrainImageData();
    // Create offscreen canvas at terrain grid resolution
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = TERRAIN_COLS;
    tmpCanvas.height = TERRAIN_ROWS;
    const tmpCtx = tmpCanvas.getContext('2d')!;
    tmpCtx.putImageData(imgData, 0, 0);

    // Map terrain grid to screen
    const [x1, y1] = toS(-HALF_WORLD, -HALF_WORLD);
    const [x2, y2] = toS(HALF_WORLD, HALF_WORLD);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tmpCanvas, x1, y1, x2 - x1, y2 - y1);
  }

  // ===== GRID =====
  {
    const [bx1, by1] = toS(-HALF_WORLD, -HALF_WORLD);
    const [bx2, by2] = toS(HALF_WORLD, HALF_WORLD);
    ctx.strokeStyle = layers.terrain ? '#ffffff12' : '#222238';
    ctx.lineWidth = 0.5;

    // Adaptive grid spacing
    const rawStep = 100;
    let step = rawStep;
    if (view.zoom < 0.1) step = 500;
    else if (view.zoom < 0.2) step = 200;
    else if (view.zoom > 1) step = 50;
    else if (view.zoom > 2) step = 25;

    for (let g = -HALF_WORLD; g <= HALF_WORLD; g += step) {
      const [gx, gy] = toS(g, -HALF_WORLD);
      const [, gy2] = toS(g, HALF_WORLD);
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy2); ctx.stroke();
      const [hx, hy] = toS(-HALF_WORLD, g);
      const [hx2] = toS(HALF_WORLD, g);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx2, hy); ctx.stroke();
    }

    // Grid labels
    if (layers.gridLabels && view.zoom > 0.08) {
      ctx.fillStyle = '#555';
      ctx.font = `${Math.max(8, Math.min(10, view.zoom * 12))}px monospace`;
      ctx.textAlign = 'center';
      for (let g = -HALF_WORLD; g <= HALF_WORLD; g += step) {
        const [gx, gy] = toS(g, -HALF_WORLD);
        ctx.fillText(`${g}`, gx, gy - 2);
        const [hx, hy] = toS(-HALF_WORLD, g);
        ctx.save();
        ctx.textAlign = 'right';
        ctx.fillText(`${g}`, hx - 3, hy + 3);
        ctx.restore();
      }
    }

    // World boundary
    ctx.strokeStyle = '#445';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx1, by1, bx2 - bx1, by2 - by1);
  }

  // ===== REGIONS =====
  if (layers.regions) {
    for (const r of REGIONS) {
      const [cx, cy] = toS(r.center[0], r.center[1]);
      const sr = r.radius * view.zoom;
      ctx.beginPath();
      ctx.arc(cx, cy, sr, 0, Math.PI * 2);
      ctx.fillStyle = r.color + (layers.terrain ? '18' : '25');
      ctx.fill();
      ctx.strokeStyle = r.color + '60';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (view.zoom > 0.12) {
        ctx.fillStyle = r.color + 'cc';
        ctx.font = `bold ${Math.max(9, Math.min(14, view.zoom * 16))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(r.name, cx, cy - sr - 6);
        if (r.danger > 0) {
          ctx.fillStyle = r.danger >= 3 ? '#f44' : r.danger >= 2 ? '#fa0' : '#aa0';
          ctx.font = `${Math.max(8, view.zoom * 10)}px monospace`;
          ctx.fillText(`⚠ Danger ${r.danger} — ${r.enemyTypes.join(', ')}`, cx, cy - sr - 18);
        }
        if (view.zoom > 0.25) {
          ctx.fillStyle = '#888';
          ctx.font = `${Math.max(8, view.zoom * 9)}px monospace`;
          ctx.fillText(`[${r.center[0]}, ${r.center[1]}] r=${r.radius}`, cx, cy + sr + 12);
        }
      }
    }
  }

  // ===== WATER =====
  if (layers.water) {
    for (const river of RIVERS) {
      if (river.points.length < 2) continue;
      ctx.beginPath();
      const [sx, sy] = toS(river.points[0][0], river.points[0][2]);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < river.points.length; i++) {
        const [px, py] = toS(river.points[i][0], river.points[i][2]);
        ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#2196f3a0';
      ctx.lineWidth = Math.max(2, river.width * view.zoom * 0.7);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke();

      // River label
      if (view.zoom > 0.2) {
        const mid = river.points[Math.floor(river.points.length / 2)];
        const [mx, my] = toS(mid[0], mid[2]);
        ctx.fillStyle = '#64b5f6';
        ctx.font = `italic ${Math.max(8, view.zoom * 10)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(river.id.replace('river-', ''), mx, my - river.width * view.zoom * 0.4 - 3);
      }
    }
    for (const lake of LAKES) {
      const [cx, cy] = toS(lake.position[0], lake.position[2]);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(lake.rotation);
      ctx.beginPath();
      ctx.ellipse(0, 0, lake.radiusX * view.zoom, lake.radiusZ * view.zoom, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1565c060';
      ctx.fill();
      ctx.strokeStyle = '#2196f380';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      if (view.zoom > 0.2) {
        ctx.fillStyle = '#64b5f6';
        ctx.font = `italic ${Math.max(8, view.zoom * 10)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(lake.id.replace('lake-', ''), cx, cy + 4);
      }
    }
  }

  // ===== ROADS =====
  if (layers.roads) {
    for (const road of ROADS) {
      const [x1, y1] = toS(road.from[0], road.from[1]);
      const [x2, y2] = toS(road.to[0], road.to[1]);
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#8d6e4688';
      ctx.lineWidth = Math.max(1, road.width * view.zoom * 0.4);
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
      ctx.fillStyle = bridge.style === 'grand' ? '#9e9e9ea0' : bridge.style === 'stone' ? '#78909c90' : '#8d6e4690';
      ctx.fillRect(-bWid / 2, -bLen / 2, bWid, bLen);
      ctx.strokeStyle = '#fff4';
      ctx.lineWidth = 1;
      ctx.strokeRect(-bWid / 2, -bLen / 2, bWid, bLen);
      ctx.restore();
      if (view.zoom > 0.25) {
        ctx.fillStyle = '#ccc';
        ctx.font = `${Math.max(8, view.zoom * 9)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`🌉 ${bridge.id.replace('bridge-', '')}`, cx, cy - bLen / 2 - 4);
        if (view.zoom > 0.5) {
          ctx.fillStyle = '#888';
          ctx.fillText(`[${bridge.position[0]}, ${bridge.position[2]}]`, cx, cy - bLen / 2 - 15);
        }
      }
    }
  }

  // ===== BUILDINGS =====
  if (layers.buildings) {
    const drawBldg = (x: number, z: number, w: number, d: number, rot: number, color: string) => {
      const [cx, cy] = toS(x, z);
      const bw = Math.max(1.5, w * view.zoom);
      const bd = Math.max(1.5, d * view.zoom);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = color;
      ctx.fillRect(-bw / 2, -bd / 2, bw, bd);
      if (view.zoom > 1) {
        ctx.strokeStyle = '#fff2';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-bw / 2, -bd / 2, bw, bd);
      }
      ctx.restore();
    };

    // Town district
    for (const b of TOWN_BUILDINGS) {
      drawBldg(b.x, b.z, b.w, b.d, b.rot, '#a0845890');
    }
    // Wilderness
    for (const b of WILDERNESS_BUILDINGS) {
      const col = b.type === 'ruin' ? '#9e9e9e70' : b.type === 'camp' ? '#ff980060' :
        b.type === 'shrine_hut' ? '#ce93d860' : b.type === 'outpost' ? '#ff572260' : '#6d4c4170';
      drawBldg(b.x, b.z, b.w, b.d, b.rot, col);
    }
    // Kingdom houses
    for (const km of KINGDOM_HOUSE_MAP) {
      const s = SETTLEMENTS.find(s => s.id === km.settlementId);
      if (!s) continue;
      for (const h of km.houses) {
        drawBldg(s.position[0] + h.x, s.position[1] + h.z, h.w, h.d, h.rot, '#a1887fa0');
      }
    }
  }

  // ===== COLLISION OVERLAY =====
  if (layers.collision) {
    ctx.globalAlpha = 0.3;
    for (const c of collisionData.circles) {
      const [cx, cy] = toS(c.x, c.z);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, c.radius * view.zoom), 0, Math.PI * 2);
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (const b of collisionData.boxes) {
      const [cx, cy] = toS(b.cx, b.cz);
      const bw = Math.max(1, b.halfW * 2 * view.zoom);
      const bd = Math.max(1, b.halfD * 2 * view.zoom);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(b.rotation);
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 1;
      ctx.strokeRect(-bw / 2, -bd / 2, bw, bd);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ===== RAILWAYS =====
  if (layers.railways) {
    const drawRailLine = (wps: typeof LINE_A_WAYPOINTS, color: string, label: string) => {
      if (wps.length < 2) return;
      // Track line
      ctx.beginPath();
      const [sx, sy] = toS(wps[0].x, wps[0].z);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < wps.length; i++) {
        const [px, py] = toS(wps[i].x, wps[i].z);
        ctx.lineTo(px, py);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, view.zoom * 3.5);
      ctx.setLineDash([view.zoom * 8, view.zoom * 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Waypoint dots + labels
      for (let i = 0; i < wps.length; i++) {
        const wp = wps[i];
        const [wx, wy] = toS(wp.x, wp.z);
        // Dot
        ctx.beginPath();
        ctx.arc(wx, wy, view.zoom > 0.3 ? 3 : 2, 0, Math.PI * 2);
        ctx.fillStyle = wp.type === 'station' ? '#fff' : wp.type === 'bridge' ? '#4fc3f7' : color;
        ctx.fill();

        // Labels
        if (layers.railLabels && view.zoom > 0.3) {
          ctx.fillStyle = '#ccc';
          ctx.font = `${Math.max(7, view.zoom * 8)}px monospace`;
          ctx.textAlign = 'left';
          const lbl = wp.label ? `${label}[${i}] ${wp.label}` : `${label}[${i}]`;
          ctx.fillText(lbl, wx + 5, wy - 3);
          ctx.fillStyle = '#999';
          ctx.fillText(`(${wp.x}, ${wp.z})`, wx + 5, wy + 8);
        }
      }
    };
    drawRailLine(LINE_A_WAYPOINTS, '#e91e63cc', 'A');
    drawRailLine(LINE_B_WAYPOINTS, '#ff9800cc', 'B');
  }

  // ===== STATIONS =====
  if (layers.stations) {
    for (const stn of RAILWAY_STATIONS) {
      const [sx, sy] = toS(stn.position[0], stn.position[1]);
      const r = Math.max(5, view.zoom * 6);
      // Platform ring
      ctx.beginPath();
      ctx.arc(sx, sy, r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff4';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Marker
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = stn.stationType === 'capital' ? '#ffd700' :
        stn.stationType === 'large' ? '#ff9800' :
        stn.stationType === 'medium' ? '#4caf50' : '#90a4ae';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (view.zoom > 0.15) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(10, Math.min(14, view.zoom * 13))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`🚂 ${stn.name}`, sx, sy - r - 5);
        if (view.zoom > 0.3) {
          ctx.fillStyle = '#aaa';
          ctx.font = `${Math.max(8, view.zoom * 9)}px monospace`;
          ctx.fillText(`Line ${stn.line} • ${stn.stationType}`, sx, sy - r - 17);
          ctx.fillStyle = '#777';
          ctx.fillText(`[${stn.position[0]}, ${stn.position[1]}]`, sx, sy - r - 28);
        }
      }
    }
  }

  // ===== SETTLEMENTS =====
  if (layers.settlements) {
    for (const s of SETTLEMENTS) {
      const [sx, sy] = toS(s.position[0], s.position[1]);
      const color = SETTLEMENT_COLORS[s.type] || '#fff';
      const r = s.size === 'large' ? 9 : s.size === 'medium' ? 6 : 4;
      const sr = Math.max(r, r * view.zoom * 0.9);
      // Flatten zone
      const flatR = s.size === 'large' ? 70 : s.size === 'medium' ? 35 : 25;
      ctx.beginPath();
      ctx.arc(sx, sy, flatR * view.zoom, 0, Math.PI * 2);
      ctx.strokeStyle = color + '20';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Marker
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Labels
      if (view.zoom > 0.1) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(11, Math.min(15, view.zoom * 16))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(s.name, sx, sy - sr - 6);
        if (view.zoom > 0.2) {
          ctx.fillStyle = '#aaa';
          ctx.font = `${Math.max(9, view.zoom * 10)}px monospace`;
          ctx.fillText(s.type.replace(/_/g, ' '), sx, sy - sr - 19);
        }
        if (view.zoom > 0.35) {
          ctx.fillStyle = '#777';
          ctx.font = `${Math.max(8, view.zoom * 9)}px monospace`;
          ctx.fillText(`[${s.position[0]}, ${s.position[1]}]`, sx, sy - sr - 31);
        }
      }
    }
  }

  // ===== LANDMARKS =====
  if (layers.landmarks) {
    for (const lm of LANDMARKS) {
      const [sx, sy] = toS(lm.position[0], lm.position[1]);
      const sz = Math.max(6, view.zoom * 7);
      ctx.beginPath();
      ctx.moveTo(sx, sy - sz); ctx.lineTo(sx + sz, sy);
      ctx.lineTo(sx, sy + sz); ctx.lineTo(sx - sz, sy);
      ctx.closePath();
      ctx.fillStyle = '#ffd700a0';
      ctx.fill();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (view.zoom > 0.2) {
        ctx.fillStyle = '#ffd700';
        ctx.font = `bold ${Math.max(9, view.zoom * 11)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(lm.name, sx, sy - sz - 5);
        if (view.zoom > 0.4) {
          ctx.fillStyle = '#aa8';
          ctx.font = `${Math.max(8, view.zoom * 9)}px monospace`;
          ctx.fillText(`[${lm.position[0]}, ${lm.position[1]}] h=${lm.height}`, sx, sy - sz - 17);
        }
      }
    }
  }

  // ===== POIS =====
  if (layers.pois) {
    const minZoom = 0.15;
    if (view.zoom > minZoom) {
      for (const poi of SMALL_POIS) {
        const [sx, sy] = toS(poi.position[0], poi.position[1]);
        // Check if on screen
        if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) continue;
        const icon = POI_ICONS[poi.type] || '•';
        ctx.font = `${Math.max(10, Math.min(16, view.zoom * 14))}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText(icon, sx, sy + 4);
        if (view.zoom > 0.4) {
          ctx.fillStyle = '#bbb';
          ctx.font = `${Math.max(8, view.zoom * 9)}px monospace`;
          ctx.fillText(poi.name, sx, sy + 16);
        }
        if (view.zoom > 0.7) {
          ctx.fillStyle = '#777';
          ctx.font = `${Math.max(7, view.zoom * 8)}px monospace`;
          ctx.fillText(`[${poi.position[0]}, ${poi.position[1]}]`, sx, sy + 26);
        }
      }
    }
  }

  // ===== ORIGIN =====
  {
    const [ox, oy] = toS(0, 0);
    ctx.strokeStyle = '#fff3';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(ox - 12, oy); ctx.lineTo(ox + 12, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, oy - 12); ctx.lineTo(ox, oy + 12); ctx.stroke();
    if (view.zoom > 0.2) {
      ctx.fillStyle = '#555';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('0,0', ox + 3, oy - 3);
    }
  }
}

// ===== Hit testing =====
function getHoverInfo(wx: number, wz: number, layers: LayerState): HoverInfo {
  const h = getTerrainHeight(wx, wz);
  const info: HoverInfo = { worldX: Math.round(wx * 10) / 10, worldZ: Math.round(wz * 10) / 10, terrainH: Math.round(h * 100) / 100 };

  if (layers.settlements) {
    for (const s of SETTLEMENTS) {
      const dx = wx - s.position[0], dz = wz - s.position[1];
      if (dx * dx + dz * dz < 18 * 18) { info.label = s.name; info.type = s.type.replace(/_/g, ' '); return info; }
    }
  }
  if (layers.stations) {
    for (const stn of RAILWAY_STATIONS) {
      const dx = wx - stn.position[0], dz = wz - stn.position[1];
      if (dx * dx + dz * dz < 14 * 14) { info.label = `Station: ${stn.name}`; info.type = `Line ${stn.line} (${stn.stationType})`; return info; }
    }
  }
  if (layers.landmarks) {
    for (const lm of LANDMARKS) {
      const dx = wx - lm.position[0], dz = wz - lm.position[1];
      if (dx * dx + dz * dz < 12 * 12) { info.label = lm.name; info.type = lm.type.replace(/_/g, ' '); return info; }
    }
  }
  if (layers.pois) {
    for (const poi of SMALL_POIS) {
      const dx = wx - poi.position[0], dz = wz - poi.position[1];
      if (dx * dx + dz * dz < 10 * 10) { info.label = poi.name; info.type = poi.type.replace(/_/g, ' '); return info; }
    }
  }
  if (layers.regions) {
    for (const r of REGIONS) {
      const dx = wx - r.center[0], dz = wz - r.center[1];
      if (Math.sqrt(dx * dx + dz * dz) < r.radius) { info.label = r.name; info.type = `Region — danger ${r.danger}`; return info; }
    }
  }
  return info;
}

function getInspectInfo(wx: number, wz: number, layers: LayerState): InspectInfo | null {
  // Settlements
  if (layers.settlements) {
    for (const s of SETTLEMENTS) {
      const dx = wx - s.position[0], dz = wz - s.position[1];
      if (dx * dx + dz * dz < 18 * 18) {
        const r = REGIONS.find(r => r.id === s.regionId);
        return {
          name: s.name, type: s.type.replace(/_/g, ' '), layer: 'Settlement',
          x: s.position[0], z: s.position[1],
          extra: { size: s.size, region: r?.name || s.regionId, danger: r?.danger ?? 0, description: s.description },
        };
      }
    }
  }
  // Stations
  if (layers.stations) {
    for (const stn of RAILWAY_STATIONS) {
      const dx = wx - stn.position[0], dz = wz - stn.position[1];
      if (dx * dx + dz * dz < 14 * 14) {
        return {
          name: stn.name, type: 'Railway Station', layer: 'Station',
          x: stn.position[0], z: stn.position[1],
          extra: { line: stn.line, stationType: stn.stationType, side: stn.side, id: stn.id },
        };
      }
    }
  }
  // Landmarks
  if (layers.landmarks) {
    for (const lm of LANDMARKS) {
      const dx = wx - lm.position[0], dz = wz - lm.position[1];
      if (dx * dx + dz * dz < 12 * 12) {
        return {
          name: lm.name, type: lm.type.replace(/_/g, ' '), layer: 'Landmark',
          x: lm.position[0], z: lm.position[1],
          extra: { height: lm.height, id: lm.id },
        };
      }
    }
  }
  // POIs
  if (layers.pois) {
    for (const poi of SMALL_POIS) {
      const dx = wx - poi.position[0], dz = wz - poi.position[1];
      if (dx * dx + dz * dz < 10 * 10) {
        return {
          name: poi.name, type: poi.type.replace(/_/g, ' '), layer: 'POI',
          x: poi.position[0], z: poi.position[1],
          extra: { id: poi.id },
        };
      }
    }
  }
  // Bridges
  if (layers.bridges) {
    for (const b of BRIDGES) {
      const dx = wx - b.position[0], dz = wz - b.position[2];
      if (dx * dx + dz * dz < (b.length / 2 + 5) ** 2) {
        return {
          name: b.id.replace('bridge-', ''), type: `${b.style} bridge`, layer: 'Bridge',
          x: b.position[0], z: b.position[2],
          extra: { length: b.length, width: b.width, style: b.style, rotationRad: Math.round(b.rotation * 100) / 100 },
        };
      }
    }
  }
  return null;
}

// ===== Component =====
export default function AdminWorldMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<ViewState>({ offsetX: 0, offsetY: 0, zoom: 0.35 });
  const [layers, setLayers] = useState<LayerState>({
    terrain: true, regions: true, settlements: true, roads: true, railways: true,
    stations: true, water: true, bridges: true, pois: true, buildings: true,
    landmarks: true, collision: false, gridLabels: true, railLabels: false,
  });
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [inspect, setInspect] = useState<InspectInfo | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const collisionData = useMemo(() => buildCollisionData(), []);

  // Stats
  const stats = useMemo(() => ({
    regions: REGIONS.length,
    settlements: SETTLEMENTS.length,
    roads: ROADS.length,
    railWaypoints: LINE_A_WAYPOINTS.length + LINE_B_WAYPOINTS.length,
    stations: RAILWAY_STATIONS.length,
    rivers: RIVERS.length,
    lakes: LAKES.length,
    bridges: BRIDGES.length,
    pois: SMALL_POIS.length,
    townBuildings: TOWN_BUILDINGS.length,
    wilderness: WILDERNESS_BUILDINGS.length,
    kingdomHouses: KINGDOM_HOUSE_MAP.reduce((s, v) => s + v.houses.length, 0),
    landmarks: LANDMARKS.length,
    collisionCircles: collisionData.circles.length,
    collisionBoxes: collisionData.boxes.length,
  }), [collisionData]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMap(ctx, view, layers, collisionData);
  }, [view, layers, collisionData]);

  useEffect(() => {
    const handleResize = () => setView(v => ({ ...v }));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mx = (e.clientX - rect.left) * dpr;
    const my = (e.clientY - rect.top) * dpr;

    setView(v => {
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(0.03, Math.min(8, v.zoom * factor));
      // Zoom toward cursor
      const [wx, wz] = screenToWorld(mx, my, v, canvas.width, canvas.height);
      const newOffsetX = wx - (mx - canvas.width / 2) / newZoom;
      const newOffsetY = wz - (my - canvas.height / 2) / newZoom;
      return { offsetX: newOffsetX, offsetY: newOffsetY, zoom: newZoom };
    });
  }, []);

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
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mx = (e.clientX - rect.left) * dpr;
    const my = (e.clientY - rect.top) * dpr;
    const [wx, wz] = screenToWorld(mx, my, view, canvas.width, canvas.height);
    setHover(getHoverInfo(wx, wz, layers));
  }, [isPanning, view, layers]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isPanning) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mx = (e.clientX - rect.left) * dpr;
    const my = (e.clientY - rect.top) * dpr;
    const [wx, wz] = screenToWorld(mx, my, view, canvas.width, canvas.height);
    setInspect(getInspectInfo(wx, wz, layers));
  }, [view, layers, isPanning]);

  const resetView = useCallback(() => setView({ offsetX: 0, offsetY: 0, zoom: 0.35 }), []);
  const toggleLayer = useCallback((key: keyof LayerState) => setLayers(l => ({ ...l, [key]: !l[key] })), []);
  const toggleAll = useCallback((on: boolean) => {
    setLayers(l => {
      const next = { ...l };
      for (const k of Object.keys(next) as (keyof LayerState)[]) next[k] = on;
      return next;
    });
  }, []);

  const jumpTo = useCallback((x: number, z: number, zoom?: number) => {
    setView({ offsetX: x, offsetY: z, zoom: zoom ?? 1.2 });
  }, []);

  const layerDefs: { key: keyof LayerState; label: string; color: string; group?: string }[] = [
    { key: 'terrain', label: 'Terrain Heightmap', color: '#4a7c3f', group: 'Environment' },
    { key: 'regions', label: 'Regions / Biomes', color: '#6a8a4a' },
    { key: 'water', label: 'Water (Rivers + Lakes)', color: '#2196f3' },
    { key: 'roads', label: 'Roads', color: '#8d6e46', group: 'Infrastructure' },
    { key: 'railways', label: 'Railways', color: '#e91e63' },
    { key: 'stations', label: 'Stations', color: '#ff9800' },
    { key: 'bridges', label: 'Bridges', color: '#78909c' },
    { key: 'settlements', label: 'Settlements', color: '#ffd700', group: 'Structures' },
    { key: 'buildings', label: 'Buildings', color: '#8d6e46' },
    { key: 'landmarks', label: 'Landmarks', color: '#ffd700' },
    { key: 'pois', label: 'POIs', color: '#9c27b0' },
    { key: 'collision', label: 'Collision Overlay', color: '#ff0', group: 'Debug' },
    { key: 'railLabels', label: 'Rail Waypoint Labels', color: '#e91e63' },
    { key: 'gridLabels', label: 'Grid Coordinates', color: '#555' },
  ];

  return (
    <div style={S.root}>
      {/* LEFT SIDEBAR */}
      <div style={S.sidebar}>
        <div style={S.sidebarInner}>
          {/* Header */}
          <div style={S.header}>
            <h1 style={S.title}>🗺 Trencheria</h1>
            <div style={S.subtitle}>Admin World Map — Phase 1</div>
          </div>

          {/* View controls */}
          <div style={S.section}>
            <div style={S.sectionLabel}>VIEW</div>
            <div style={S.viewInfo}>
              Zoom: {(view.zoom * 100).toFixed(0)}% &nbsp;|&nbsp;
              Center: [{Math.round(view.offsetX)}, {Math.round(view.offsetY)}]
            </div>
            <button onClick={resetView} style={S.btn}>⟳ Reset View</button>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => toggleAll(true)} style={{ ...S.btn, flex: 1 }}>All On</button>
              <button onClick={() => toggleAll(false)} style={{ ...S.btn, flex: 1 }}>All Off</button>
            </div>
          </div>

          {/* Quick jumps */}
          <div style={S.section}>
            <div style={S.sectionLabel}>JUMP TO</div>
            <div style={S.jumpGrid}>
              {SETTLEMENTS.filter(s => s.size === 'large').map(s => (
                <button key={s.id} onClick={() => jumpTo(s.position[0], s.position[1])} style={S.jumpBtn}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Layer toggles */}
          <div style={S.section}>
            <div style={S.sectionLabel}>LAYERS</div>
            {layerDefs.map((ld, i) => (
              <div key={ld.key}>
                {ld.group && (
                  <div style={{ ...S.groupLabel, marginTop: i === 0 ? 0 : 8 }}>{ld.group}</div>
                )}
                <label style={{ ...S.layerRow, opacity: layers[ld.key] ? 1 : 0.35 }}>
                  <input type="checkbox" checked={layers[ld.key]} onChange={() => toggleLayer(ld.key)}
                    style={{ accentColor: ld.color }} />
                  <span style={{ ...S.layerDot, background: ld.color }} />
                  {ld.label}
                </label>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={S.section}>
            <div style={S.sectionLabel}>DATA STATS</div>
            <div style={S.statsBlock}>
              {Object.entries(stats).map(([k, v]) => (
                <div key={k} style={S.statRow}>
                  <span>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                  <span style={{ color: '#4fc3f7' }}>{v}</span>
                </div>
              ))}
              <div style={S.statRow}>
                <span>terrain grid</span>
                <span style={{ color: '#4fc3f7' }}>{TERRAIN_COLS}×{TERRAIN_ROWS}</span>
              </div>
              <div style={S.statRow}>
                <span>world size</span>
                <span style={{ color: '#4fc3f7' }}>{WORLD_SIZE}×{WORLD_SIZE}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={S.footer}>
            Drag to pan • Scroll to zoom<br />
            Click objects to inspect
          </div>
        </div>
      </div>

      {/* MAP CANVAS */}
      <div style={S.mapArea}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', cursor: isPanning ? 'grabbing' : 'grab' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
        />

        {/* Hover tooltip */}
        {hover && (
          <div style={S.hoverBar}>
            <span style={{ color: '#4fc3f7' }}>X: {hover.worldX}</span>
            <span style={{ color: '#4fc3f7' }}>Z: {hover.worldZ}</span>
            <span style={{ color: '#81c784' }}>H: {hover.terrainH}</span>
            {hover.label && <span style={{ color: '#fff' }}>| {hover.label}</span>}
            {hover.type && <span style={{ color: '#aaa' }}>({hover.type})</span>}
          </div>
        )}

        {/* Inspect panel */}
        {inspect && (
          <div style={S.inspectPanel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#4fc3f7', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{inspect.layer}</span>
              <button onClick={() => setInspect(null)} style={{ ...S.btn, padding: '2px 8px', fontSize: 10 }}>✕</button>
            </div>
            <div style={{ fontSize: 15, color: '#fff', fontWeight: 'bold', marginTop: 4 }}>{inspect.name}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>{inspect.type}</div>
            <div style={S.inspectCoord}>
              <span>X: {inspect.x}</span>
              <span>Z: {inspect.z}</span>
              <span>H: {getTerrainHeight(inspect.x, inspect.z).toFixed(2)}</span>
            </div>
            {inspect.extra && (
              <div style={{ marginTop: 6 }}>
                {Object.entries(inspect.extra).map(([k, v]) => (
                  <div key={k} style={S.inspectRow}>
                    <span style={{ color: '#888' }}>{k}</span>
                    <span style={{ color: '#ccc' }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => jumpTo(inspect.x, inspect.z, 2)} style={{ ...S.btn, marginTop: 8, width: '100%' }}>
              🔍 Zoom to object
            </button>
          </div>
        )}

        {/* Legend */}
        <div style={S.legend}>
          <div style={{ fontSize: 9, color: '#888', marginBottom: 4 }}>LEGEND</div>
          {[
            ['#e91e63', 'Rail Line A'], ['#ff9800', 'Rail Line B'], ['#ffd700', 'Settlement'],
            ['#2196f3', 'Water'], ['#8d6e46', 'Road/Building'], ['#78909c', 'Bridge'],
            ['#ff0', 'Collision (debug)'],
          ].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#aaa' }}>
              <span style={{ width: 8, height: 3, background: c, display: 'inline-block', borderRadius: 1 }} />
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== Styles =====
const S: Record<string, React.CSSProperties> = {
  root: { display: 'flex', width: '100vw', height: '100vh', background: '#0a0a18', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: '#ccc', overflow: 'hidden' },
  sidebar: { width: 260, minWidth: 260, background: '#0f0f22', borderRight: '1px solid #1a1a35', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  sidebarInner: { flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 },
  header: { borderBottom: '1px solid #1a1a35', paddingBottom: 10, marginBottom: 4 },
  title: { color: '#fff', fontSize: 16, margin: 0, fontWeight: 700, letterSpacing: 0.5 },
  subtitle: { color: '#556', fontSize: 10, marginTop: 2 },
  section: { marginBottom: 8 },
  sectionLabel: { fontSize: 9, color: '#445', letterSpacing: 1.5, fontWeight: 700, borderBottom: '1px solid #181830', paddingBottom: 3, marginBottom: 6 },
  groupLabel: { fontSize: 8, color: '#335', letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 2 },
  viewInfo: { fontSize: 10, color: '#778', marginBottom: 6 },
  btn: { background: '#151530', border: '1px solid #252545', color: '#99a', padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', marginBottom: 4, display: 'block', width: '100%' },
  jumpGrid: { display: 'flex', flexWrap: 'wrap' as const, gap: 3 },
  jumpBtn: { background: '#151530', border: '1px solid #252545', color: '#8af', padding: '3px 7px', borderRadius: 3, cursor: 'pointer', fontSize: 9, fontFamily: 'inherit' },
  layerRow: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer', padding: '1px 0' },
  layerDot: { width: 7, height: 7, borderRadius: 2, display: 'inline-block', flexShrink: 0 },
  statsBlock: { fontSize: 10, lineHeight: 1.8 },
  statRow: { display: 'flex', justifyContent: 'space-between' },
  footer: { fontSize: 9, color: '#334', borderTop: '1px solid #181830', paddingTop: 8, marginTop: 'auto', textAlign: 'center' as const, lineHeight: 1.6 },
  mapArea: { flex: 1, position: 'relative' as const, overflow: 'hidden' },
  hoverBar: { position: 'absolute' as const, bottom: 8, left: 8, background: '#0d0d1acc', border: '1px solid #252545', borderRadius: 4, padding: '4px 10px', display: 'flex', gap: 10, fontSize: 11, fontFamily: 'inherit', pointerEvents: 'none' as const },
  inspectPanel: { position: 'absolute' as const, top: 12, right: 12, width: 240, background: '#0f0f22ee', border: '1px solid #252545', borderRadius: 6, padding: 12, fontFamily: 'inherit' },
  inspectCoord: { display: 'flex', gap: 10, fontSize: 12, color: '#4fc3f7', background: '#0a0a18', padding: '4px 8px', borderRadius: 3 },
  inspectRow: { display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '1px 0' },
  legend: { position: 'absolute' as const, bottom: 8, right: 8, background: '#0d0d1acc', border: '1px solid #1a1a35', borderRadius: 4, padding: '6px 10px' },
};
