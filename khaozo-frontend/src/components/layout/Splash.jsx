import { Skeleton } from '@/components/ui/Skeleton.jsx';

export function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-saffron" role="status" aria-label="Loading Khaozo">
      <span className="font-display text-4xl font-extrabold tracking-[-0.04em]">khaozo</span>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 pt-8" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton alt className="h-4 w-1/2" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton alt className="h-36 w-full rounded-2xl" />
    </div>
  );
}
