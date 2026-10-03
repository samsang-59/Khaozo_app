import { cn } from '@/lib/cn.js';

export function SectionTitle({ children, right, className, as: Tag = 'h2' }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', className)}>
      <Tag className="text-xl tracking-[-0.02em] lg:text-[24px]">{children}</Tag>
      {right}
    </div>
  );
}
