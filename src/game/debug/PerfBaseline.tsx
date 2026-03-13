/**
 * PerfBaseline — Baseline measurement tooling for P0 refactor.
 * 
 * Provides:
 * 1. stats.js FPS/MS overlay (top-left)
 * 2. React render commit counter (logs commits/sec to console every 5s)
 * 3. Heap snapshot logger (logs heap MB to console every 30s)
 * 
 * Mount this inside <Canvas> for the R3F useFrame hook,
 * and mount PerfBaselineHUD outside <Canvas> for the DOM overlay.
 * 
 * This file is BASELINE TOOLING ONLY. No gameplay logic. Remove after P0 validation.
 */

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Stats from 'stats.js';

// ─── R3F Frame Tick Counter ───

let tickCount = 0;
let lastTickLogTime = 0;

/**
 * R3F component — mount inside <Canvas>.
 * Counts useFrame ticks (render loop iterations, NOT React commits).
 */
export function PerfBaselineR3F() {
  useFrame(() => {
    tickCount++;
    const now = performance.now();
    if (lastTickLogTime === 0) lastTickLogTime = now;
    if (now - lastTickLogTime > 5000) {
      const elapsed = (now - lastTickLogTime) / 1000;
      const rate = tickCount / elapsed;
      console.log(`[PerfBaseline] Frame ticks/sec: ${rate.toFixed(1)} (${tickCount} ticks in ${elapsed.toFixed(1)}s)`);
      tickCount = 0;
      lastTickLogTime = now;
    }
  });

  return null;
}

// ─── stats.js FPS overlay + Heap logger (DOM side) ───

/**
 * DOM component — mount outside <Canvas>.
 * Creates stats.js panel and logs heap snapshots.
 */
export function PerfBaselineHUD() {
  const statsRef = useRef<Stats | null>(null);

  useEffect(() => {
    // stats.js FPS panel
    const stats = new Stats();
    stats.showPanel(0); // 0 = FPS, 1 = MS, 2 = MB
    stats.dom.style.position = 'fixed';
    stats.dom.style.top = '0px';
    stats.dom.style.right = '0px';
    stats.dom.style.left = 'auto';
    stats.dom.style.zIndex = '99999';
    document.body.appendChild(stats.dom);
    statsRef.current = stats;

    let raf: number;
    const loop = () => {
      stats.begin();
      stats.end();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Heap snapshot logger (every 30s)
    const heapInterval = setInterval(() => {
      const perf = (performance as any);
      if (perf.memory) {
        const used = (perf.memory.usedJSHeapSize / 1048576).toFixed(1);
        const total = (perf.memory.totalJSHeapSize / 1048576).toFixed(1);
        const limit = (perf.memory.jsHeapSizeLimit / 1048576).toFixed(0);
        console.log(`[PerfBaseline] Heap: ${used}MB used / ${total}MB total / ${limit}MB limit`);
      } else {
        console.log('[PerfBaseline] Heap: performance.memory not available (use Chrome with --enable-precise-memory-info)');
      }
    }, 30000);

    // Log initial heap
    setTimeout(() => {
      const perf = (performance as any);
      if (perf.memory) {
        const used = (perf.memory.usedJSHeapSize / 1048576).toFixed(1);
        console.log(`[PerfBaseline] Initial heap: ${used}MB`);
      }
    }, 2000);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(heapInterval);
      if (stats.dom.parentNode) {
        stats.dom.parentNode.removeChild(stats.dom);
      }
    };
  }, []);

  return null;
}
