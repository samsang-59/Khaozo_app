// Winner: full saffron — "YOU'RE EATING AT", place, Open in Maps (plain link), Share, View place
import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { buttonVariants, Button } from '@/components/ui/Button.jsx';
import { Photo } from '@/components/ui/Card.jsx';
import { shareLink } from '@/components/shared/ShareButton.jsx';
import { mapsLink } from '@/lib/format.js';

export function WinnerCard({ result, code, votesTotal, members, savedToHistory }) {
  const share = () => shareLink({ url: `${window.location.origin}/places/${result.placeId}`, title: result.name, text: `We're eating at ${result.name}! (picked on Khaozo)` });
  return (
    <div className="flex min-h-dvh flex-col bg-saffron px-6 pt-8 pb-[max(24px,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4">
        <p className="font-display text-xs font-extrabold tracking-[0.08em] uppercase">
          Group {code} · {votesTotal} of {members} votes
        </p>
        <span className="sticker-label w-fit rounded-md bg-ink px-2.5 py-1 text-[15px] text-cream">You're eating at</span>
        <h1 className="text-[44px] leading-[0.95] tracking-[-0.04em]">{result.name}</h1>
        <div className="overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-hard">
          <Photo className="h-[140px] border-b-2 border-ink" label="Place photo" />
          <p className="px-4 py-3 text-[13px] font-bold">
            {result.area}
            {result.decidedBy === 'tie_break' && ' · tie broken by best match'}
            {result.decidedBy === 'creator' && ' · picked by the host'}
          </p>
        </div>
        <div className="mt-auto flex flex-col gap-2.5 pt-4">
          <a href={mapsLink(result.location, result.name)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'dark', size: 'lg', className: 'shadow-hard-cream' })}>
            Open in Maps <ArrowUpRight className="size-4" aria-hidden />
          </a>
          <div className="flex gap-2.5">
            <Button size="lg" variant="cream" className="flex-1" onClick={share}>
              Share result
            </Button>
            <Link to={`/places/${result.placeId}`} className={buttonVariants({ size: 'lg', variant: 'cream', className: 'flex-1' })}>
              View place
            </Link>
          </div>
          {savedToHistory && <p className="text-center text-xs font-extrabold">Saved to your past groups</p>}
        </div>
      </div>
    </div>
  );
}
