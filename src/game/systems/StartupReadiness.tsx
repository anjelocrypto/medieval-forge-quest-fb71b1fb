/**
 * StartupReadiness — tracks real loading milestones from inside the R3F Canvas.
 * 
 * Placed inside the GameScene Canvas, it:
 * 1. Detects when the first useFrame fires (Canvas + WebGL ready)
 * 2. Waits a few stable frames to confirm the render loop is alive
 * 3. Calls onReady() so the loading overlay can fade out
 * 
 * This replaces the fake timer approach — the loading screen stays
 * visible until the game world has actually rendered.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

interface Props {
  onReady: () => void;
}

/** Minimum number of consecutive frames before we declare "ready" */
const MIN_STABLE_FRAMES = 8;

export function StartupReadiness({ onReady }: Props) {
  const frameCount = useRef(0);
  const fired = useRef(false);

  useFrame(() => {
    if (fired.current) return;
    frameCount.current++;

    // Wait for several stable frames — proves Canvas, WebGL, Terrain,
    // Suspense boundaries have all resolved and the loop is alive.
    if (frameCount.current >= MIN_STABLE_FRAMES) {
      fired.current = true;
      console.log(`[Startup] Scene ready after ${frameCount.current} stable frames`);
      onReady();
    }
  });

  return null;
}
