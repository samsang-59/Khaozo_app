// Search result row: thumb (phone 76px / laptop 180px column), place name, Match %, reason
// line (code template from the API) and MUST ORDER / MIXED REVIEWS tag.
import { Link } from 'react-router';
import { Photo } from '@/components/ui/Card.jsx';
import { LabelBadge, MatchBadge, Badge } from '@/components/ui/Badge.jsx';
import { cn } from '@/lib/cn.js';

export const resultHref = (item) => (item.menuItem ? `/menu-items/${item.menuItem.id}` : `/places/${item.place.id}`);

export default function ResultCard({ item, active, onHover, primary = true }) {
  const { place, menuItem, matchPct, reason } = item;
  return (
    <Link
      to={resultHref(item)}
      onMouseEnter={() => onHover?.(place.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(place.id)}
      className={cn(
        'press flex overflow-hidden rounded-[18px] border-2 border-ink bg-card no-underline transition-colors',
        primary && 'shadow-hard',
        active && 'bg-mixed',
      )}
    >
      <div className="p-3 lg:hidden">
        <Photo src={item.photoUrl} alt="" className="size-[64px] rounded-xl border-2 border-ink" label="Dish photo" />
      </div>
      {/* the photo fills the column at the card's height (it never makes the card taller) */}
      <Photo src={item.photoUrl} alt="" className="hidden w-[180px] shrink-0 border-r-2 border-ink lg:block [&>img]:absolute [&>img]:inset-0" label="Dish photo" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-3 pr-3 lg:px-5 lg:py-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[17px] leading-tight font-extrabold tracking-[-0.02em] lg:text-[22px]">{place.name}</h3>
          {matchPct != null && (
            <>
              <span className="shrink-0 rounded-md border-2 border-ink bg-amber px-1.5 font-display text-[11px] font-extrabold lg:hidden">{matchPct}%</span>
              <MatchBadge pct={matchPct} long className="hidden shrink-0 lg:inline-flex" />
            </>
          )}
        </div>
        <p className="text-[13px] leading-[1.45] font-medium text-body lg:text-sm">{reason}</p>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <LabelBadge label={menuItem?.stats?.label} />
          {item.likelyServes && <Badge tone="dashed">Not on the menu yet</Badge>}
          {place.status === 'unverified' && <Badge tone="dashed">Unverified</Badge>}
        </div>
      </div>
    </Link>
  );
}
