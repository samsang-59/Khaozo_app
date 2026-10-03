// Best for dish `/dishes/:id` — "BEST IN BHUBANESWAR" + dish name, sort chips
// (Best rated · Nearest · Open now · Under ₹250), ranked cards (#1 gets the shadow), Load more.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { bestForDish } from '@/api/dishes.api.js';
import { listPlaces } from '@/api/places.api.js';
import { useUserLocation } from '@/context/LocationContext.jsx';
import { BackButton, SaffronHeader } from '@/components/layout/PageHeader.jsx';
import { Chip, ChipRow } from '@/components/ui/Chip.jsx';
import { Photo } from '@/components/ui/Card.jsx';
import { LabelBadge } from '@/components/ui/Badge.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { RowSkeleton } from '@/components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '@/components/shared/States.jsx';
import NotFoundPage from './NotFoundPage.jsx';
import { formatDistance, formatPrice, formatStars, joinMeta } from '@/lib/format.js';
import { cn } from '@/lib/cn.js';

const SORTS = [
  { value: 'best', label: 'Best rated' },
  { value: 'near', label: 'Nearest' },
  { value: 'open', label: 'Open now' },
  { value: 'cheap', label: 'Under ₹250' },
];

function RankCard({ rank, row }) {
  const s = row.stats;
  return (
    <Link
      to={`/menu-items/${row.menuItem.id}`}
      className={cn('press flex items-center gap-4 rounded-[18px] border-2 border-ink bg-card px-4 py-3 no-underline lg:gap-6 lg:px-6 lg:py-4', rank === 1 && 'shadow-hard')}
    >
      <span className="w-8 shrink-0 text-center font-display text-4xl leading-none font-extrabold tracking-[-0.04em] lg:w-12 lg:text-[52px]">{rank}</span>
      <Photo className="hidden size-[88px] shrink-0 rounded-xl border-2 border-ink lg:block" label="Dish photo" />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-display text-[17px] leading-tight font-extrabold tracking-[-0.01em] lg:text-[22px]">
          {row.place.name}
          {row.place.area && <span className="font-bold text-body">, {row.place.area}</span>}
        </span>
        <span className="text-[13px] font-bold text-body lg:text-sm">
          {joinMeta(
            s.ratingCount ? `${formatStars(s.avgStars)} (${s.ratingCount})` : 'No ratings',
            s.orderAgainPct != null ? `${Math.round(s.orderAgainPct)}% again` : null,
            formatPrice(row.menuItem.price),
            formatDistance(row.distanceM),
          )}
        </span>
        <span className="hidden lg:block">
          <LabelBadge label={s.label} />
        </span>
      </span>
    </Link>
  );
}

export default function BestForDishPage() {
  const { id } = useParams();
  const { centre } = useUserLocation();
  const [sort, setSort] = useState('best');

  const q = useInfiniteQuery({
    queryKey: ['best', id, centre],
    queryFn: ({ pageParam }) => bestForDish(id, { ...(centre ?? {}), limit: 20, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  // "Open now" needs opening status, which the ranking doesn't carry → nearby open places
  const openQ = useQuery({
    queryKey: ['places', 'openIds', centre],
    queryFn: () => listPlaces({ ...centre, radius: 20000, openNow: true, limit: 50 }),
    enabled: sort === 'open' && !!centre,
  });

  const dish = q.data?.pages[0]?.dish;
  const rows = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const shown = useMemo(() => {
    if (sort === 'near') return [...rows].sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
    if (sort === 'cheap') return rows.filter((r) => r.menuItem.price != null && r.menuItem.price <= 250);
    if (sort === 'open') {
      const open = new Set((openQ.data?.items ?? []).map((p) => p.id));
      return rows.filter((r) => open.has(r.place.id));
    }
    return rows;
  }, [rows, sort, openQ.data]);
  const totalRatings = rows.reduce((n, r) => n + (r.stats.ratingCount ?? 0), 0);

  useEffect(() => {
    if (dish) document.title = `Best ${dish.name} in Bhubaneswar — Khaozo`;
  }, [dish]);

  if (q.isError && q.error?.status === 404) return <NotFoundPage message="We don't know this dish." />;

  return (
    <div>
      <SaffronHeader>
        <div className="mx-auto flex max-w-[1180px] flex-col gap-2.5 px-5 pt-5 pb-6 lg:px-12 lg:pt-12 lg:pb-10">
          <BackButton fallback="/" className="mb-1 bg-cream lg:hidden" />
          <p className="font-display text-xs font-extrabold tracking-[0.08em] uppercase lg:text-sm">Best in Bhubaneswar</p>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <h1 className="text-[34px] leading-none tracking-[-0.03em] lg:text-[60px] lg:tracking-[-0.04em]">{dish?.name ?? '…'}</h1>
            {rows.length > 0 && (
              <p className="text-[13px] font-bold lg:pb-2 lg:text-[15px]">
                Ranked by diners · {rows.length} place{rows.length === 1 ? '' : 's'} · {totalRatings.toLocaleString('en-IN')} ratings
              </p>
            )}
          </div>
        </div>
      </SaffronHeader>

      <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-5 pt-5 pb-8 lg:px-12 lg:pt-7">
        <ChipRow>
          {SORTS.filter((s2) => s2.value !== 'near' || centre).map((s2) => (
            <Chip key={s2.value} selected={sort === s2.value} onClick={() => setSort(s2.value)}>
              {s2.label}
            </Chip>
          ))}
        </ChipRow>
        {q.isPending ? (
          <RowSkeleton count={4} />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState
            title={rows.length ? 'Nothing matches this filter' : 'No ratings for this dish yet'}
            message={rows.length ? 'Try another sort.' : 'Had it somewhere good? Rate it and put that place on the map.'}
          />
        ) : (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
            {shown.map((row, i) => (
              <RankCard key={row.menuItem.id} rank={i + 1} row={row} />
            ))}
          </div>
        )}
        {q.hasNextPage && (
          <Button block onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage}>
            Load more
          </Button>
        )}
      </div>
    </div>
  );
}
