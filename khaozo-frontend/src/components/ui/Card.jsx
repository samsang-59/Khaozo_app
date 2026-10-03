import { cn } from '@/lib/cn.js';

// White, 2px ink border; primary cards get the hard shadow
export function Card({ className, primary = false, as: Tag = 'div', children, ...props }) {
  return (
    <Tag className={cn('rounded-2xl border-2 border-ink bg-card', primary && 'shadow-hard', className)} {...props}>
      {children}
    </Tag>
  );
}

// Stacked rows in one bordered card, separated by 2px ink lines
export function ListCard({ className, children, primary = false }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border-2 border-ink bg-card [&>*+*]:border-t-2 [&>*+*]:border-ink', primary && 'shadow-hard', className)}>
      {children}
    </div>
  );
}

export function Photo({ src, alt = '', className, children, label }) {
  return (
    <div className={cn('relative overflow-hidden', !src && 'stripes', className)}>
      {src ? <img src={src} alt={alt} loading="lazy" className="size-full object-cover" /> : label ? <span className="sr-only">{label}</span> : null}
      {children}
    </div>
  );
}
