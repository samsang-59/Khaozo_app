// 6 boxes for the group code (letters / digits). Paste fills them all.
import { useRef } from 'react';
import { cn } from '@/lib/cn.js';

export const CODE_LENGTH = 6;
const clean = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function JoinCodeInput({ value, onChange, onComplete }) {
  const refs = useRef([]);
  const chars = value.padEnd(CODE_LENGTH, ' ').slice(0, CODE_LENGTH).split('');

  const setAt = (i, ch) => {
    const next = (value.slice(0, i) + ch + value.slice(i + 1)).slice(0, CODE_LENGTH).replace(/\s/g, '');
    onChange(next);
    if (next.length === CODE_LENGTH) onComplete?.(next);
  };

  return (
    <div className="flex gap-1.5" role="group" aria-label="Group code">
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={c.trim()}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          aria-label={`Code character ${i + 1}`}
          maxLength={CODE_LENGTH}
          onChange={(e) => {
            const v = clean(e.target.value);
            if (v.length > 1) {
              const full = clean(value.slice(0, i) + v).slice(0, CODE_LENGTH);
              onChange(full);
              refs.current[Math.min(full.length, CODE_LENGTH - 1)]?.focus();
              if (full.length === CODE_LENGTH) onComplete?.(full);
              return;
            }
            setAt(i, v);
            if (v && i < CODE_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !c.trim() && i > 0) {
              refs.current[i - 1]?.focus();
              onChange(value.slice(0, i - 1));
            }
          }}
          className={cn(
            'h-[50px] w-full min-w-0 rounded-xl border-2 border-ink bg-card text-center font-display text-[22px] font-extrabold uppercase outline-none focus:border-saffron focus:shadow-hard-sm',
          )}
        />
      ))}
    </div>
  );
}
