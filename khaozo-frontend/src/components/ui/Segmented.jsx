import { cn } from '@/lib/cn.js';

// List / Map, Recent / With photos, Same every day / Different by day
export function Segmented({ options, value, onChange, className, size = 'sm', block = false, label }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex overflow-hidden rounded-[10px] border-2 border-ink bg-card', block && 'flex w-full', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'font-extrabold transition-colors duration-100',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-2 text-[13px]',
              block && 'flex-1',
              active ? 'bg-ink text-cream' : 'bg-card text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
