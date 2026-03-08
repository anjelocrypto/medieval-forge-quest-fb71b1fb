import { COLORS, POIS } from '../constants';
import { getTerrainHeight } from './Terrain';

function CastleRuins() {
  const { x, z } = POIS.castle;
  const y = getTerrainHeight(x, z);
  return (
    <group position={[x, y, z]}>
      {/* Main tower */}
      <mesh position={[0, 6, 0]} castShadow>
        <boxGeometry args={[8, 12, 8]} />
        <meshLambertMaterial color={COLORS.castle} />
      </mesh>
      {/* Tower top */}
      <mesh position={[0, 12.5, 0]} castShadow>
        <boxGeometry args={[9, 1, 9]} />
        <meshLambertMaterial color={COLORS.stoneDark} />
      </mesh>
      {/* Walls */}
      {[[-12, 0, 0], [12, 0, 0], [0, 0, -12], [0, 0, 12]].map((pos, i) => (
        <mesh key={i} position={[pos[0], 3, pos[2]]} castShadow>
          <boxGeometry args={[i < 2 ? 2 : 16, 6, i < 2 ? 16 : 2]} />
          <meshLambertMaterial color={COLORS.castle} />
        </mesh>
      ))}
      {/* Corner towers */}
      {[[-12, -12], [12, -12], [-12, 12], [12, 12]].map(([cx, cz], i) => (
        <mesh key={`t${i}`} position={[cx, 4.5, cz]} castShadow>
          <cylinderGeometry args={[2, 2.2, 9, 6]} />
          <meshLambertMaterial color={COLORS.stoneDark} />
        </mesh>
      ))}
      {/* Broken wall section */}
      <mesh position={[12, 1.5, 5]} castShadow>
        <boxGeometry args={[2, 3, 4]} />
        <meshLambertMaterial color={COLORS.stone} />
      </mesh>
    </group>
  );
}

function Village() {
  const { x, z } = POIS.village;
  const y = getTerrainHeight(x, z);
  const houses = [
    [0, 0], [-10, 5], [8, -6], [-5, -10], [12, 8],
  ];
  return (
    <group position={[x, y, z]}>
      {houses.map(([hx, hz], i) => (
        <group key={i} position={[hx, 0, hz]}>
          {/* House body */}
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[4, 3, 5]} />
            <meshLambertMaterial color={COLORS.wood} />
          </mesh>
          {/* Roof */}
          <mesh position={[0, 3.5, 0]} rotation={[0, i % 2 === 0 ? 0 : Math.PI / 2, 0]} castShadow>
            <coneGeometry args={[3.5, 2, 4]} />
            <meshLambertMaterial color={COLORS.roof} />
          </mesh>
        </group>
      ))}
      {/* Well */}
      <mesh position={[3, 0.5, 3]}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshLambertMaterial color={COLORS.stone} />
      </mesh>
    </group>
  );
}

function AncientRuins() {
  const { x, z } = POIS.ruins;
  const y = getTerrainHeight(x, z);
  return (
    <group position={[x, y, z]}>
      {/* Broken pillars */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const r = 10;
        const height = 3 + Math.sin(i * 2.7) * 3;
        return (
          <mesh key={i} position={[Math.cos(angle) * r, height / 2, Math.sin(angle) * r]} castShadow>
            <cylinderGeometry args={[0.6, 0.8, height, 6]} />
            <meshLambertMaterial color={COLORS.stone} />
          </mesh>
        );
      })}
      {/* Center altar */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[3, 1, 3]} />
        <meshLambertMaterial color={COLORS.stoneDark} />
      </mesh>
      {/* Fallen column */}
      <mesh position={[5, 0.4, 3]} rotation={[0, 0.5, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 6, 6]} />
        <meshLambertMaterial color={COLORS.stone} />
      </mesh>
    </group>
  );
}

export function POIs() {
  return (
    <group>
      <CastleRuins />
      <Village />
      <AncientRuins />
    </group>
  );
}
