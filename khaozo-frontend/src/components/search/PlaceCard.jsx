// Home card: 120px photo, place name, meta line. Primary cards get the hard shadow.
import { Link } from 'react-router';
import { Photo } from '@/components/ui/Card.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { formatDistance, joinMeta, openingText, PLACE_TYPE_LABEL, priceLevel } from '@/lib/format.js';
import { cn } from '@/lib/cn.js';

export const placeMeta = (p) =>
  joinMeta(p.cuisines?.slice(0, 2).join(', ') || PLACE_TYPE_LABEL[p.placeType], priceLevel(p.priceLevel), formatDistance(p.distanceM), openingText(p.opening));

export default function PlaceCard({ place, className, onHover, active }) {
  return (
    <Link
      to={`/places/${place.id}`}
      onMouseEnter={() => onHover?.(place.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn('press flex flex-col overflow-hidden rounded-[18px] border-2 border-ink bg-card no-underline shadow-hard', active && 'bg-mixed', className)}
    >
      <Photo className="h-[120px] border-b-2 border-ink" label="Place photo">
        {place.status === 'unverified' && (
          <span className="absolute top-2.5 right-2.5">
            <Badge tone="dashed">Unverified</Badge>
          </span>
        )}
      </Photo>
      <div className="flex flex-col gap-1.5 px-3.5 pt-3 pb-3.5">
        <h3 className="font-display text-lg leading-tight font-extrabold tracking-[-0.02em]">{place.name}</h3>
        <p className="text-[13px] leading-[1.45] font-medium text-body">{placeMeta(place)}</p>
      </div>
    </Link>
  );
}
