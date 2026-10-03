import { cn } from '@/lib/cn.js';

// Green when on (Settings "Public journal", "Also use my taste profile")
export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative h-[26px] w-[46px] shrink-0 rounded-full border-2 border-ink transition-colors duration-150', checked ? 'bg-green' : 'bg-card')}
    >
      <span
        className={cn(
          'absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full border-2 border-ink transition-all duration-150',
          checked ? 'left-[22px] bg-card' : 'left-[2px] bg-ink',
        )}
      />
    </button>
  );
}
