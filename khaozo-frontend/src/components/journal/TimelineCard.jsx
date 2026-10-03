// One journal card = one visit (same place, entries ≤ 3 h apart). Each dish rating is a row
// with stars + AGAIN ✓ / ✗; a place review shows as "Place review".
import { Link } from 'react-router';
import { Photo } from '@/components/ui/Card.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { formatDate } from '@/lib/format.js';
import { cn } from '@/lib/cn.js';

export function TimelineCard({ card, primary = false }) {
  const photo = card.entries.flatMap((e) => e.photos ?? [])[0]?.url;
  return (
    <article className={cn('flex gap-3.5 rounded-2xl border-2 border-ink bg-card p-3', primary && 'shadow-hard')}>
      <Photo src={photo} alt="" label="Dish photo" className="size-[68px] shrink-0 rounded-xl border-2 border-ink lg:size-[76px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {card.entries.map((e) => (
          <div key={`${e.kind}-${e.id}`} className="flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              {e.kind === 'rating' && e.menuItemId ? (
                <Link to={`/menu-items/${e.menuItemId}`} className="font-display text-base leading-tight font-extrabold tracking-[-0.01em] no-underline">
                  {e.menuItemName}
                </Link>
              ) : (
                <span className="font-display text-base leading-tight font-extrabold tracking-[-0.01em]">Place review</span>
              )}
              <span className="shrink-0 font-display text-base font-extrabold">{e.stars}★</span>
            </div>
            {e.kind === 'rating' && e.wouldOrderAgain != null && (
              <span>{e.wouldOrderAgain ? <Badge tone="green">Again ✓</Badge> : <Badge tone="white">Again ✗</Badge>}</span>
            )}
            {e.reviewText && <p className="line-clamp-2 text-xs font-medium text-body">{e.reviewText}</p>}
          </div>
        ))}
        <p className="text-[13px] font-bold text-body">
          <Link to={`/places/${card.place.id}`} className="no-underline hover:underline">
            {card.place.name}
          </Link>{' '}
          · {formatDate(card.startedAt)}
        </p>
      </div>
    </article>
  );
}

// Cards grouped under "SEPTEMBER 2026" month labels
export function groupByMonth(cards) {
  const groups = [];
  for (const c of cards) {
    const label = formatDate(c.startedAt, { month: 'long', year: 'numeric' }).toUpperCase();
    const last = groups.at(-1);
    if (last?.label === label) last.cards.push(c);
    else groups.push({ label, cards: [c] });
  }
  return groups;
}
