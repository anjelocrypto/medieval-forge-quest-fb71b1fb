import { useFrame } from '@react-three/fiber';
import { flushInput } from './InputSystem';

export function InputFlusher() {
  // Negative priority = runs LAST in the frame
  useFrame(() => {
    flushInput();
  }, -999);
  return null;
}
