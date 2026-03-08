import { useFrame } from '@react-three/fiber';
import { flushInput } from './InputSystem';

// Must be placed inside Canvas to flush input edge-triggers each frame
export function InputFlusher() {
  useFrame(() => {
    flushInput();
  }, 999); // high priority = runs last
  return null;
}
