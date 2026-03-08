/**
 * Settlement renderer — builds all cities/villages/forts/ruins with distance culling.
 * Each settlement type has its own builder function using shared pieces.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { SETTLEMENTS, SettlementDef } from '../world/RegionData';
import { GEO, MAT, seededRng } from '../world/SettlementPieces';
import { getTerrainHeight } from './Terrain';

interface Props {
  playerPositionRef: React.RefObject<THREE.Vector3>;
}

// ========== BUILDING PRIMITIVES ==========

function House({ pos, rot, w, d, h, style }: {
  pos: [number, number, number]; rot: number; w: number; d: number; h: number;
  style: 'stone' | 'wood' | 'plaster' | 'ruin';
}) {
  const wallMat = style === 'stone' ? MAT.stone : style === 'ruin' ? MAT.stoneRuin : style === 'plaster' ? MAT.plaster : MAT.wood;
  const baseMat = style === 'ruin' ? MAT.stoneRuin : MAT.stoneDark;
  const roofM = style === 'ruin' ? null : (style === 'wood' ? MAT.roofThatch : MAT.roof);
  const roofH = style === 'ruin' ? 0 : 2.2;

  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.15, 0]} geometry={GEO.box} scale={[w + 0.4, 0.3, d + 0.4]} material={baseMat} castShadow />
      <mesh position={[0, h / 2 + 0.3, 0]} geometry={GEO.box} scale={[w, h, d]} material={wallMat} castShadow />
      {roofM && (
        <mesh position={[0, h + 0.3 + roofH / 2, 0]} geometry={GEO.cone4} scale={[w * 0.75, roofH, d * 0.75]} material={roofM} castShadow />
      )}
      <mesh position={[0, 0.8, d / 2 + 0.01]} geometry={GEO.box} scale={[0.9, 1.5, 0.08]} material={MAT.door} castShadow />
    </group>
  );
}

function Tower({ pos, h, r, roofStyle }: {
  pos: [number, number, number]; h: number; r: number; roofStyle: 'cone' | 'flat' | 'ruin';
}) {
  return (
    <group position={pos}>
      <mesh position={[0, h / 2, 0]} geometry={GEO.cyl8} scale={[r, h, r]} material={MAT.stone} castShadow />
      {roofStyle === 'cone' && (
        <mesh position={[0, h + 1.5, 0]} geometry={GEO.cone8} scale={[r * 1.3, 3, r * 1.3]} material={MAT.roof} castShadow />
      )}
      {roofStyle === 'flat' && (
        <mesh position={[0, h + 0.2, 0]} geometry={GEO.cyl8} scale={[r * 1.15, 0.4, r * 1.15]} material={MAT.stoneDark} castShadow />
      )}
    </group>
  );
}

function Wall({ from, to, h, thickness }: {
  from: [number, number, number]; to: [number, number, number]; h: number; thickness: number;
}) {
  const dx = to[0] - from[0], dz = to[2] - from[2];
  const len = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const cx = (from[0] + to[0]) / 2;
  const cy = (from[1] + to[1]) / 2 + h / 2;
  const cz = (from[2] + to[2]) / 2;

  return (
    <mesh position={[cx, cy, cz]} rotation={[0, angle, 0]}
      geometry={GEO.box} scale={[thickness, h, len]} material={MAT.stone} castShadow />
  );
}

function Well({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh position={[0, 0.4, 0]} geometry={GEO.cyl8} scale={[0.8, 0.8, 0.8]} material={MAT.stoneDark} castShadow />
      <mesh position={[0, 1.5, 0]} geometry={GEO.box} scale={[0.1, 2, 0.1]} material={MAT.woodDark} castShadow />
      <mesh position={[0, 2.3, 0]} geometry={GEO.box} scale={[1.2, 0.08, 0.08]} material={MAT.woodDark} castShadow />
    </group>
  );
}

function MarketStall({ pos, rot }: { pos: [number, number, number]; rot: number }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh position={[-0.8, 1.2, 0]} geometry={GEO.box} scale={[0.1, 2.4, 0.1]} material={MAT.woodDark} castShadow />
      <mesh position={[0.8, 1.2, 0]} geometry={GEO.box} scale={[0.1, 2.4, 0.1]} material={MAT.woodDark} castShadow />
      <mesh position={[0, 1, 0]} geometry={GEO.box} scale={[1.8, 0.1, 1.2]} material={MAT.woodLight} castShadow />
      <mesh position={[0, 2.5, -0.1]} geometry={GEO.box} scale={[2, 0.05, 1.5]} material={MAT.tent} castShadow />
    </group>
  );
}

function Campfire({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      {[0, 1, 2, 3, 4, 5].map(i => {
        const a = (i / 6) * Math.PI * 2;
        return <mesh key={i} position={[Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5]}
          geometry={GEO.box} scale={[0.2, 0.18, 0.2]} material={MAT.stoneDark} castShadow />;
      })}
      <mesh position={[0, 0.3, 0]} geometry={GEO.box} scale={[0.15, 0.3, 0.15]} material={MAT.fire} />
    </group>
  );
}

function Fence({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const dx = to[0] - from[0], dz = to[2] - from[2];
  const len = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const cx = (from[0] + to[0]) / 2, cz = (from[2] + to[2]) / 2;
  const cy = (from[1] + to[1]) / 2;
  return (
    <group position={[cx, cy, cz]} rotation={[0, angle, 0]}>
      <mesh position={[0, 0.4, 0]} geometry={GEO.box} scale={[0.06, 0.8, len]} material={MAT.fence} castShadow />
      <mesh position={[0, 0.8, 0]} geometry={GEO.box} scale={[0.04, 0.04, len]} material={MAT.fence} castShadow />
    </group>
  );
}

function CropField({ pos, w, d }: { pos: [number, number, number]; w: number; d: number }) {
  return (
    <group position={pos}>
      <mesh position={[0, 0.02, 0]} geometry={GEO.box} scale={[w, 0.04, d]} material={MAT.crop} />
      {Array.from({ length: Math.floor(w / 1.5) }).map((_, i) => (
        <mesh key={i} position={[-w / 2 + 0.75 + i * 1.5, 0.3, 0]}
          geometry={GEO.box} scale={[0.08, 0.5, d * 0.9]} material={MAT.cropGold} castShadow />
      ))}
    </group>
  );
}

function Palisade({ center, radius, segments, h, gateAngle }: {
  center: [number, number, number]; radius: number; segments: number; h: number; gateAngle: number;
}) {
  const posts: JSX.Element[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    // Leave gate gap
    const angleDiff = Math.abs(((a - gateAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
    if (angleDiff < 0.3) continue;
    const x = center[0] + Math.cos(a) * radius;
    const z = center[2] + Math.sin(a) * radius;
    posts.push(
      <mesh key={i} position={[x, center[1] + h / 2, z]} rotation={[0, -a, 0]}
        geometry={GEO.box} scale={[0.3, h, 0.8]} material={MAT.palisade} castShadow />
    );
  }
  return <>{posts}</>;
}

// ========== SETTLEMENT BUILDERS ==========

function CapitalCity({ def }: { def: SettlementDef }) {
  const [cx, cz] = def.position;
  const y = getTerrainHeight(cx, cz);
  const rng = seededRng(7777);

  const houses = useMemo(() => {
    const arr: { pos: [number, number]; rot: number; w: number; d: number; h: number; style: 'stone' | 'plaster' }[] = [];
    // Ring of buildings around center
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const r = 18 + rng() * 12;
      const hx = Math.cos(angle) * r;
      const hz = Math.sin(angle) * r;
      arr.push({
        pos: [hx, hz], rot: angle + Math.PI + (rng() - 0.5) * 0.3,
        w: 3.5 + rng() * 2, d: 4 + rng() * 2, h: 2.8 + rng() * 1.5,
        style: rng() > 0.4 ? 'stone' : 'plaster',
      });
    }
    // Inner ring
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.2;
      const r = 8 + rng() * 5;
      arr.push({
        pos: [Math.cos(angle) * r, Math.sin(angle) * r],
        rot: angle + Math.PI, w: 3 + rng() * 1.5, d: 3.5 + rng() * 1.5,
        h: 3 + rng() * 1, style: 'stone',
      });
    }
    return arr;
  }, []);

  return (
    <group position={[cx, y, cz]}>
      {/* Central keep */}
      <mesh position={[0, 10, 0]} geometry={GEO.box} scale={[12, 20, 12]} material={MAT.stone} castShadow />
      <mesh position={[0, 21.5, 0]} geometry={GEO.cone4} scale={[9, 5, 9]} material={MAT.roof} castShadow />
      {/* Banner */}
      <mesh position={[0, 25, 0]} geometry={GEO.box} scale={[0.1, 4, 0.1]} material={MAT.woodDark} castShadow />
      <mesh position={[0.5, 26, 0]} geometry={GEO.box} scale={[0.8, 1.2, 0.04]} material={MAT.banner} castShadow />

      {/* Walls — square perimeter with south gate gap */}
      <Wall from={[-35, 0, -35]} to={[35, 0, -35]} h={8} thickness={2.5} />
      <Wall from={[35, 0, -35]} to={[35, 0, 35]} h={8} thickness={2.5} />
      {/* South wall — split for gate opening (10-unit gap centered) */}
      <Wall from={[35, 0, 35]} to={5, 0, 35]} h={8} thickness={2.5} />
      <Wall from={[-5, 0, 35]} to={[-35, 0, 35]} h={8} thickness={2.5} />
      <Wall from={[-35, 0, 35]} to={[-35, 0, -35]} h={8} thickness={2.5} />

      {/* Corner towers */}
      {[[-35, -35], [35, -35], [35, 35], [-35, 35]].map(([tx, tz], i) => (
        <Tower key={i} pos={[tx, 0, tz]} h={12} r={3} roofStyle="cone" />
      ))}

      {/* Gate towers */}
      {[-5, 5].map((gx, i) => (
        <Tower key={`g${i}`} pos={[gx, 0, 35.5]} h={10} r={2.2} roofStyle="cone" />
      ))}
      {/* Gate opening */}
      <mesh position={[0, 3, 35.5]} geometry={GEO.box} scale={[4, 5.5, 3]} material={MAT.dark} />

      {/* Buildings */}
      {houses.map((h, i) => {
        const hy = getTerrainHeight(cx + h.pos[0], cz + h.pos[1]) - y;
        return <House key={i} pos={[h.pos[0], hy, h.pos[1]]} rot={h.rot} w={h.w} d={h.d} h={h.h} style={h.style} />;
      })}

      {/* Market stalls */}
      <MarketStall pos={[6, 0, 12]} rot={0} />
      <MarketStall pos={[10, 0, 14]} rot={0.3} />
      <MarketStall pos={[6, 0, 16]} rot={-0.2} />

      {/* Central plaza */}
      <mesh position={[0, 0.05, 12]} geometry={GEO.box} scale={[16, 0.1, 10]} material={MAT.stoneDark} />

      {/* Well */}
      <Well pos={[0, 0, 14]} />

      {/* Stables area */}
      <House pos={[25, 0, 10]} rot={1.5} w={6} d={4} h={2.5} style="wood" />
      <Fence from={[20, 0, 6]} to={[28, 0, 6]} />
      <Fence from={[28, 0, 6]} to={[28, 0, 14]} />
    </group>
  );
}

function FarmingVillage({ def }: { def: SettlementDef }) {
  const [cx, cz] = def.position;
  const y = getTerrainHeight(cx, cz);
  const rng = seededRng(3333);

  return (
    <group position={[cx, y, cz]}>
      {/* Houses — scattered farmstead layout */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + rng() * 0.4;
        const r = 10 + rng() * 15;
        const hx = Math.cos(angle) * r, hz = Math.sin(angle) * r;
        const hy = getTerrainHeight(cx + hx, cz + hz) - y;
        return <House key={i} pos={[hx, hy, hz]} rot={angle + Math.PI + rng() * 0.5}
          w={3.5 + rng() * 1.5} d={4 + rng() * 1.5} h={2.5 + rng() * 0.8}
          style={rng() > 0.3 ? 'wood' : 'plaster'} />;
      })}

      {/* Crop fields */}
      <CropField pos={[-20, 0, -15]} w={12} d={8} />
      <CropField pos={[-8, 0, -22]} w={10} d={6} />
      <CropField pos={[15, 0, -18]} w={8} d={10} />

      {/* Hay bales */}
      {[[-5, 10], [8, -5], [-15, 5]].map(([hx, hz], i) => (
        <mesh key={`hay${i}`} position={[hx, 0.35, hz]} geometry={GEO.cyl8}
          scale={[0.6, 0.7, 0.6]} material={MAT.hay} castShadow />
      ))}

      {/* Barn */}
      <House pos={[12, 0, 8]} rot={0.5} w={6} d={8} h={3.5} style="wood" />

      {/* Well */}
      <Well pos={[0, 0, 0]} />

      {/* Fences around crop fields */}
      <Fence from={[-26, 0, -19]} to={[-14, 0, -19]} />
      <Fence from={[-26, 0, -11]} to={[-14, 0, -11]} />

      {/* Cart */}
      <group position={[5, 0, 5]}>
        <mesh position={[0, 0.5, 0]} geometry={GEO.box} scale={[1.5, 0.6, 2.5]} material={MAT.woodDark} castShadow />
        <mesh position={[-0.8, 0.4, -1.5]} geometry={GEO.box} scale={[0.08, 0.08, 1.5]} material={MAT.woodDark} castShadow />
        <mesh position={[0.8, 0.4, -1.5]} geometry={GEO.box} scale={[0.08, 0.08, 1.5]} material={MAT.woodDark} castShadow />
      </group>
    </group>
  );
}

function MilitaryFort({ def }: { def: SettlementDef }) {
  const [cx, cz] = def.position;
  const y = getTerrainHeight(cx, cz);

  return (
    <group position={[cx, y, cz]}>
      {/* Palisade walls */}
      <Palisade center={[0, 0, 0]} radius={22} segments={32} h={3.5} gateAngle={Math.PI / 2} />

      {/* Corner watchtowers */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a, i) => (
        <Tower key={i} pos={[Math.cos(a) * 22, 0, Math.sin(a) * 22]}
          h={8} r={1.8} roofStyle="flat" />
      ))}

      {/* Main building */}
      <House pos={[0, 0, 0]} rot={0} w={7} d={8} h={4} style="stone" />

      {/* Barracks */}
      <House pos={[-10, 0, 5]} rot={0.3} w={5} d={6} h={3} style="wood" />
      <House pos={[10, 0, -5]} rot={-0.2} w={5} d={4} h={2.8} style="wood" />

      {/* Training yard posts */}
      {[-4, 0, 4].map((px, i) => (
        <mesh key={`tp${i}`} position={[px, 1, 12]} geometry={GEO.box}
          scale={[0.15, 2, 0.15]} material={MAT.woodDark} castShadow />
      ))}

      {/* Supply crates */}
      {[[8, 10], [9, 11], [7.5, 11.5]].map(([sx, sz], i) => (
        <mesh key={`cr${i}`} position={[sx, 0.35, sz]} geometry={GEO.box}
          scale={[0.7, 0.7, 0.7]} material={MAT.woodDark} castShadow />
      ))}

      {/* Campfires */}
      <Campfire pos={[-5, 0, 12]} />
      <Campfire pos={[5, 0, -10]} />

      {/* Beacon tower — tall for visibility */}
      <Tower pos={[0, 0, -18]} h={18} r={2.5} roofStyle="flat" />
      <mesh position={[0, 19, -18]} geometry={GEO.box} scale={[0.8, 0.8, 0.8]} material={MAT.fire} />
    </group>
  );
}

function RuinedCity({ def }: { def: SettlementDef }) {
  const [cx, cz] = def.position;
  const y = getTerrainHeight(cx, cz);
  const rng = seededRng(9999);

  return (
    <group position={[cx, y, cz]}>
      {/* Grand arch — visible from far */}
      <mesh position={[-5, 12, 0]} geometry={GEO.box} scale={[2, 24, 2]} material={MAT.stoneRuin} castShadow />
      <mesh position={[5, 10, 0]} geometry={GEO.box} scale={[2, 20, 2]} material={MAT.stoneRuin} castShadow />
      <mesh position={[0, 22, 0]} geometry={GEO.box} scale={[14, 2, 2.5]} material={MAT.stoneRuin} castShadow />

      {/* Ruined buildings */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2 + rng() * 0.3;
        const r = 12 + rng() * 20;
        const hx = Math.cos(angle) * r, hz = Math.sin(angle) * r;
        const hy = getTerrainHeight(cx + hx, cz + hz) - y;
        const wallH = 1 + rng() * 3;
        return <House key={i} pos={[hx, hy, hz]} rot={rng() * Math.PI * 2}
          w={3 + rng() * 3} d={3 + rng() * 3} h={wallH} style="ruin" />;
      })}

      {/* Pillars */}
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const r = 8;
        const h = 3 + rng() * 6;
        return (
          <group key={`p${i}`} position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}>
            <mesh position={[0, 0.2, 0]} geometry={GEO.box} scale={[1.2, 0.4, 1.2]} material={MAT.stoneRuin} castShadow />
            <mesh position={[0, h / 2 + 0.4, 0]} geometry={GEO.cyl8} scale={[0.45, h, 0.45]} material={MAT.stoneDark} castShadow />
          </group>
        );
      })}

      {/* Fallen column */}
      <mesh position={[8, 0.3, -6]} rotation={[0, 0.5, Math.PI / 2]}
        geometry={GEO.cyl8} scale={[0.35, 6, 0.35]} material={MAT.stoneRuin} castShadow />

      {/* Central altar platform */}
      <mesh position={[0, 0.3, 0]} geometry={GEO.box} scale={[8, 0.6, 8]} material={MAT.stoneRuin} castShadow />
      <mesh position={[0, 1, 0]} geometry={GEO.box} scale={[3, 0.8, 1.5]} material={MAT.stoneDark} castShadow />

      {/* Broken roads */}
      <mesh position={[0, 0.05, 20]} geometry={GEO.box} scale={[4, 0.1, 30]} material={MAT.stoneRuin} />
      <mesh position={[20, 0.05, 0]} geometry={GEO.box} scale={[30, 0.1, 3.5]} material={MAT.stoneRuin} />

      {/* Moss patches */}
      {[[-3, 5], [6, -4], [-8, -8]].map(([mx, mz], i) => (
        <mesh key={`moss${i}`} position={[mx, 0.08, mz]} geometry={GEO.box}
          scale={[2 + rng() * 2, 0.05, 2 + rng() * 2]} material={MAT.moss} />
      ))}
    </group>
  );
}

function BanditCamp({ def }: { def: SettlementDef }) {
  const [cx, cz] = def.position;
  const y = getTerrainHeight(cx, cz);
  const rng = seededRng(5555);

  return (
    <group position={[cx, y, cz]}>
      {/* Scattered tents */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2 + rng() * 0.5;
        const r = 6 + rng() * 10;
        const sz = 1.5 + rng() * 1.5;
        return (
          <mesh key={`t${i}`} position={[Math.cos(angle) * r, sz * 0.5, Math.sin(angle) * r]}
            geometry={GEO.cone6} scale={[sz, sz, sz]} material={rng() > 0.5 ? MAT.tent : MAT.tentDark} castShadow />
        );
      })}

      {/* Lookout posts */}
      {[[-12, 8], [10, -10]].map(([lx, lz], i) => (
        <group key={`lp${i}`} position={[lx, 0, lz]}>
          <mesh position={[0, 3, 0]} geometry={GEO.box} scale={[0.15, 6, 0.15]} material={MAT.woodDark} castShadow />
          <mesh position={[0, 5.5, 0]} geometry={GEO.box} scale={[2, 0.1, 2]} material={MAT.woodDark} castShadow />
          <mesh position={[0, 6, 0]} geometry={GEO.box} scale={[0.1, 1, 0.1]} material={MAT.woodDark} castShadow />
        </group>
      ))}

      {/* Stolen crates */}
      {Array.from({ length: 5 }).map((_, i) => {
        const cx2 = -3 + rng() * 6, cz2 = -3 + rng() * 6;
        return <mesh key={`sc${i}`} position={[cx2, 0.3, cz2]}
          geometry={GEO.box} scale={[0.6, 0.6, 0.6]} material={MAT.woodDark} castShadow />;
      })}

      {/* Cage */}
      <group position={[6, 0, 6]}>
        <mesh position={[0, 0.8, 0]} geometry={GEO.box} scale={[1.8, 1.6, 1.8]} material={MAT.cage}
          {...{ wireframe: true } as any} />
      </group>

      {/* Campfires */}
      <Campfire pos={[0, 0, 0]} />
      <Campfire pos={[-8, 0, -5]} />

      {/* Crude palisade */}
      <Palisade center={[0, 0, 0]} radius={16} segments={20} h={2.5} gateAngle={0} />
    </group>
  );
}

function ForestOutpost({ def }: { def: SettlementDef }) {
  const [cx, cz] = def.position;
  const y = getTerrainHeight(cx, cz);

  return (
    <group position={[cx, y, cz]}>
      <House pos={[0, 0, 0]} rot={0} w={4} d={5} h={3} style="wood" />
      <House pos={[-8, 0, 3]} rot={0.5} w={3} d={3.5} h={2.5} style="wood" />

      {/* Shrine stone */}
      <mesh position={[5, 1, 0]} geometry={GEO.box} scale={[1.5, 2, 0.5]} material={MAT.stoneDark} castShadow />
      <mesh position={[5, 2.2, 0]} geometry={GEO.cone4} scale={[0.8, 0.6, 0.8]} material={MAT.stone} castShadow />

      <Campfire pos={[-3, 0, -5]} />
      <Well pos={[3, 0, -4]} />

      {/* Wooden walkway */}
      <mesh position={[0, 0.1, -8]} geometry={GEO.box} scale={[2, 0.08, 6]} material={MAT.woodDark} />
    </group>
  );
}

function MountainMonastery({ def }: { def: SettlementDef }) {
  const [cx, cz] = def.position;
  const y = getTerrainHeight(cx, cz);

  return (
    <group position={[cx, y, cz]}>
      {/* Main hall */}
      <mesh position={[0, 3.5, 0]} geometry={GEO.box} scale={[8, 7, 12]} material={MAT.stone} castShadow />
      <mesh position={[0, 8, 0]} geometry={GEO.cone4} scale={[6, 4, 9]} material={MAT.roofDark} castShadow />

      {/* Spire */}
      <mesh position={[0, 12, -4]} geometry={GEO.cyl8} scale={[1.2, 8, 1.2]} material={MAT.stone} castShadow />
      <mesh position={[0, 17, -4]} geometry={GEO.cone8} scale={[1.5, 4, 1.5]} material={MAT.stoneDark} castShadow />

      {/* Side building */}
      <House pos={[-8, 0, 4]} rot={0} w={4} d={5} h={3} style="stone" />

      {/* Low stone wall */}
      <Wall from={[-12, 0, -10]} to={[12, 0, -10]} h={2.5} thickness={1.5} />
      <Wall from={[-12, 0, -10]} to={[-12, 0, 10]} h={2.5} thickness={1.5} />
      <Wall from={[12, 0, -10]} to={[12, 0, 10]} h={2.5} thickness={1.5} />

      {/* Courtyard */}
      <mesh position={[0, 0.05, 5]} geometry={GEO.box} scale={[10, 0.1, 8]} material={MAT.stoneDark} />

      <Well pos={[4, 0, 6]} />
    </group>
  );
}

function SmallVillage({ def }: { def: SettlementDef }) {
  const [cx, cz] = def.position;
  const y = getTerrainHeight(cx, cz);
  const rng = seededRng(cx * 100 + cz);

  return (
    <group position={[cx, y, cz]}>
      {Array.from({ length: 4 }).map((_, i) => {
        const angle = (i / 4) * Math.PI * 2 + rng() * 0.5;
        const r = 5 + rng() * 6;
        const hx = Math.cos(angle) * r, hz = Math.sin(angle) * r;
        const hy = getTerrainHeight(cx + hx, cz + hz) - y;
        return <House key={i} pos={[hx, hy, hz]} rot={angle + Math.PI}
          w={3 + rng()} d={3.5 + rng()} h={2.5 + rng() * 0.5}
          style={rng() > 0.5 ? 'wood' : 'plaster'} />;
      })}
      <Well pos={[0, 0, 0]} />
      <mesh position={[4, 0.3, -3]} geometry={GEO.cyl8} scale={[0.5, 0.6, 0.5]} material={MAT.hay} castShadow />
    </group>
  );
}

// ========== SETTLEMENT DISPATCHER ==========

function SettlementRenderer({ def, playerPos }: { def: SettlementDef; playerPos: THREE.Vector3 | null }) {
  // Distance culling
  if (playerPos) {
    const dx = playerPos.x - def.position[0];
    const dz = playerPos.z - def.position[1];
    const distSq = dx * dx + dz * dz;
    const cullDist = def.size === 'large' ? 300 : def.size === 'medium' ? 220 : 160;
    if (distSq > cullDist * cullDist) return null;
  }

  switch (def.type) {
    case 'capital': return <CapitalCity def={def} />;
    case 'village': return def.size === 'small' ? <SmallVillage def={def} /> : <FarmingVillage def={def} />;
    case 'fort': return <MilitaryFort def={def} />;
    case 'ruins': return <RuinedCity def={def} />;
    case 'bandit_camp': return <BanditCamp def={def} />;
    case 'outpost': return <ForestOutpost def={def} />;
    case 'monastery': return <MountainMonastery def={def} />;
    default: return null;
  }
}

export function Settlements({ playerPositionRef }: Props) {
  const playerPos = playerPositionRef.current;

  return (
    <group>
      {SETTLEMENTS.map(def => (
        <SettlementRenderer key={def.id} def={def} playerPos={playerPos} />
      ))}
    </group>
  );
}
