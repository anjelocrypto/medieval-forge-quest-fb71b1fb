import { useState, useCallback, useRef } from 'react';
import { SurvivalState, ResourceInventory, GameMode } from '../types';
import { MAX_HEALTH, MAX_STAMINA, MAX_HUNGER, MAX_TEMPERATURE } from '../constants';
import { PlacedStructure, BUILDABLES } from '../systems/BuildingData';

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
  const [buildMode, setBuildMode] = useState(false);
  const [selectedBuildIndex, setSelectedBuildIndex] = useState(0);
  const [structures, setStructures] = useState<PlacedStructure[]>([]);
  const [buildFeedback, setBuildFeedback] = useState<string | null>(null);
  const [damageFlash, setDamageFlash] = useState(0);

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

  const applyPlayerDamage = useCallback((amount: number) => {
    setSurvival(prev => ({
      ...prev,
      health: Math.max(0, prev.health - amount),
    }));
    setDamageFlash(1);
    setTimeout(() => setDamageFlash(0), 200);
  }, []);

  const toggleBuildMode = useCallback(() => {
    setBuildMode(prev => !prev);
    setBuildFeedback(null);
  }, []);

  const cycleBuild = useCallback((dir: number) => {
    setSelectedBuildIndex(prev => {
      const next = prev + dir;
      if (next < 0) return BUILDABLES.length - 1;
      if (next >= BUILDABLES.length) return 0;
      return next;
    });
  }, []);

  const placeStructure = useCallback((structure: PlacedStructure) => {
    const config = BUILDABLES.find(b => b.type === structure.type);
    if (!config) return;
    // Deduct resources
    setInventory(prev => {
      const next = { ...prev };
      for (const [key, val] of Object.entries(config.cost)) {
        next[key as keyof ResourceInventory] -= val || 0;
      }
      return next;
    });
    setStructures(prev => [...prev, structure]);
  }, []);

  return {
    survival, updateSurvival,
    inventory, addResource,
    interactionText, setInteractionText,
    gameMode, setGameMode,
    buildMode, toggleBuildMode,
    selectedBuildIndex, cycleBuild,
    structures, placeStructure,
    buildFeedback, setBuildFeedback,
    damageFlash, applyPlayerDamage,
  };
}
