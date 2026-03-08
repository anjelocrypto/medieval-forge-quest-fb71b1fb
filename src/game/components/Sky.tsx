import { COLORS } from '../constants';

export function Sky() {
  return (
    <mesh>
      <sphereGeometry args={[400, 32, 16]} />
      <meshBasicMaterial color={COLORS.sky} side={2} />
    </mesh>
  );
}
