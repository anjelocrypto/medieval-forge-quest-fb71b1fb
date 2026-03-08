import { COLORS, POIS } from '../constants';
import { getTerrainHeight } from './Terrain';

// ── Utility ──
function WoodBeam({ position, rotation = [0, 0, 0], size }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={size} />
      <meshLambertMaterial color={COLORS.woodDark} />
    </mesh>
  );
}

// ── Castle ──
function Castle() {
  const { x, z } = POIS.castle;
  const y = getTerrainHeight(x, z);
  return (
    <group position={[x, y, z]}>
      {/* Main keep - tall dominant tower */}
      <mesh position={[0, 8, 0]} castShadow>
        <boxGeometry args={[10, 16, 10]} />
        <meshLambertMaterial color={COLORS.castle} />
      </mesh>
      {/* Keep battlements */}
      {[-4, -2, 0, 2, 4].map((bx, i) =>
        [-4, 4].map((bz, j) => (
          <mesh key={`bt-${i}-${j}`} position={[bx, 16.5, bz]} castShadow>
            <boxGeometry args={[1.5, 1, 1.5]} />
            <meshLambertMaterial color={COLORS.stoneDark} />
          </mesh>
        ))
      )}
      {[-4, 4].map((bx, i) =>
        [-2, 0, 2].map((bz, j) => (
          <mesh key={`bts-${i}-${j}`} position={[bx, 16.5, bz]} castShadow>
            <boxGeometry args={[1.5, 1, 1.5]} />
            <meshLambertMaterial color={COLORS.stoneDark} />
          </mesh>
        ))
      )}

      {/* Keep roof cap */}
      <mesh position={[0, 17.5, 0]} castShadow>
        <coneGeometry args={[7.5, 4, 4]} />
        <meshLambertMaterial color={COLORS.roof} />
      </mesh>

      {/* Window slits */}
      {[[-5.05, 6, 0], [5.05, 6, 0], [0, 6, -5.05], [0, 6, 5.05],
        [-5.05, 10, 0], [5.05, 10, 0]].map(([wx, wy, wz], i) => (
        <mesh key={`win-${i}`} position={[wx, wy, wz]} castShadow>
          <boxGeometry args={[0.3, 1.5, 0.3]} />
          <meshLambertMaterial color="#2a2a2a" />
        </mesh>
      ))}

      {/* Curtain walls - thicker, taller */}
      {/* North & South walls */}
      <mesh position={[0, 4, -18]} castShadow>
        <boxGeometry args={[28, 8, 2.5]} />
        <meshLambertMaterial color={COLORS.castle} />
      </mesh>
      <mesh position={[0, 4, 18]} castShadow>
        <boxGeometry args={[28, 8, 2.5]} />
        <meshLambertMaterial color={COLORS.castle} />
      </mesh>
      {/* East & West walls */}
      <mesh position={[-14, 4, 0]} castShadow>
        <boxGeometry args={[2.5, 8, 33]} />
        <meshLambertMaterial color={COLORS.castle} />
      </mesh>
      <mesh position={[14, 4, 0]} castShadow>
        <boxGeometry args={[2.5, 8, 33]} />
        <meshLambertMaterial color={COLORS.castle} />
      </mesh>

      {/* Wall battlements on top */}
      {Array.from({ length: 10 }).map((_, i) => {
        const bx = -12 + i * 2.8;
        return (
          <group key={`wbt-${i}`}>
            <mesh position={[bx, 8.5, -18]} castShadow>
              <boxGeometry args={[1.2, 1, 2.8]} />
              <meshLambertMaterial color={COLORS.stoneDark} />
            </mesh>
            <mesh position={[bx, 8.5, 18]} castShadow>
              <boxGeometry args={[1.2, 1, 2.8]} />
              <meshLambertMaterial color={COLORS.stoneDark} />
            </mesh>
          </group>
        );
      })}

      {/* Corner towers - taller, more imposing */}
      {[[-14, -18], [14, -18], [-14, 18], [14, 18]].map(([cx, cz], i) => (
        <group key={`tower-${i}`}>
          <mesh position={[cx, 6, cz]} castShadow>
            <cylinderGeometry args={[3, 3.5, 12, 8]} />
            <meshLambertMaterial color={COLORS.stoneDark} />
          </mesh>
          {/* Tower cap */}
          <mesh position={[cx, 13, cz]} castShadow>
            <coneGeometry args={[3.8, 3, 8]} />
            <meshLambertMaterial color={COLORS.roof} />
          </mesh>
          {/* Tower battlements */}
          {[0, 1, 2, 3].map(j => {
            const a = (j / 4) * Math.PI * 2;
            return (
              <mesh key={j} position={[cx + Math.cos(a) * 3.2, 12.3, cz + Math.sin(a) * 3.2]} castShadow>
                <boxGeometry args={[1, 0.8, 1]} />
                <meshLambertMaterial color={COLORS.stoneDark} />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* Gatehouse - south wall opening */}
      <mesh position={[0, 7, 18.5]} castShadow>
        <boxGeometry args={[6, 3, 3]} />
        <meshLambertMaterial color={COLORS.stoneDark} />
      </mesh>
      {/* Gate arch dark */}
      <mesh position={[0, 3, 18.5]}>
        <boxGeometry args={[4, 5.5, 3.2]} />
        <meshLambertMaterial color="#1a1a1a" />
      </mesh>
      {/* Gate towers */}
      {[-4.5, 4.5].map((gx, i) => (
        <group key={`gate-${i}`}>
          <mesh position={[gx, 6, 18.5]} castShadow>
            <cylinderGeometry args={[2, 2.3, 12, 6]} />
            <meshLambertMaterial color={COLORS.castle} />
          </mesh>
          <mesh position={[gx, 12.5, 18.5]} castShadow>
            <coneGeometry args={[2.5, 2.5, 6]} />
            <meshLambertMaterial color={COLORS.roof} />
          </mesh>
        </group>
      ))}

      {/* Broken wall section - adds atmosphere */}
      <mesh position={[14, 2, 8]} castShadow>
        <boxGeometry args={[3, 4, 4]} />
        <meshLambertMaterial color={COLORS.stone} />
      </mesh>
      <mesh position={[15, 0.5, 10]} castShadow>
        <boxGeometry args={[2, 1, 2]} />
        <meshLambertMaterial color={COLORS.stone} />
      </mesh>

      {/* Courtyard details */}
      {/* Wooden practice dummy */}
      <WoodBeam position={[-5, 1.5, 5]} size={[0.2, 3, 0.2]} />
      <WoodBeam position={[-5, 2.5, 5]} rotation={[0, 0, 0]} size={[1.5, 0.15, 0.15]} />

      {/* Barrels */}
      {[[-7, 0.4, -5], [-6, 0.4, -5.5], [-7.5, 0.4, -4.5]].map(([bx, by, bz], i) => (
        <mesh key={`barrel-${i}`} position={[bx, by, bz]} castShadow>
          <cylinderGeometry args={[0.4, 0.35, 0.8, 8]} />
          <meshLambertMaterial color={COLORS.woodDark} />
        </mesh>
      ))}

      {/* Banner pole on keep */}
      <WoodBeam position={[0, 20, 0]} size={[0.1, 4, 0.1]} />
      <mesh position={[0.4, 20.5, 0]} castShadow>
        <boxGeometry args={[0.7, 1, 0.04]} />
        <meshLambertMaterial color="#8b2020" />
      </mesh>
    </group>
  );
}

// ── Village ──
function Village() {
  const { x, z } = POIS.village;
  const y = getTerrainHeight(x, z);

  const houses = [
    { pos: [0, 0] as [number, number], rot: 0, sizeW: 5, sizeD: 6, sizeH: 3.5, roofH: 2.5, hasChimney: true, hasPorch: true },
    { pos: [-12, 6] as [number, number], rot: 0.3, sizeW: 4, sizeD: 5, sizeH: 3, roofH: 2, hasChimney: false, hasPorch: false },
    { pos: [10, -7] as [number, number], rot: -0.5, sizeW: 6, sizeD: 5, sizeH: 3.5, roofH: 2.2, hasChimney: true, hasPorch: false },
    { pos: [-6, -12] as [number, number], rot: 1.2, sizeW: 4.5, sizeD: 5.5, sizeH: 3, roofH: 2, hasChimney: false, hasPorch: true },
    { pos: [14, 9] as [number, number], rot: 2.1, sizeW: 5, sizeD: 4.5, sizeH: 3.2, roofH: 2.3, hasChimney: true, hasPorch: false },
    { pos: [-14, -4] as [number, number], rot: 0.8, sizeW: 3.5, sizeD: 4, sizeH: 2.8, roofH: 1.8, hasChimney: false, hasPorch: false },
  ];

  return (
    <group position={[x, y, z]}>
      {houses.map((h, i) => {
        const hy = getTerrainHeight(x + h.pos[0], z + h.pos[1]) - y;
        return (
          <group key={i} position={[h.pos[0], hy, h.pos[1]]} rotation={[0, h.rot, 0]}>
            {/* Foundation */}
            <mesh position={[0, 0.15, 0]} castShadow>
              <boxGeometry args={[h.sizeW + 0.4, 0.3, h.sizeD + 0.4]} />
              <meshLambertMaterial color={COLORS.stone} />
            </mesh>
            {/* Walls - lower half stone, upper half timber */}
            <mesh position={[0, 0.9, 0]} castShadow>
              <boxGeometry args={[h.sizeW, 1.5, h.sizeD]} />
              <meshLambertMaterial color={COLORS.stoneDark} />
            </mesh>
            <mesh position={[0, 2.15, 0]} castShadow>
              <boxGeometry args={[h.sizeW, 1, h.sizeD]} />
              <meshLambertMaterial color={COLORS.wood} />
            </mesh>
            {/* Timber frame beams */}
            <WoodBeam position={[-h.sizeW / 2, 1.65, 0]} size={[0.12, h.sizeH, 0.12]} />
            <WoodBeam position={[h.sizeW / 2, 1.65, 0]} size={[0.12, h.sizeH, 0.12]} />
            <WoodBeam position={[0, 1.65, -h.sizeD / 2]} size={[0.12, h.sizeH, 0.12]} />
            <WoodBeam position={[0, 1.65, h.sizeD / 2]} size={[0.12, h.sizeH, 0.12]} />
            {/* Horizontal beam */}
            <WoodBeam position={[0, 2.7, h.sizeD / 2 + 0.01]} size={[h.sizeW + 0.2, 0.12, 0.12]} />
            <WoodBeam position={[0, 2.7, -h.sizeD / 2 - 0.01]} size={[h.sizeW + 0.2, 0.12, 0.12]} />

            {/* Roof - triangular prism via scaled box */}
            <mesh position={[0, h.sizeH + h.roofH / 2, 0]} rotation={[0, 0, 0]} castShadow>
              <coneGeometry args={[h.sizeW * 0.75, h.roofH, 4]} />
              <meshLambertMaterial color={COLORS.roof} />
            </mesh>
            {/* Roof overhang */}
            <mesh position={[0, h.sizeH + 0.05, 0]} castShadow>
              <boxGeometry args={[h.sizeW + 0.8, 0.1, h.sizeD + 0.8]} />
              <meshLambertMaterial color={COLORS.woodDark} />
            </mesh>

            {/* Door */}
            <mesh position={[0, 0.8, h.sizeD / 2 + 0.01]} castShadow>
              <boxGeometry args={[0.9, 1.5, 0.08]} />
              <meshLambertMaterial color="#3a2510" />
            </mesh>

            {/* Window shutters */}
            <mesh position={[h.sizeW / 2 + 0.01, 1.8, 0]} castShadow>
              <boxGeometry args={[0.08, 0.6, 0.5]} />
              <meshLambertMaterial color="#2a1a0a" />
            </mesh>

            {/* Chimney */}
            {h.hasChimney && (
              <mesh position={[h.sizeW * 0.3, h.sizeH + h.roofH + 0.5, 0]} castShadow>
                <boxGeometry args={[0.7, 1.5, 0.7]} />
                <meshLambertMaterial color={COLORS.stoneDark} />
              </mesh>
            )}

            {/* Porch */}
            {h.hasPorch && (
              <group>
                <mesh position={[0, 0.15, h.sizeD / 2 + 0.8]} castShadow>
                  <boxGeometry args={[h.sizeW * 0.6, 0.1, 1.2]} />
                  <meshLambertMaterial color={COLORS.wood} />
                </mesh>
                <WoodBeam position={[-h.sizeW * 0.25, 1.5, h.sizeD / 2 + 1.3]} size={[0.1, 2.7, 0.1]} />
                <WoodBeam position={[h.sizeW * 0.25, 1.5, h.sizeD / 2 + 1.3]} size={[0.1, 2.7, 0.1]} />
                <mesh position={[0, 2.85, h.sizeD / 2 + 0.8]} castShadow>
                  <boxGeometry args={[h.sizeW * 0.65, 0.08, 1.5]} />
                  <meshLambertMaterial color={COLORS.woodDark} />
                </mesh>
              </group>
            )}
          </group>
        );
      })}

      {/* Well - more detailed */}
      <group position={[4, 0, 4]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[1, 1.1, 1, 8]} />
          <meshLambertMaterial color={COLORS.stone} />
        </mesh>
        <WoodBeam position={[-0.9, 1.8, 0]} size={[0.12, 2.5, 0.12]} />
        <WoodBeam position={[0.9, 1.8, 0]} size={[0.12, 2.5, 0.12]} />
        <WoodBeam position={[0, 3, 0]} size={[2.2, 0.1, 0.1]} />
        <mesh position={[0, 2.5, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.4, 6]} />
          <meshLambertMaterial color={COLORS.woodDark} />
        </mesh>
      </group>

      {/* Market stall */}
      <group position={[6, 0, -2]} rotation={[0, 0.4, 0]}>
        <WoodBeam position={[-1.2, 1, 0]} size={[0.1, 2, 0.1]} />
        <WoodBeam position={[1.2, 1, 0]} size={[0.1, 2, 0.1]} />
        <WoodBeam position={[-1.2, 1, 1.5]} size={[0.1, 2, 0.1]} />
        <WoodBeam position={[1.2, 1, 1.5]} size={[0.1, 2, 0.1]} />
        <mesh position={[0, 2.1, 0.75]} castShadow>
          <boxGeometry args={[2.8, 0.08, 2]} />
          <meshLambertMaterial color={COLORS.wood} />
        </mesh>
        <mesh position={[0, 0.8, 0.75]} castShadow>
          <boxGeometry args={[2.4, 0.08, 1.5]} />
          <meshLambertMaterial color={COLORS.woodDark} />
        </mesh>
      </group>

      {/* Hay bales */}
      {[[-8, -6], [9, 5], [-3, 8]].map(([bx, bz], i) => (
        <mesh key={`hay-${i}`} position={[bx, 0.4, bz]} rotation={[0, i * 1.3, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.7, 8]} />
          <meshLambertMaterial color="#c4a040" />
        </mesh>
      ))}

      {/* Cart */}
      <group position={[-10, 0.3, -8]} rotation={[0, 0.7, 0]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[1.8, 0.6, 3]} />
          <meshLambertMaterial color={COLORS.wood} />
        </mesh>
        <mesh position={[0, 0.9, -1.4]} castShadow>
          <boxGeometry args={[1.8, 0.6, 0.1]} />
          <meshLambertMaterial color={COLORS.woodDark} />
        </mesh>
        <WoodBeam position={[0, 0.3, 1.8]} size={[0.1, 0.1, 0.6]} />
      </group>

      {/* Village path markers - small stones */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const r = 16 + Math.sin(i * 3) * 3;
        return (
          <mesh key={`path-${i}`} position={[Math.cos(angle) * r, 0.05, Math.sin(angle) * r]}>
            <boxGeometry args={[0.5, 0.1, 0.5]} />
            <meshLambertMaterial color={COLORS.road} />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Ancient Ruins ──
function AncientRuins() {
  const { x, z } = POIS.ruins;
  const y = getTerrainHeight(x, z);
  return (
    <group position={[x, y, z]}>
      {/* Standing pillars - varying heights, some broken */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const r = 12;
        const height = 2 + Math.sin(i * 2.7) * 4 + 2;
        const broken = i % 3 === 0;
        return (
          <group key={i} position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}>
            {/* Pillar base */}
            <mesh position={[0, 0.25, 0]} castShadow>
              <boxGeometry args={[1.4, 0.5, 1.4]} />
              <meshLambertMaterial color={COLORS.stoneDark} />
            </mesh>
            {/* Pillar shaft */}
            <mesh position={[0, height / 2 + 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.5, 0.7, height, 8]} />
              <meshLambertMaterial color={broken ? '#8a8070' : COLORS.stone} />
            </mesh>
            {/* Capital on intact pillars */}
            {!broken && (
              <mesh position={[0, height + 0.7, 0]} castShadow>
                <boxGeometry args={[1.2, 0.4, 1.2]} />
                <meshLambertMaterial color={COLORS.stoneDark} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Center altar - more imposing */}
      <group>
        {/* Base steps */}
        <mesh position={[0, 0.15, 0]} castShadow>
          <boxGeometry args={[6, 0.3, 6]} />
          <meshLambertMaterial color={COLORS.stoneDark} />
        </mesh>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[5, 0.3, 5]} />
          <meshLambertMaterial color={COLORS.stoneDark} />
        </mesh>
        {/* Altar top */}
        <mesh position={[0, 0.95, 0]} castShadow>
          <boxGeometry args={[3.5, 0.7, 2]} />
          <meshLambertMaterial color="#4a4040" />
        </mesh>
        {/* Altar symbol (flat raised detail) */}
        <mesh position={[0, 1.35, 0]} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.08, 6]} />
          <meshLambertMaterial color="#6a5a4a" />
        </mesh>
      </group>

      {/* Fallen columns */}
      <mesh position={[6, 0.4, 4]} rotation={[0, 0.5, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.4, 0.5, 7, 6]} />
        <meshLambertMaterial color="#8a8070" />
      </mesh>
      <mesh position={[-5, 0.35, -6]} rotation={[0.1, -0.8, Math.PI / 2.2]} castShadow>
        <cylinderGeometry args={[0.35, 0.45, 5, 6]} />
        <meshLambertMaterial color={COLORS.stone} />
      </mesh>

      {/* Broken wall fragments */}
      {[[8, 0.5, -3], [-7, 0.6, 5], [3, 0.3, -8], [-9, 0.4, -2]].map(([fx, fy, fz], i) => (
        <mesh key={`frag-${i}`} position={[fx, fy, fz]} rotation={[0, i * 1.5, 0]} castShadow>
          <boxGeometry args={[2 + Math.sin(i) * 0.5, fy * 2, 0.8]} />
          <meshLambertMaterial color={COLORS.stoneDark} />
        </mesh>
      ))}

      {/* Stone archway remains */}
      <group position={[0, 0, 12]} rotation={[0, 0.3, 0]}>
        <mesh position={[-2, 2.5, 0]} castShadow>
          <boxGeometry args={[1, 5, 1]} />
          <meshLambertMaterial color={COLORS.stone} />
        </mesh>
        <mesh position={[2, 2, 0]} castShadow>
          <boxGeometry args={[1, 4, 1]} />
          <meshLambertMaterial color={COLORS.stone} />
        </mesh>
        <mesh position={[0, 4.8, 0]} castShadow>
          <boxGeometry args={[5.5, 0.8, 1]} />
          <meshLambertMaterial color={COLORS.stoneDark} />
        </mesh>
      </group>

      {/* Mysterious glow at altar */}
      <pointLight position={[0, 2, 0]} color="#4488aa" intensity={0.5} distance={12} />
    </group>
  );
}

// ── Bandit Camp ──
function BanditCamp() {
  const { x, z } = POIS.camp;
  const y = getTerrainHeight(x, z);
  return (
    <group position={[x, y, z]}>
      {/* Tent 1 */}
      <group position={[-3, 0, 0]}>
        <mesh position={[0, 1.2, 0]} castShadow>
          <coneGeometry args={[2.5, 2.5, 6]} />
          <meshLambertMaterial color="#6a5a3a" />
        </mesh>
        <WoodBeam position={[0, 0.8, 0]} size={[0.1, 2.5, 0.1]} />
      </group>
      {/* Tent 2 */}
      <group position={[4, 0, 3]} rotation={[0, 1.2, 0]}>
        <mesh position={[0, 1, 0]} castShadow>
          <coneGeometry args={[2, 2, 6]} />
          <meshLambertMaterial color="#5a4a30" />
        </mesh>
        <WoodBeam position={[0, 0.6, 0]} size={[0.1, 2, 0.1]} />
      </group>
      {/* Campfire */}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.6, 0.1, Math.sin(a) * 0.6]} castShadow>
            <boxGeometry args={[0.25, 0.2, 0.25]} />
            <meshLambertMaterial color={COLORS.stone} />
          </mesh>
        );
      })}
      <pointLight position={[0, 0.5, 0]} color="#ff6600" intensity={1.5} distance={10} />
      {/* Log seats */}
      {[[-1.5, 0.2, 1.5], [1.5, 0.2, -1], [0, 0.2, -2]].map(([lx, ly, lz], i) => (
        <mesh key={`log-${i}`} position={[lx, ly, lz]} rotation={[Math.PI / 2, 0, i * 1.1]} castShadow>
          <cylinderGeometry args={[0.15, 0.18, 1.2, 5]} />
          <meshLambertMaterial color={COLORS.woodDark} />
        </mesh>
      ))}
      {/* Weapon rack */}
      <group position={[5, 0, -3]}>
        <WoodBeam position={[0, 0.8, 0]} size={[0.1, 1.6, 0.1]} />
        <WoodBeam position={[1, 0.8, 0]} size={[0.1, 1.6, 0.1]} />
        <WoodBeam position={[0.5, 1.5, 0]} size={[1.3, 0.08, 0.08]} />
        <mesh position={[0.3, 1, 0.08]} rotation={[0, 0, 0.2]} castShadow>
          <boxGeometry args={[0.06, 0.8, 0.04]} />
          <meshLambertMaterial color="#888" />
        </mesh>
        <mesh position={[0.7, 1, 0.08]} rotation={[0, 0, -0.15]} castShadow>
          <boxGeometry args={[0.06, 0.9, 0.04]} />
          <meshLambertMaterial color="#888" />
        </mesh>
      </group>
    </group>
  );
}

export function POIs() {
  return (
    <group>
      <Castle />
      <Village />
      <AncientRuins />
      <BanditCamp />
    </group>
  );
}
