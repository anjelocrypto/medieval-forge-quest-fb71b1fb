import { useState, useEffect } from 'react';
import { useCharacter, CharacterType } from '../context/CharacterContext';
import { CharacterPreview } from './CharacterPreview';

const CHARACTERS: { type: CharacterType; name: string; desc: string }[] = [
  { type: 'goblin', name: 'Goblin', desc: 'Small & scrappy fighter' },
  { type: 'soldier', name: 'Soldier', desc: 'Armored human warrior' },
  { type: 'octopus', name: 'Octopus', desc: 'Tentacled sea creature' },
  { type: 'nemoclaw', name: 'NemoClaw', desc: 'Fierce dual-claw beast' },
  { type: 'chillhouse', name: 'Chillhouse', desc: 'Cool & relaxed brawler' },
];

export function CharacterSelect() {
  const { character, setCharacter } = useCharacter();
  const [open, setOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'F4') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={() => setOpen(false)}
    >
      <div
        className="rounded-2xl p-8 max-w-2xl w-full mx-4"
        style={{
          background: 'linear-gradient(160deg, hsla(0,0%,6%,0.97), hsla(0,0%,10%,0.97))',
          border: '1px solid hsla(40,30%,35%,0.5)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8), inset 0 1px 0 hsla(40,30%,50%,0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold tracking-wide" style={{ color: 'hsl(40,50%,88%)' }}>
            SELECT YOUR CHAMPION
          </h2>
          <p className="text-xs mt-1" style={{ color: 'hsl(40,15%,45%)' }}>
            Press Tab to toggle · Click to select
          </p>
        </div>

        {/* Character Grid */}
        <div className="grid grid-cols-5 gap-3">
          {CHARACTERS.map((c, idx) => {
            const selected = character === c.type;
            const hovered = hoveredIdx === idx;
            return (
              <button
                key={c.type}
                onClick={() => { setCharacter(c.type); setOpen(false); }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="rounded-xl overflow-hidden text-center transition-all duration-200"
                style={{
                  background: selected
                    ? 'linear-gradient(180deg, hsla(40,50%,25%,0.5), hsla(40,40%,12%,0.6))'
                    : hovered
                      ? 'hsla(0,0%,18%,0.8)'
                      : 'hsla(0,0%,12%,0.6)',
                  border: selected
                    ? '2px solid hsl(40,65%,55%)'
                    : '2px solid hsla(0,0%,25%,0.3)',
                  cursor: 'pointer',
                  transform: (selected || hovered) ? 'translateY(-4px)' : 'none',
                  boxShadow: selected
                    ? '0 8px 30px hsla(40,60%,40%,0.3), 0 0 20px hsla(40,60%,50%,0.15)'
                    : hovered
                      ? '0 6px 20px rgba(0,0,0,0.4)'
                      : 'none',
                }}
              >
                {/* 3D Preview */}
                <CharacterPreview characterType={c.type} selected={selected} />

                {/* Info */}
                <div className="px-3 pb-3 pt-1">
                  <div
                    className="font-bold text-sm tracking-wide"
                    style={{ color: selected ? 'hsl(40,70%,80%)' : 'hsl(0,0%,75%)' }}
                  >
                    {c.name}
                  </div>
                  <div className="text-[10px] mt-0.5 leading-tight" style={{ color: 'hsl(0,0%,45%)' }}>
                    {c.desc}
                  </div>
                  {selected && (
                    <div
                      className="text-[10px] mt-2 font-bold uppercase tracking-widest"
                      style={{ color: 'hsl(120,50%,60%)' }}
                    >
                      ✓ Active
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
