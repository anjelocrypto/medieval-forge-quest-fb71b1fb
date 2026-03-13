import { useState, useEffect } from 'react';
import { useCharacter, CharacterType } from '../context/CharacterContext';

const CHARACTERS: { type: CharacterType; name: string; icon: string; desc: string }[] = [
  { type: 'goblin', name: 'Goblin', icon: '👺', desc: 'Small & scrappy with unique animations' },
  { type: 'soldier', name: 'Soldier', icon: '⚔️', desc: 'Human warrior with full emotes & combat' },
  { type: 'octopus', name: 'Octopus', icon: '🐙', desc: 'Tentacled sea creature with dance moves' },
];

export function CharacterSelect() {
  const { character, setCharacter } = useCharacter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => setOpen(false)}>
      <div className="rounded-xl p-6 max-w-md w-full mx-4"
        style={{
          background: 'linear-gradient(135deg, hsla(0,0%,8%,0.95), hsla(0,0%,12%,0.95))',
          border: '1px solid hsla(40,30%,45%,0.4)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1" style={{ color: 'hsl(40,40%,85%)' }}>
          Choose Character
        </h2>
        <p className="text-xs mb-4" style={{ color: 'hsl(40,20%,55%)' }}>
          Press Tab to toggle · Changes apply immediately
        </p>
        <div className="flex gap-3">
          {CHARACTERS.map(c => {
            const selected = character === c.type;
            return (
              <button
                key={c.type}
                onClick={() => { setCharacter(c.type); setOpen(false); }}
                className="flex-1 rounded-lg p-4 text-left transition-all"
                style={{
                  background: selected
                    ? 'linear-gradient(135deg, hsla(40,50%,30%,0.5), hsla(40,40%,20%,0.5))'
                    : 'hsla(0,0%,15%,0.6)',
                  border: selected
                    ? '2px solid hsl(40,60%,55%)'
                    : '2px solid hsla(0,0%,30%,0.3)',
                  cursor: 'pointer',
                }}>
                <div className="text-3xl mb-2">{c.icon}</div>
                <div className="font-bold text-sm" style={{ color: selected ? 'hsl(40,60%,80%)' : 'hsl(0,0%,70%)' }}>
                  {c.name}
                </div>
                <div className="text-xs mt-1" style={{ color: 'hsl(0,0%,50%)' }}>
                  {c.desc}
                </div>
                {selected && (
                  <div className="text-xs mt-2 font-bold" style={{ color: 'hsl(120,50%,60%)' }}>
                    ✓ Selected
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
