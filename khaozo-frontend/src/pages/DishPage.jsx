// Dish (menu item) `/menu-items/:id` — photo + label sticker, name + "at {place}", stat strip,
// AI summary, spice / oiliness bars, Your rating (Edit), "Best {dish} in town →", ratings
// (Recent / With photos). Phone: sticky Note | Rate this dish bar instead of the tab bar.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowRight, Heart } from 'lucide-react';
import { getMenuItem, listMenuItemRatings } from '@/api/menuItems.api.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useGate } from '@/hooks/useGate.js';
import { useWishlistToggle } from '@/hooks/useWishlist.js';
import { useMyNote } from '@/hooks/useNotes.js';
import { BackButton } from '@/components/layout/PageHeader.jsx';
import { Button, IconButton } from '@/components/ui/Button.jsx';
import { Sticker } from '@/components/ui/Badge.jsx';
import { Photo } from '@/components/ui/Card.jsx';
import { Segmented } from '@/components/ui/Segmented.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { StatStrip } from '@/components/shared/StatStrip.jsx';
import { LevelBars } from '@/components/shared/LevelBars.jsx';
import { SectionTitle } from '@/components/shared/SectionTitle.jsx';
import { ErrorState } from '@/components/shared/States.jsx';
import { RatingCard } from '@/components/place/ReviewCard.jsx';
import RateSheet from '@/components/sheets/RateSheet.jsx';
import NoteSheet from '@/components/sheets/NoteSheet.jsx';
import NotFoundPage from './NotFoundPage.jsx';
import { formatDate, formatPrice, LEVEL3_STEP, SPICE_LABEL, SPICE_LEVEL } from '@/lib/format.js';
import { cn } from '@/lib/cn.js';

const RERATE_AFTER_MS = 30 * 24 * 3600 * 1000; // config rerate_after_days (30)

function YourRating({ rating, onEdit }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink bg-card px-4 py-3 lg:flex-col lg:items-start lg:gap-1">
      <div>
        <p className="font-display text-[11px] font-extrabold tracking-[0.06em] uppercase">Your rating · {formatDate(rating.createdAt)}</p>
        <p className="font-display text-lg font-extrabold tracking-[-0.01em]">
          {rating.stars}★ · {rating.wouldOrderAgain ? 'Would order again' : "Wouldn't order again"}
        </p>
      </div>
      <button type="button" onClick={onEdit} className="link-plain text-[13px]">
        Edit
      </button>
    </div>
  );
}

export default function DishPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [sheet, setSheet] = useState(null);
  const [filter, setFilter] = useState('recent');

  const itemQ = useQuery({ queryKey: ['menuItem', id, user?.id ?? null], queryFn: () => getMenuItem(id) });
  const ratingsQ = useInfiniteQuery({
    queryKey: ['menuItemRatings', id],
    queryFn: ({ pageParam }) => listMenuItemRatings(id, { limit: 10, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const wish = useWishlistToggle({ menuItemId: Number(id) });
  const myNote = useMyNote({ menuItemId: Number(id) });
  const openRate = useGate(`dish:${id}:rate`, () => setSheet('rate'));
  const openNote = useGate(`dish:${id}:note`, () => setSheet('note'));
  const toggleWish = useGate(`dish:${id}:save`, wish.toggle);

  const item = itemQ.data;
  useEffect(() => {
    if (item) document.title = `${item.name} at ${item.place.name} — Khaozo`;
  }, [item]);

  if (itemQ.isError) {
    if (itemQ.error?.status === 404) return <NotFoundPage message="This dish isn't on any menu anymore." />;
    return (
      <div className="px-5 pt-10">
        <ErrorState onRetry={() => itemQ.refetch()} />
      </div>
    );
  }
  if (!item) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[200px] rounded-none" />
        <div className="flex flex-col gap-3 px-5">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton alt className="h-16" />
        </div>
      </div>
    );
  }

  const s = item.stats;
  const rated = s?.ratingCount > 0;
  const allRatings = ratingsQ.data?.pages.flatMap((p) => p.items) ?? [];
  const ratings = filter === 'photos' ? allRatings.filter((r) => r.photos?.length) : allRatings;
  const photo = allRatings.find((r) => r.photos?.length)?.photos[0]?.url;
  const label = s?.label === 'must_order' ? ['green', 'Must order'] : s?.label === 'mixed_reviews' ? ['amber', 'Mixed reviews'] : null;
  const stats = [
    { value: rated ? `${s.avgStars.toFixed(1)}★` : '–', label: rated ? `${s.ratingCount} rating${s.ratingCount === 1 ? '' : 's'}` : 'no ratings yet' },
    { value: s?.orderAgainPct != null ? `${Math.round(s.orderAgainPct)}%` : '–', label: 'order again' },
    { value: formatPrice(item.price) ?? '–', label: 'usual price' },
  ];
  const statsLaptop = [...stats, { value: s?.typicalSpice ? SPICE_LABEL[s.typicalSpice] : '–', label: 'typical spice' }];
  // Rated within 30 days → the Rate sheet edits that rating; older → a new rating (old one kept as history)
  const mine = item.myRating?.isCurrent ? item.myRating : null;
  const existing = mine && Date.now() - new Date(mine.createdAt).getTime() < RERATE_AFTER_MS ? mine : null;
  const rateItem = { id: item.id, name: item.name, price: item.price, placeId: item.place.id, placeName: item.place.name };

  const summary = item.aiSummary && (
    <div className="rounded-2xl border-2 border-ink bg-amber px-4 py-3 shadow-hard-sm">
      <p className="font-display text-[11px] font-extrabold tracking-[0.06em] uppercase">What people say · AI summary</p>
      <p className="pt-1 text-[15px] leading-snug font-bold">{item.aiSummary}</p>
    </div>
  );
  const bars = (s?.typicalSpice || s?.typicalOiliness) && (
    <div className="grid grid-cols-[72px_1fr] items-center gap-x-3 gap-y-2 text-[13px] font-bold">
      {s.typicalSpice && (
        <>
          <span>Spice</span>
          <LevelBars level={SPICE_LEVEL[s.typicalSpice]} max={4} label={`Spice: ${SPICE_LABEL[s.typicalSpice]}`} />
        </>
      )}
      {s.typicalOiliness && (
        <>
          <span>Oiliness</span>
          <LevelBars level={LEVEL3_STEP[s.typicalOiliness]} max={3} tone="ink" label={`Oiliness: ${s.typicalOiliness}`} />
        </>
      )}
    </div>
  );
  const bestLink = (
    <Link
      to={`/dishes/${item.standardDish.id}`}
      className="press flex items-center justify-between gap-3 rounded-2xl border-2 border-ink bg-ink px-4 py-3.5 font-display text-[15px] font-extrabold text-cream no-underline"
    >
      Best {item.standardDish.name} in town
      <ArrowRight className="size-5 text-saffron" strokeWidth={2.5} aria-hidden />
    </Link>
  );

  return (
    <div className="mx-auto max-w-[1180px] pb-[100px] lg:px-12 lg:pt-8 lg:pb-12">
      <div className="lg:grid lg:grid-cols-[420px_1fr] lg:gap-10">
        <div className="flex flex-col">
          <Photo src={photo} alt={item.name} label="Dish photo" className="h-[200px] border-b-2 border-ink lg:h-[270px] lg:rounded-[18px] lg:border-2 lg:shadow-hard">
            <div className="absolute inset-x-4 top-4 flex justify-between lg:hidden">
              <BackButton fallback={`/places/${item.place.id}`} />
              <IconButton label={wish.saved ? 'Remove from Want to try' : 'Save to Want to try'} onClick={toggleWish}>
                <Heart className={cn('size-[18px]', wish.saved && 'fill-ink')} />
              </IconButton>
            </div>
          </Photo>
          <div className="relative px-5 lg:px-0">
            {label && (
              <Sticker tone={label[0]} rotate={-2} className="absolute -top-[15px] left-5 px-3 py-1 text-[13px] shadow-hard-sm lg:left-6">
                {label[1]}
              </Sticker>
            )}
          </div>
          <div className="flex flex-col gap-4 px-5 pt-7 lg:px-0">
            <div>
              <h1 className="text-[30px] leading-none tracking-[-0.03em] lg:text-[38px]">{item.name}</h1>
              <Link to={`/places/${item.place.id}`} className="link-plain mt-1.5 inline-block text-[13px] lg:text-sm">
                at {item.place.name}
              </Link>
            </div>
            <StatStrip items={stats} className="lg:hidden" />
            {summary && <div className="lg:hidden">{summary}</div>}
            {bars && <div className="lg:hidden">{bars}</div>}
            <div className="hidden gap-2.5 lg:flex">
              <Button variant="primary" size="lg" className="flex-[1.4]" onClick={openRate}>
                {existing ? 'Edit your rating' : 'Rate this dish'}
              </Button>
              <Button size="lg" className="flex-1" onClick={openNote}>
                Note
              </Button>
              <Button size="lg" className="flex-1" onClick={toggleWish}>
                <Heart className={cn('size-4', wish.saved && 'fill-ink')} /> {wish.saved ? 'Saved' : 'Want to try'}
              </Button>
            </div>
            {mine && (
              <div className="lg:hidden">
                <YourRating rating={mine} onEdit={openRate} />
              </div>
            )}
            {bestLink}
          </div>
        </div>

        <div className="flex flex-col gap-5 px-5 pt-7 lg:px-0 lg:pt-0">
          <StatStrip items={statsLaptop} primary className="hidden lg:grid" />
          <div className={cn('hidden gap-4 lg:grid', summary && mine ? 'grid-cols-[1.4fr_1fr]' : 'grid-cols-1')}>
            {summary}
            {mine && <YourRating rating={mine} onEdit={openRate} />}
          </div>
          {bars && <div className="hidden max-w-md lg:block">{bars}</div>}
          <SectionTitle
            right={
              <Segmented
                label="Filter ratings"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'recent', label: 'Recent' },
                  { value: 'photos', label: 'With photos' },
                ]}
              />
            }
          >
            Ratings
          </SectionTitle>
          {ratingsQ.isPending ? (
            <Skeleton className="h-24" />
          ) : ratings.length === 0 ? (
            <p className="text-sm font-semibold text-body">{filter === 'photos' ? 'No photos yet.' : 'No ratings yet — be the first to rate it.'}</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {ratings.map((r) => (
                <RatingCard key={r.id} rating={r} />
              ))}
            </div>
          )}
          {ratingsQ.hasNextPage && (
            <Button block onClick={() => ratingsQ.fetchNextPage()} loading={ratingsQ.isFetchingNextPage}>
              More ratings
            </Button>
          )}
        </div>
      </div>

      {/* Phone action bar (replaces the tab bar on this page) */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2.5 border-t-2 border-ink bg-cream px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] lg:hidden">
        <Button size="lg" className="flex-1" onClick={openNote}>
          Note
        </Button>
        <Button variant="primary" size="lg" className="flex-[1.2]" onClick={openRate}>
          {existing ? 'Edit rating' : 'Rate this dish'}
        </Button>
      </div>

      <RateSheet open={sheet === 'rate'} onOpenChange={(o) => !o && setSheet(null)} menuItem={rateItem} existing={existing} />
      <NoteSheet open={sheet === 'note'} onOpenChange={(o) => !o && setSheet(null)} target={{ menuItemId: item.id }} existing={myNote} subtitle={`${item.name} · ${item.place.name}`} />
    </div>
  );
}
