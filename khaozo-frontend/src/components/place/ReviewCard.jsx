import { Badge } from '@/components/ui/Badge.jsx';
import { firstName, SPICE_LABEL, timeAgo, formatPrice } from '@/lib/format.js';

function Photos({ photos }) {
  if (!photos?.length) return null;
  return (
    <div className="flex gap-2 pt-1">
      {photos.slice(0, 3).map((p) => (
        <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block size-16 overflow-hidden rounded-xl border-2 border-ink">
          <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
        </a>
      ))}
    </div>
  );
}

// Anonymised authors (deleted accounts) come back without a name → "Former diner"
const author = (name) => (name ? firstName(name) : 'Former diner');

export function ReviewCard({ review }) {
  return (
    <article className="flex flex-col gap-1.5 rounded-2xl border-2 border-ink bg-card px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3 text-[13px] font-extrabold">
        <span>
          {author(review.userName)} · <span className="font-bold">{timeAgo(review.createdAt)}</span>
        </span>
        <span>{review.stars}★</span>
      </div>
      {review.reviewText && <p className="text-[13px] leading-relaxed font-medium text-body">{review.reviewText}</p>}
      <Photos photos={review.photos} />
    </article>
  );
}

export function RatingCard({ rating }) {
  return (
    <article className="flex flex-col gap-1.5 rounded-2xl border-2 border-ink bg-card px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3 text-[13px] font-extrabold">
        <span>
          {author(rating.userName)} · <span className="font-bold">{timeAgo(rating.createdAt)}</span>
        </span>
        <span>
          {rating.stars}★ · again {rating.wouldOrderAgain ? '✓' : '✗'}
        </span>
      </div>
      {rating.reviewText && <p className="text-[13px] leading-relaxed font-medium text-body">{rating.reviewText}</p>}
      {(rating.spice || rating.pricePaid) && (
        <div className="flex flex-wrap gap-1.5">
          {rating.spice && <Badge tone="outline">{SPICE_LABEL[rating.spice]}</Badge>}
          {rating.pricePaid && <Badge tone="outline">Paid {formatPrice(rating.pricePaid)}</Badge>}
        </div>
      )}
      <Photos photos={rating.photos} />
    </article>
  );
}
