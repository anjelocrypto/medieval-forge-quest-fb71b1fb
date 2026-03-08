import { Canvas } from '@react-three/fiber';
import { Terrain } from './components/Terrain';
import { Water } from './components/Water';
import { Trees } from './components/Trees';
import { Rocks } from './components/Rocks';
import { POIs } from './components/POIs';
import { Player } from './components/Player';
import { Atmosphere } from './components/Atmosphere';
import { Sky } from './components/Sky';
import { SurvivalHUD } from './ui/SurvivalHUD';
import { useGameState } from './hooks/useGameState';

export function GameScene() {
  const {
    survival,
    updateSurvival,
    inventory,
    interactionText,
    setInteractionText,
  } = useGameState();

  return (
    <div className="w-screen h-screen bg-background overflow-hidden">
      <SurvivalHUD survival={survival} inventory={inventory} interactionText={interactionText} />
      <Canvas
        shadows
        camera={{ fov: 55, near: 0.5, far: 500, position: [0, 10, 15] }}
        style={{ width: '100%', height: '100%' }}
      >
        <Atmosphere />
        <Sky />
        <Terrain />
        <Water />
        <Trees />
        <Rocks />
        <POIs />
        <Player
          survival={survival}
          onSurvivalUpdate={updateSurvival}
          setInteractionText={setInteractionText}
        />
      </Canvas>
    </div>
  );
}
