import { cn } from '@/lib/cn.js';

export function Skeleton({ className, alt = false }) {
  return <div aria-hidden className={cn('animate-pulse rounded-lg', alt ? 'bg-skeleton-2' : 'bg-skeleton', className)} />;
}

// Result-row skeleton (Search loading state)
export function RowSkeleton({ count = 3 }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-3 rounded-[18px] border-2 border-transparent p-1">
          <Skeleton className="size-16 shrink-0 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton alt className="h-3 w-11/12" />
            <Skeleton alt className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
