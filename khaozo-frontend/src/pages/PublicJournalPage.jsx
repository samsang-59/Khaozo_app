// Public journal `/u/:id` (shared link, logged-out view) — "SOURAV'S FOOD JOURNAL", N dishes,
// top 3, timeline, all-time stats, "Start your own food journal". Private → explains + Open Khaozo.
import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getPublicJournal } from '@/api/journal.api.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { SaffronHeader } from '@/components/layout/PageHeader.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Button, buttonVariants } from '@/components/ui/Button.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { SectionTitle } from '@/components/shared/SectionTitle.jsx';
import { ErrorState } from '@/components/shared/States.jsx';
import { TimelineCard } from '@/components/journal/TimelineCard.jsx';
import { StatsTiles } from '@/components/journal/StatsTiles.jsx';
import NotFoundPage from './NotFoundPage.jsx';
import { firstName } from '@/lib/format.js';
import { cn } from '@/lib/cn.js';

// Their best-rated dishes (latest rating of each dish, highest stars first)
const topDishes = (cards, n = 3) => {
  const seen = new Map();
  for (const c of cards) {
    for (const e of c.entries) {
      if (e.kind !== 'rating' || !e.menuItemId || seen.has(e.menuItemId)) continue;
      seen.set(e.menuItemId, { ...e, placeName: c.place.name });
    }
  }
  return [...seen.values()].sort((a, b) => b.stars - a.stars).slice(0, n);
};

export default function PublicJournalPage() {
  const { id } = useParams();
  const { user, openLogin } = useAuth();
  const q = useInfiniteQuery({
    queryKey: ['publicJournal', id],
    queryFn: ({ pageParam }) => getPublicJournal(id, { limit: 20, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.timeline.nextCursor ?? undefined,
  });

  const first = q.data?.pages[0];
  const cards = useMemo(() => q.data?.pages.flatMap((p) => p.timeline.items) ?? [], [q.data]);
  const top = useMemo(() => topDishes(cards), [cards]);
  const owner = first?.user;

  useEffect(() => {
    document.title = owner ? `${owner.name}'s food journal — Khaozo` : 'Food journal — Khaozo';
  }, [owner]);

  if (q.isError && q.error?.code === 'JOURNAL_PRIVATE') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream px-5">
        <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border-2 border-ink bg-card p-6 shadow-hard">
          <h1 className="text-[26px] leading-tight tracking-[-0.02em]">This journal is private</h1>
          <p className="text-sm font-medium text-body">The owner turned off sharing. Explore the best dishes near you instead.</p>
          <Link to="/" className={buttonVariants({ variant: 'primary', className: 'w-fit' })}>
            Open Khaozo
          </Link>
        </div>
      </div>
    );
  }
  if (q.isError && q.error?.status === 404) return <NotFoundPage message="This journal doesn't exist." />;
  if (q.isError) {
    return (
      <div className="px-5 pt-10">
        <ErrorState onRetry={() => q.refetch()} />
      </div>
    );
  }

  const stats = first?.stats;
  const name = owner ? firstName(owner.name) : '';
  return (
    <div className="min-h-dvh bg-cream">
      <SaffronHeader>
        <div className="mx-auto flex max-w-[860px] flex-col gap-3 px-5 pt-6 pb-6 lg:pt-10 lg:pb-10">
          <div className="flex items-center justify-between">
            <Link to="/" className="font-display text-[22px] font-extrabold tracking-[-0.03em] no-underline">
              khaozo
            </Link>
            <Link to="/" className="press rounded-[10px] bg-ink px-3 py-1.5 text-[13px] font-extrabold text-cream no-underline">
              Get the app
            </Link>
          </div>
          {!first ? (
            <Skeleton className="h-20 bg-amber/60" />
          ) : (
            <>
              <p className="pt-2 font-display text-xs font-extrabold tracking-[0.08em] uppercase">{name}'s food journal</p>
              <h1 className="text-[34px] leading-none tracking-[-0.03em] lg:text-[56px]">{stats.dishesTried} dishes in Bhubaneswar</h1>
              <div className="flex flex-wrap gap-2 pt-1">
                {stats.topCuisine && (
                  <span style={{ transform: 'rotate(-2deg)' }} className="sticker-label inline-block rounded-lg border-2 border-ink bg-amber px-2 py-0.5 text-[11px]">
                    {stats.topCuisine.name} lover
                  </span>
                )}
                <Badge tone="white" className="border-2 px-2 py-0.5 text-[11px]">
                  {stats.placesTried} places
                </Badge>
              </div>
            </>
          )}
        </div>
      </SaffronHeader>

      <div className="mx-auto flex max-w-[860px] flex-col gap-7 px-5 pt-6 pb-12">
        {q.isPending ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : (
          <>
            {top.length > 0 && (
              <section className="flex flex-col gap-3">
                <SectionTitle>{name}'s top {top.length}</SectionTitle>
                {top.map((t, i) => (
                  <Link
                    key={t.menuItemId}
                    to={`/menu-items/${t.menuItemId}`}
                    className={cn('press flex items-center gap-4 rounded-2xl border-2 border-ink bg-card px-4 py-3 no-underline', i === 0 && 'shadow-hard')}
                  >
                    <span className="w-6 text-center font-display text-3xl font-extrabold">{i + 1}</span>
                    <span>
                      <span className="block font-display text-base font-extrabold">{t.menuItemName}</span>
                      <span className="text-[13px] font-bold text-body">
                        {t.placeName} · {t.stars}★
                      </span>
                    </span>
                  </Link>
                ))}
              </section>
            )}
            {!user && (
              <div className="flex flex-col gap-3 rounded-2xl bg-ink p-4 text-cream">
                <p className="font-display text-lg font-extrabold">Start your own food journal</p>
                <Button variant="primary" size="lg" block onClick={() => openLogin()} className="border-cream">
                  Continue with Google
                </Button>
              </div>
            )}
            <section className="flex flex-col gap-3">
              <SectionTitle>Stats</SectionTitle>
              <StatsTiles stats={stats} />
            </section>
            <section className="flex flex-col gap-3">
              <SectionTitle>Recently</SectionTitle>
              {cards.length === 0 ? (
                <p className="text-sm font-semibold text-body">Nothing here yet.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {cards.map((c) => (
                    <TimelineCard key={`${c.place.id}-${c.startedAt}`} card={c} />
                  ))}
                </div>
              )}
              {q.hasNextPage && (
                <Button block onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage}>
                  Load more
                </Button>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
