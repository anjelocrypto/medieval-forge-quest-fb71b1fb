import { Suspense, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import goblinStandingUrl from '@/assets/goblinstanding.glb?url';
import soldierStandingUrl from '@/assets/standing.glb?url';
import octopusStandingUrl from '@/assets/octopusstanding.glb?url';
import nemoStandingUrl from '@/assets/nemostanding.glb?url';

const STANDING_URLS: Record<string, string> = {
  goblin: goblinStandingUrl,
  soldier: soldierStandingUrl,
  octopus: octopusStandingUrl,
  nemoclaw: nemoStandingUrl,
};

// Preload all
Object.values(STANDING_URLS).forEach((url) => useGLTF.preload(url));

function ModelViewer({ url }: { url: string }) {
  const gltf = useGLTF(url);

  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    return clone;
  }, [gltf.scene]);

  // Compute scale & offset to perfectly center model in preview
  const { scale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    // If bounding box is degenerate (empty mesh), use fallback
    const s = maxDim > 0.01 ? 1.8 / maxDim : 1;
    // Center the model: offset so bounding box center is at origin
    return {
      scale: s,
      offset: new THREE.Vector3(-center.x * s, -center.y * s, -center.z * s),
    };
  }, [scene]);

  // Play idle animation if available
  const clips = useMemo(() => {
    return gltf.animations.map((clip) => {
      const c = clip.clone();
      c.name = clip.name || 'idle';
      return c;
    });
  }, [gltf.animations]);

  const { actions } = useAnimations(clips, scene);

  useEffect(() => {
    const name = Object.keys(actions)[0];
    if (name && actions[name]) {
      actions[name]!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
    return () => {
      Object.values(actions).forEach((a) => a?.stop());
    };
  }, [actions]);

  return (
    <group position={[0, yOffset - 0.6, 0]} scale={[scale, scale, scale]}>
      <primitive object={scene} dispose={null} />
    </group>
  );
}

interface CharacterPreviewProps {
  characterType: string;
  selected: boolean;
}

export function CharacterPreview({ characterType, selected }: CharacterPreviewProps) {
  const url = STANDING_URLS[characterType];
  if (!url) return null;

  return (
    <div style={{ width: '100%', height: 160, position: 'relative' }}>
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        camera={{ position: [0, 0.5, 2.8], fov: 35 }}
        style={{ background: 'transparent' }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 2]} intensity={1.2} />
        <directionalLight position={[-2, 1, -1]} intensity={0.3} />
        <Suspense fallback={null}>
          <ModelViewer url={url} />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={selected}
          autoRotateSpeed={3}
          minPolarAngle={Math.PI / 2.5}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Canvas>
    </div>
  );
}
