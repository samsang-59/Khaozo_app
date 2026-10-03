// My Contributions: places I added (verified or not, confirmation progress), dishes I added
// (approved or waiting for review), reports (pending / accepted / rejected)
import { Link } from 'react-router';
import { Badge } from '@/components/ui/Badge.jsx';
import { formatDate } from '@/lib/format.js';

const REPORT_REASON = {
  closed: 'Permanently closed',
  not_found: "Couldn't find it",
  wrong_location: 'Wrong location',
  wrong_hours: 'Wrong hours',
  wrong_info: 'Wrong details',
  duplicate: 'Duplicate',
};

export function PlaceContribution({ place }) {
  const v = place.verification;
  return (
    <Link to={`/places/${place.id}`} className="flex flex-col gap-1.5 px-4 py-3 no-underline hover:bg-mixed">
      <span className="flex items-center justify-between gap-2">
        <span className="font-display text-base font-extrabold">{place.name}</span>
        {place.status === 'verified' ? <Badge tone="green">Verified</Badge> : place.status === 'closed' ? <Badge tone="ink">Closed</Badge> : <Badge tone="dashed">Unverified</Badge>}
      </span>
      {v ? (
        <span className="flex items-center gap-2 text-xs font-bold text-body">
          <span className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-card">
            <span className="block h-full bg-green" style={{ width: `${Math.min(100, (v.confirmations / v.threshold) * 100)}%` }} />
          </span>
          {Math.floor(v.confirmations)} / {v.threshold} confirmations
        </span>
      ) : (
        <span className="text-xs font-bold text-body">Added {formatDate(place.createdAt)}</span>
      )}
    </Link>
  );
}

export function DishContribution({ dish }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      <span>
        <span className="block font-display text-base font-extrabold">{dish.name}</span>
        <span className="text-xs font-bold text-body">Added {formatDate(dish.createdAt)}</span>
      </span>
      {dish.status === 'active' ? <Badge tone="green">Approved</Badge> : <Badge tone="amber">In review</Badge>}
    </div>
  );
}

export function ReportContribution({ report }) {
  const tone = report.status === 'accepted' ? 'green' : report.status === 'rejected' ? 'white' : 'amber';
  return (
    <Link to={`/places/${report.placeId}`} className="flex items-center justify-between gap-2 px-4 py-3 no-underline hover:bg-mixed">
      <span>
        <span className="block font-display text-base font-extrabold">{report.placeName}</span>
        <span className="text-xs font-bold text-body">
          {REPORT_REASON[report.reason]} · {formatDate(report.createdAt)}
        </span>
      </span>
      <Badge tone={tone}>{report.status}</Badge>
    </Link>
  );
}
