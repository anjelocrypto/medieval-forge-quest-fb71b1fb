import { useState, useCallback } from 'react';
import { SurvivalState, ResourceInventory, GameMode } from '../types';
import { MAX_HEALTH, MAX_STAMINA, MAX_HUNGER, MAX_TEMPERATURE } from '../constants';

export function useGameState() {
  const [survival, setSurvival] = useState<SurvivalState>({
    health: MAX_HEALTH,
    stamina: MAX_STAMINA,
    hunger: MAX_HUNGER * 0.8,
    temperature: MAX_TEMPERATURE * 0.7,
  });

  const [inventory, setInventory] = useState<ResourceInventory>({
    wood: 0,
    stone: 0,
    food: 0,
  });

  const [gameMode, setGameMode] = useState<GameMode>('explore');
  const [interactionText, setInteractionText] = useState<string | null>(null);

  const updateSurvival = useCallback((updates: Partial<SurvivalState>) => {
    setSurvival(prev => ({
      health: Math.max(0, Math.min(MAX_HEALTH, updates.health ?? prev.health)),
      stamina: Math.max(0, Math.min(MAX_STAMINA, updates.stamina ?? prev.stamina)),
      hunger: Math.max(0, Math.min(MAX_HUNGER, updates.hunger ?? prev.hunger)),
      temperature: Math.max(0, Math.min(MAX_TEMPERATURE, updates.temperature ?? prev.temperature)),
    }));
  }, []);

  const addResource = useCallback((type: keyof ResourceInventory, amount: number) => {
    setInventory(prev => ({ ...prev, [type]: prev[type] + amount }));
  }, []);

  return {
    survival,
    updateSurvival,
    inventory,
    addResource,
    gameMode,
    setGameMode,
    interactionText,
    setInteractionText,
  };
}
