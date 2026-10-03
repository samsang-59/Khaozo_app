// 5 equal squares (52px, 56 laptop): filled = saffron, empty = white with a pale star
import { Star } from 'lucide-react';
import { cn } from '@/lib/cn.js';

export function StarPicker({ value, onChange, label = 'Overall', size = 'lg' }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            className={cn(
              'press flex items-center justify-center rounded-xl border-2 border-ink',
              size === 'lg' ? 'h-[52px] lg:h-14' : 'h-9 rounded-[10px]',
              on ? 'bg-saffron' : 'bg-card',
            )}
          >
            <Star className={cn(size === 'lg' ? 'size-6' : 'size-4', on ? 'fill-ink text-ink' : 'fill-star-empty text-star-empty')} strokeWidth={1.5} />
          </button>
        );
      })}
    </div>
  );
}

// Compact 1–5 score row (Taste / Portion / Value)
export function ScoreRow({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-[13px] font-bold">{label}</span>
      <div role="radiogroup" aria-label={label} className="grid flex-1 grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${label} ${n} of 5`}
            onClick={() => onChange(value === n ? null : n)}
            className={cn('press h-8 rounded-[10px] border-2 border-ink', value != null && n <= value ? 'bg-saffron' : 'bg-card')}
          />
        ))}
      </div>
    </div>
  );
}
