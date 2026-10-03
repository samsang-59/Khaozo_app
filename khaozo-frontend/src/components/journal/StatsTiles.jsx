// My Stats: counts, top cuisine, favourite dish, same dish compared across places
import { Link } from 'react-router';
import { StatStrip } from '@/components/shared/StatStrip.jsx';

export function StatsTiles({ stats, linkDishes = true }) {
  if (!stats) return null;
  return (
    <div className="flex flex-col gap-4">
      <StatStrip
        primary
        items={[
          { value: stats.dishesTried, label: 'dishes tried' },
          { value: stats.placesTried, label: 'places' },
          { value: stats.ratingsCount, label: 'ratings' },
          { value: stats.reviewsCount, label: 'reviews' },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-ink bg-card p-4">
          <p className="field-label">Top cuisine</p>
          <p className="pt-1 font-display text-2xl font-extrabold tracking-[-0.02em]">{stats.topCuisine?.name ?? '–'}</p>
          {stats.topCuisine && <p className="text-xs font-bold text-body">{stats.topCuisine.count} dishes rated</p>}
        </div>
        <div className="rounded-2xl border-2 border-ink bg-amber p-4">
          <p className="field-label">Favourite dish</p>
          {stats.favouriteDish ? (
            <>
              {linkDishes ? (
                <Link to={`/menu-items/${stats.favouriteDish.menuItemId}`} className="block pt-1 font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] no-underline">
                  {stats.favouriteDish.name}
                </Link>
              ) : (
                <p className="pt-1 font-display text-2xl leading-tight font-extrabold tracking-[-0.02em]">{stats.favouriteDish.name}</p>
              )}
              <p className="text-xs font-bold">
                {stats.favouriteDish.placeName} · {stats.favouriteDish.avgStars}★
              </p>
            </>
          ) : (
            <p className="pt-1 font-display text-2xl font-extrabold">–</p>
          )}
        </div>
      </div>
      {stats.comparisons?.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="field-label">Same dish, different places</p>
          {stats.comparisons.map((c) => (
            <div key={c.dish} className="rounded-2xl border-2 border-ink bg-card px-4 py-3">
              <p className="font-display text-base font-extrabold">{c.dish}</p>
              <ul className="pt-1">
                {c.places.map((p) => (
                  <li key={p.placeId} className="flex justify-between text-[13px] font-bold">
                    <Link to={`/places/${p.placeId}`} className="no-underline hover:underline">
                      {p.placeName}
                    </Link>
                    <span>{p.stars}★</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
