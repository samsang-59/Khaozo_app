import { cn } from '@/lib/cn.js';

// Grid of 3–4 cells in one bordered card, divided by 2px ink: big number + small label
export function StatStrip({ items, className, primary = false, tone = 'white' }) {
  return (
    <div
      className={cn(
        'grid overflow-hidden rounded-2xl border-2 border-ink [&>*+*]:border-l-2 [&>*+*]:border-ink',
        tone === 'cream' ? 'bg-cream' : 'bg-card',
        primary && 'shadow-hard',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it) => (
        <div key={it.label} className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5 lg:px-4 lg:py-3.5">
          <span className="truncate font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em] lg:text-[30px]">{it.value ?? '–'}</span>
          <span className="truncate text-[11px] font-bold text-body lg:text-xs">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
