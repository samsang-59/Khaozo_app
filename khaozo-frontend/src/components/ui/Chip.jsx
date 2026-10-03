import { X } from 'lucide-react';
import { cn } from '@/lib/cn.js';

// 2px border, radius 10. Selected = ink bg + cream text.
export function Chip({ selected, onClick, removable, className, children, size = 'md', as: Tag = 'button', ...props }) {
  return (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={Tag === 'button' && onClick ? !!selected : undefined}
      className={cn(
        'press inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border-2 border-ink font-bold whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-[13px] py-[6px] text-[13px]',
        selected ? 'bg-ink text-cream' : 'bg-card text-ink',
        className,
      )}
      {...props}
    >
      {children}
      {removable && <X className="size-3.5" strokeWidth={3} aria-hidden />}
    </Tag>
  );
}

export function ChipRow({ className, children, wrap = false }) {
  return (
    <div className={cn('flex gap-2', wrap ? 'flex-wrap' : 'no-scrollbar -mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0', className)}>
      {children}
    </div>
  );
}
