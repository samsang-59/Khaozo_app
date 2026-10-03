// Taste field as tappable segments (spice 4, sweet 3, oiliness 3, budget 4). Tapping a level
// saves it and locks the field (🔒 = set by you; learning from ratings won't change it).
import { Lock } from 'lucide-react';
import { cn } from '@/lib/cn.js';

export function TasteSlider({ label, value, max, labels, locked, onChange, tone = 'saffron', disabled }) {
  const level = value == null ? 0 : Math.round(value);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 text-[13px] font-extrabold">
        <span className="flex items-center gap-1.5">
          {label}
          {locked && <Lock className="size-3.5" strokeWidth={2.5} aria-label="Set by you" />}
        </span>
        <span>{value == null ? 'Not set' : labels[level - 1]}</span>
      </div>
      <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
        {Array.from({ length: max }, (_, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={level === i + 1}
            aria-label={`${label}: ${labels[i]}`}
            disabled={disabled}
            onClick={() => onChange(i + 1)}
            className={cn('press h-[18px] flex-1 rounded-[5px] border-2 border-ink', i < level ? (tone === 'ink' ? 'bg-ink' : 'bg-saffron') : 'bg-card')}
          />
        ))}
      </div>
    </div>
  );
}
