import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants';

const riverMat = new THREE.MeshStandardMaterial({
  color: COLORS.water, transparent: true, opacity: 0.7, metalness: 0.4, roughness: 0.15,
});
const pondMat = new THREE.MeshStandardMaterial({
  color: COLORS.waterDeep, transparent: true, opacity: 0.72, metalness: 0.35, roughness: 0.18,
});

export function Water() {
  const riverRef = useRef<THREE.Mesh>(null);
  const frameSkip = useRef(0);

  useFrame(({ clock }) => {
    // Update water position every 3 frames
    frameSkip.current++;
    if (frameSkip.current % 3 !== 0) return;
    if (riverRef.current) {
      riverRef.current.position.y = -0.75 + Math.sin(clock.elapsedTime * 0.6) * 0.08;
    }
  });

  return (
    <group>
      <mesh ref={riverRef} rotation={[-Math.PI / 2, 0, 0.3]} position={[30, -0.75, 20]} material={riverMat}>
        <planeGeometry args={[22, 130]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-50, -0.55, -40]} material={pondMat}>
        <circleGeometry args={[13, 24]} />
      </mesh>
    </group>
  );
}