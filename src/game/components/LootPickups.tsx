import * as THREE from 'three';
import { LootPickup } from '../types';

const lootColors: Record<string, string> = {
  wood: '#8b6914',
  stone: '#7a7a7a',
  food: '#cc6644',
  loot_crate: '#6b4f10',
};

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const glowMat = new THREE.MeshBasicMaterial({ color: '#ffdd44', transparent: true, opacity: 0.5 });

interface Props {
  pickups: LootPickup[];
}

export function LootPickups({ pickups }: Props) {
  return (
    <group>
      {pickups.map(p => {
        if (p.collected) return null;
        const color = lootColors[p.type] || '#888';
        return (
          <group key={p.id} position={p.position}>
            <mesh geometry={boxGeo} scale={[0.25, 0.25, 0.25]}
              position={[0, 0.2 + Math.sin(Date.now() * 0.003 + p.position[0]) * 0.1, 0]}
              castShadow>
              <meshLambertMaterial color={color} />
            </mesh>
            {/* Glow ring */}
            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.2, 0.35, 8]} />
              <meshBasicMaterial color="#ffcc44" transparent opacity={0.3} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}