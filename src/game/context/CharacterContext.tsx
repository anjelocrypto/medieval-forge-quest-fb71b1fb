import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type CharacterType = 'soldier' | 'goblin' | 'octopus' | 'nemoclaw';

interface CharacterContextValue {
  character: CharacterType;
  setCharacter: (c: CharacterType) => void;
}

const CharacterContext = createContext<CharacterContextValue>({
  character: 'goblin',
  setCharacter: () => {},
});

export function CharacterProvider({ children }: { children: ReactNode }) {
  const [character, setCharacterState] = useState<CharacterType>(() => {
    const saved = localStorage.getItem('selected-character');
    if (saved === 'soldier') return 'soldier';
    if (saved === 'octopus') return 'octopus';
    return 'goblin';
  });

  const setCharacter = useCallback((c: CharacterType) => {
    setCharacterState(c);
    localStorage.setItem('selected-character', c);
  }, []);

  return (
    <CharacterContext.Provider value={{ character, setCharacter }}>
      {children}
    </CharacterContext.Provider>
  );
}

export function useCharacter() {
  return useContext(CharacterContext);
}
