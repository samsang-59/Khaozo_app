import { cn } from '@/lib/cn.js';

// Row of bordered segments, filled saffron (spice) or ink (oiliness / budget)
export function LevelBars({ level, max, tone = 'saffron', className, label }) {
  return (
    <div className={cn('flex gap-1.5', className)} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={level ?? 0}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={cn('h-3 flex-1 rounded-[4px] border-2 border-ink', i < (level ?? 0) ? (tone === 'ink' ? 'bg-ink' : 'bg-saffron') : 'bg-card')}
        />
      ))}
    </div>
  );
}
