/**
 * Debug collision visualization overlay.
 * Renders all active circle and box obstacles as wireframe shapes.
 * Toggle with backtick (`) key.
 */
import { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getCircleObstacles, getBoxObstacles } from '../systems/CollisionSystem';

const debugMat = new THREE.MeshBasicMaterial({ color: '#ff0000', wireframe: true, transparent: true, opacity: 0.5 });
const debugMatBox = new THREE.MeshBasicMaterial({ color: '#00ff00', wireframe: true, transparent: true, opacity: 0.5 });
const debugMatPlayer = new THREE.MeshBasicMaterial({ color: '#ffff00', wireframe: true, transparent: true, opacity: 0.6 });
const circleGeo = new THREE.CylinderGeometry(1, 1, 2, 12);
const boxGeo = new THREE.BoxGeometry(1, 2, 1);

export function DebugCollision({ playerPositionRef, playerRadius = 0.4 }: {
  playerPositionRef: React.RefObject<THREE.Vector3>;
  playerRadius?: number;
}) {
  const [enabled, setEnabled] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Backquote') {
        setEnabled(v => !v);
        setTick(t => t + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Refresh obstacles snapshot periodically when debug is on
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [enabled]);

  const { circles, boxes } = useMemo(() => {
    if (!enabled) return { circles: [], boxes: [] };
    return { circles: [...getCircleObstacles()], boxes: [...getBoxObstacles()] };
  }, [enabled, tick]);

  if (!enabled) return null;

  const pp = playerPositionRef.current;

  return (
    <group>
      {/* Player collision radius */}
      {pp && (
        <mesh position={[pp.x, pp.y + 1, pp.z]} geometry={circleGeo}
          scale={[playerRadius, 1, playerRadius]} material={debugMatPlayer} />
      )}

      {/* Circle obstacles */}
      {circles.map((c, i) => (
        <mesh key={`c${i}`} position={[c.x, 1, c.z]} geometry={circleGeo}
          scale={[c.radius, 1, c.radius]} material={debugMat} />
      ))}

      {/* Box obstacles */}
      {boxes.map((b, i) => (
        <mesh key={`b${i}`} position={[b.cx, 1, b.cz]} rotation={[0, b.rotation, 0]}
          geometry={boxGeo} scale={[b.halfW * 2, 1, b.halfD * 2]} material={debugMatBox} />
      ))}
    </group>
  );
}
