import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { GoblinGLBModel } from '../components/GoblinCharacterModel';
import { PlayerGLBModel } from '../components/PlayerCharacterModel';
import { OctopusGLBModel } from '../components/OctopusCharacterModel';
import { NemoClawGLBModel } from '../components/NemoClawCharacterModel';

interface CharacterPreviewProps {
  characterType: string;
  selected: boolean;
}

function Turntable({ selected, children }: { selected: boolean; children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (selected) groupRef.current.rotation.y += delta * 0.9;
  });

  return <group ref={groupRef}>{children}</group>;
}

function PreviewModel({ characterType }: { characterType: string }) {
  const moveSpeedRef = useRef(0);
  const isGroundedRef = useRef(true);
  const attackAnimRef = useRef(0);
  const noop = useMemo(() => () => {}, []);

  const commonProps = {
    moveSpeedRef,
    controllerHalfHeight: 0.9,
    isGroundedRef,
    activeEmote: null,
    activeEmoteId: 0,
    onEmoteComplete: noop,
    attackAnimRef,
  };

  switch (characterType) {
    case 'goblin':
      return <GoblinGLBModel {...commonProps} />;
    case 'octopus':
      return <OctopusGLBModel {...commonProps} />;
    case 'nemoclaw':
      return <NemoClawGLBModel {...commonProps} />;
    case 'soldier':
    default:
      return <PlayerGLBModel {...commonProps} />;
  }
}

export function CharacterPreview({ characterType, selected }: CharacterPreviewProps) {
  return (
    <div style={{ width: '100%', height: 170, position: 'relative' }}>
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        camera={{ position: [0, 1.35, 3.2], fov: 34 }}
        style={{ background: 'transparent' }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 4, 2]} intensity={1.1} />
        <directionalLight position={[-2, 2, -2]} intensity={0.35} />

        <Turntable selected={selected}>
          <group rotation={[0, Math.PI, 0]} position={[0, -0.3, 0]}>
            <PreviewModel characterType={characterType} />
          </group>
        </Turntable>
      </Canvas>
    </div>
  );
}
