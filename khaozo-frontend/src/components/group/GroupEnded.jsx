// "This group has ended" (late joiner / expired code) — shows what they picked if known
import { Link } from 'react-router';
import { ArrowRight, Check } from 'lucide-react';
import { buttonVariants } from '@/components/ui/Button.jsx';
import { formatTime } from '@/lib/format.js';

export function GroupEnded({ result, title = 'This group has ended', message }) {
  return (
    <div className="flex min-h-dvh flex-col justify-center bg-cream px-6 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <span className="flex size-[72px] items-center justify-center rounded-2xl border-2 border-ink bg-card shadow-hard">
          <Check className="size-9" strokeWidth={3} aria-hidden />
        </span>
        <h1 className="text-[32px] leading-none tracking-[-0.03em]">{title}</h1>
        <p className="text-[15px] font-bold text-body">
          {result ? `Closed at ${formatTime(result.endedAt)}. They picked:` : (message ?? 'The code is wrong, or the group finished a while ago.')}
        </p>
        {result && (
          <Link to={`/places/${result.placeId}`} className="press flex items-center justify-between rounded-2xl border-2 border-ink bg-card px-4 py-3 no-underline">
            <span>
              <span className="block font-display text-lg font-extrabold">{result.name}</span>
              <span className="text-[13px] font-bold text-body">{result.area}</span>
            </span>
            <ArrowRight className="size-5" strokeWidth={2.5} aria-hidden />
          </Link>
        )}
        <Link to="/groups" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
          Start a new group
        </Link>
      </div>
    </div>
  );
}
