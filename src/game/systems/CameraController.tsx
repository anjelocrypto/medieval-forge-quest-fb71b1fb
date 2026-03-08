import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const ORBIT_DISTANCE = 12;
const MIN_DISTANCE = 6;
const MAX_DISTANCE = 20;
const MIN_POLAR = 0.3;
const MAX_POLAR = 1.4;
const ORBIT_SENSITIVITY = 0.003;
const ZOOM_SENSITIVITY = 0.5;
const CAMERA_LERP = 6;
const CAMERA_HEIGHT_OFFSET = 2;

interface CameraControllerProps {
  targetRef: React.RefObject<THREE.Vector3>;
  azimuthRef: React.MutableRefObject<number>;
}

export function CameraController({ targetRef, azimuthRef }: CameraControllerProps) {
  const { camera, gl } = useThree();
  const polarRef = useRef(0.7);
  const distanceRef = useRef(ORBIT_DISTANCE);

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerDown = () => {
      canvas.requestPointerLock?.();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      azimuthRef.current -= e.movementX * ORBIT_SENSITIVITY;
      polarRef.current = THREE.MathUtils.clamp(
        polarRef.current - e.movementY * ORBIT_SENSITIVITY,
        MIN_POLAR,
        MAX_POLAR
      );
    };

    const onWheel = (e: WheelEvent) => {
      distanceRef.current = THREE.MathUtils.clamp(
        distanceRef.current + e.deltaY * 0.01 * ZOOM_SENSITIVITY,
        MIN_DISTANCE,
        MAX_DISTANCE
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') document.exitPointerLock?.();
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel);
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [gl, azimuthRef]);

  useFrame((_, delta) => {
    const target = targetRef.current;
    if (!target) return;
    const dt = Math.min(delta, 0.05);

    const dist = distanceRef.current;
    const azimuth = azimuthRef.current;
    const polar = polarRef.current;

    const offsetX = dist * Math.sin(polar) * Math.sin(azimuth);
    const offsetY = dist * Math.cos(polar);
    const offsetZ = dist * Math.sin(polar) * Math.cos(azimuth);

    const targetPos = new THREE.Vector3(
      target.x + offsetX,
      target.y + offsetY + CAMERA_HEIGHT_OFFSET,
      target.z + offsetZ,
    );

    camera.position.lerp(targetPos, CAMERA_LERP * dt);
    camera.lookAt(target.x, target.y + 1.2, target.z);
  });

  return null;
}
