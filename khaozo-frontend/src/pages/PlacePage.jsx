// Place `/places/:id` — photo + open sticker, name/meta, actions (Rate a dish · Review · Note
// · ♡), unverified confirmations, Order this (must-order / mixed), full menu (+ Add menu),
// Good for, Hours (+ add if missing), Facilities, Reviews, OSM credit, Report a problem.
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Share2 } from 'lucide-react';
import { confirmPlace, getMenu, getPlace } from '@/api/places.api.js';
import { listPlaceReviews } from '@/api/reviews.api.js';
import { listPlacePhotos } from '@/api/photos.api.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { distanceM, useUserLocation } from '@/context/LocationContext.jsx';
import { useGate } from '@/hooks/useGate.js';
import { useWishlistToggle } from '@/hooks/useWishlist.js';
import { useMyNote } from '@/hooks/useNotes.js';
import { BackButton } from '@/components/layout/PageHeader.jsx';
import { Button, IconButton } from '@/components/ui/Button.jsx';
import { Badge, LabelBadge, Sticker } from '@/components/ui/Badge.jsx';
import { Chip } from '@/components/ui/Chip.jsx';
import { Photo } from '@/components/ui/Card.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { SectionTitle } from '@/components/shared/SectionTitle.jsx';
import { EmptyState, ErrorState } from '@/components/shared/States.jsx';
import { shareLink } from '@/components/shared/ShareButton.jsx';
import { DietMark } from '@/components/place/DietMark.jsx';
import { ReviewCard } from '@/components/place/ReviewCard.jsx';
import RateSheet from '@/components/sheets/RateSheet.jsx';
import ReviewSheet from '@/components/sheets/ReviewSheet.jsx';
import ReportSheet from '@/components/sheets/ReportSheet.jsx';
import HoursSheet from '@/components/sheets/HoursSheet.jsx';
import NoteSheet from '@/components/sheets/NoteSheet.jsx';
import AddMenuItemSheet from '@/components/sheets/AddMenuItemSheet.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';
import NotFoundPage from './NotFoundPage.jsx';
import {
  formatClock,
  formatDistance,
  formatPrice,
  formatStars,
  hoursForDay,
  joinMeta,
  openingText,
  PLACE_DIET_LABEL,
  PLACE_TYPE_LABEL,
  priceLevel,
  sameHoursEveryDay,
  todayInIst,
} from '@/lib/format.js';
import { cn } from '@/lib/cn.js';

const FACILITY_LABELS = [
  ['ac', 'AC'],
  ['wifi', 'Wi-Fi'],
  ['plugPoints', 'Plug points'],
  ['acceptsUpi', 'UPI'],
  ['acceptsCard', 'Card'],
  ['acceptsCash', 'Cash'],
  ['washroom', 'Washroom'],
  ['bikeParking', 'Bike parking'],
  ['carParking', 'Car parking'],
];
const NOISE = { quiet: 'Quiet', moderate: 'Moderate noise', loud: 'Loud' };

function OpenSticker({ opening, className }) {
  if (!opening || opening.state === 'unknown') return null;
  if (opening.state === 'open') {
    return (
      <Sticker tone="green" rotate={-2} className={cn('px-3 py-1 text-[13px]', className)}>
        {opening.closingSoon ? `Closes ${formatClock(opening.closesAt)}` : `Open till ${formatClock(opening.closesAt)}`}
      </Sticker>
    );
  }
  return (
    <Sticker tone="white" rotate={-2} className={cn('px-3 py-1 text-[13px] shadow-hard-sm', className)}>
      Closed · {openingText(opening)?.replace('Opens', 'opens')}
    </Sticker>
  );
}

function OrderThis({ items, menuById }) {
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Order this</SectionTitle>
      <div className="overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-hard [&>*+*]:border-t-2 [&>*+*]:border-ink">
        {items.map((d) => {
          const price = menuById[d.menuItemId]?.price;
          return (
            <Link
              key={d.menuItemId}
              to={`/menu-items/${d.menuItemId}`}
              className={cn('flex items-start justify-between gap-3 px-4 py-3 no-underline hover:brightness-[0.98]', d.label === 'mixed_reviews' ? 'bg-mixed' : 'bg-card')}
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[15px] font-extrabold">{d.name}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-body">
                  <LabelBadge label={d.label} />
                  {joinMeta(d.orderAgainPct != null ? `${Math.round(d.orderAgainPct)}% again` : null, formatPrice(price))}
                </span>
                {d.aiSummary && <span className="text-xs font-medium text-body">“{d.aiSummary}”</span>}
              </span>
              <span className="shrink-0 font-display text-lg font-extrabold lg:text-[22px]">{formatStars(d.avgStars)}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function FullMenu({ menu, onAdd }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle
        right={
          <button type="button" className="link text-[13px]" onClick={onAdd}>
            + Add menu
          </button>
        }
      >
        Full menu
      </SectionTitle>
      {menu.length === 0 ? (
        <p className="py-2 text-sm font-semibold text-body">No dishes on the menu yet. Add the first one!</p>
      ) : (
        <ul className="[&>*+*]:border-t-2 [&>*+*]:border-dashed [&>*+*]:border-divider">
          {menu.map((m) => (
            <li key={m.id}>
              <Link to={`/menu-items/${m.id}`} className="flex items-center gap-2.5 py-2.5 no-underline">
                <DietMark diet={m.diet} />
                <span className="flex-1 text-[15px] font-bold">{m.name}</span>
                <span className="text-sm font-bold">
                  {joinMeta(formatPrice(m.price), m.stats?.ratingCount ? formatStars(m.stats.avgStars) : 'no ratings')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HoursCard({ place, onAdd }) {
  const [all, setAll] = useState(false);
  const today = todayInIst();
  const same = sameHoursEveryDay(place.hours);
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border-2 border-ink bg-card p-3.5">
      <h3 className="font-display text-base font-extrabold">Hours</h3>
      {!place.hours.length ? (
        <>
          <p className="text-[13px] font-semibold text-body">Not known yet.</p>
          <button type="button" className="link w-fit text-[13px]" onClick={onAdd}>
            + Add opening hours
          </button>
        </>
      ) : same ? (
        <p className="text-[13px] font-bold">Mon–Sun {same}</p>
      ) : (
        <>
          <p className="text-[13px] font-bold">Today {hoursForDay(place.hours, today) || 'closed'}</p>
          {all ? (
            <ul className="text-xs font-semibold text-body">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <li key={d}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]} {hoursForDay(place.hours, d) || 'closed'}
                </li>
              ))}
            </ul>
          ) : (
            <button type="button" className="link-plain w-fit text-[13px]" onClick={() => setAll(true)}>
              All week
            </button>
          )}
        </>
      )}
    </div>
  );
}

function FacilitiesCard({ stats }) {
  const yes = FACILITY_LABELS.filter(([k]) => stats?.[k] === true).map(([, l]) => l);
  if (stats?.noise) yes.push(NOISE[stats.noise]);
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border-2 border-ink bg-card p-3.5">
      <h3 className="font-display text-base font-extrabold">Facilities</h3>
      <p className="text-[13px] leading-relaxed font-bold">{yes.length ? yes.join(' · ') : <span className="font-semibold text-body">Not enough reviews yet.</span>}</p>
    </div>
  );
}

function Verification({ place, onConfirm, confirming }) {
  const v = place.verification;
  if (!v) return null;
  const pct = Math.min(100, Math.round((v.confirmations / v.threshold) * 100));
  const share = () => shareLink({ url: window.location.href, title: place.name, text: `Have you been to ${place.name}? Confirm it on Khaozo` });
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-card p-4 shadow-hard">
      <p className="text-[13px] font-semibold text-body">
        Added by a Khaozo user. {Math.floor(v.confirmations)} of {v.threshold} confirmations so far — it goes live as verified at {v.threshold}.
      </p>
      <div className="h-3.5 overflow-hidden rounded-full border-2 border-ink bg-card" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Confirmations">
        <div className="h-full bg-green" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-2.5">
        {place.me?.isAdder ? (
          <span className="text-[13px] font-bold">You added this place — ask friends who've been there.</span>
        ) : place.me?.hasConfirmed ? (
          <Badge tone="green" className="px-2 py-1 text-xs">You confirmed ✓</Badge>
        ) : (
          <Button variant="green" onClick={onConfirm} loading={confirming}>
            I've been here ✓
          </Button>
        )}
        <Button onClick={share}>Ask friends to confirm</Button>
      </div>
    </div>
  );
}

export default function PlacePage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { centre } = useUserLocation();
  const qc = useQueryClient();
  const [sheet, setSheet] = useState(null); // rate-pick | rate | review | report | hours | note | add-menu
  const [rateItem, setRateItem] = useState(null);

  const placeQ = useQuery({ queryKey: ['place', id, user?.id ?? null], queryFn: () => getPlace(id) });
  const menuQ = useQuery({ queryKey: ['placeMenu', id], queryFn: () => getMenu(id) });
  const photosQ = useQuery({ queryKey: ['placePhotos', id], queryFn: () => listPlacePhotos(id, { limit: 12 }) });
  const reviewsQ = useInfiniteQuery({
    queryKey: ['placeReviews', id],
    queryFn: ({ pageParam }) => listPlaceReviews(id, { limit: 5, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const place = placeQ.data;
  const menu = useMemo(() => menuQ.data ?? [], [menuQ.data]);
  const menuById = useMemo(() => Object.fromEntries(menu.map((m) => [m.id, m])), [menu]);
  const reviews = reviewsQ.data?.pages.flatMap((p) => p.items) ?? [];
  const myReview = user ? reviews.find((r) => r.userId === user.id) : null;
  const myNote = useMyNote({ placeId: Number(id) });
  const wish = useWishlistToggle({ placeId: Number(id) });

  const open = (name) => () => setSheet(name);
  const openRate = useGate(`place:${id}:rate`, open('rate-pick'));
  const openReview = useGate(`place:${id}:review`, open('review'));
  const openNote = useGate(`place:${id}:note`, open('note'));
  const openReport = useGate(`place:${id}:report`, open('report'));
  const openHours = useGate(`place:${id}:hours`, open('hours'));
  const openAddMenu = useGate(`place:${id}:menu`, open('add-menu'));
  const toggleWish = useGate(`place:${id}:save`, wish.toggle);
  const confirm = useMutation({
    mutationFn: () => confirmPlace(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['place', id] });
      toast.success(data?.verified ? 'Confirmed — this place is now verified!' : 'Thanks for confirming!');
    },
    onError: toastError,
  });
  const openConfirm = useGate(`place:${id}:confirm`, () => confirm.mutate());

  // Arrived from "+ → Rate a dish / Review a place"
  useEffect(() => {
    const want = location.state?.open;
    if (!want || !place) return;
    navigate(location.pathname, { replace: true, state: {} });
    if (want === 'rate') setSheet('rate-pick');
    if (want === 'review') setSheet('review');
  }, [location.state, location.pathname, place, navigate]);

  useEffect(() => {
    if (place) document.title = `${place.name} — Khaozo`;
  }, [place]);

  if (placeQ.isError) {
    if (placeQ.error?.status === 404) return <NotFoundPage message="This place doesn't exist or was removed." />;
    return (
      <div className="px-5 pt-10">
        <ErrorState onRetry={() => placeQ.refetch()} />
      </div>
    );
  }
  if (!place) {
    return (
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4 lg:px-12 lg:pt-8">
        <Skeleton className="h-[200px] rounded-none lg:h-[280px] lg:rounded-[18px]" />
        <div className="flex flex-col gap-3 px-5 lg:px-0">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton alt className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  const heroPhoto = photosQ.data?.items?.[0]?.url;
  const photoCount = photosQ.data?.items?.length ?? 0;
  const dist = centre ? formatDistance(distanceM(centre, place.location)) : null;
  const meta = joinMeta(place.cuisines?.map((c) => c.name).slice(0, 2).join(', ') || PLACE_TYPE_LABEL[place.placeType], PLACE_DIET_LABEL[place.dietType], priceLevel(place.priceLevel), place.area?.name, dist);
  const rating = place.stats?.reviewCount ? `${formatStars(place.stats.avgStars)} place · ${place.stats.reviewCount} review${place.stats.reviewCount === 1 ? '' : 's'}` : 'No reviews yet';
  const orderThis = [...(place.mustOrder ?? []), ...(place.mixedReviews ?? [])];
  const credit = place.source === 'osm' ? '© OpenStreetMap contributors' : place.source === 'foursquare' ? 'Place data: Foursquare OS Places' : 'Added by a Khaozo diner';

  const share = () => shareLink({ url: window.location.href, title: place.name, text: `${place.name} on Khaozo` });
  const actions = (
    <div className="flex gap-2.5">
      <Button variant="primary" size="lg" className="flex-[1.4]" onClick={openRate} disabled={place.status === 'closed'}>
        Rate a dish
      </Button>
      <Button size="lg" className="flex-1" onClick={openReview}>
        Review
      </Button>
      <Button size="lg" className="flex-1" onClick={openNote}>
        Note
      </Button>
      <Button size="lg" className="hidden flex-1 lg:inline-flex" onClick={toggleWish} aria-label={wish.saved ? 'Remove from Want to try' : 'Save to Want to try'}>
        <Heart className={cn('size-5', wish.saved && 'fill-ink')} />
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1180px] lg:px-12 lg:pt-8 lg:pb-12">
      <div className="lg:grid lg:grid-cols-[460px_1fr] lg:gap-10">
        {/* Left column */}
        <div className="flex flex-col">
          <Photo src={heroPhoto} alt={place.name} label="Place photo" className="h-[210px] border-b-2 border-ink lg:h-[280px] lg:rounded-[18px] lg:border-2 lg:shadow-hard">
            <div className="absolute inset-x-4 top-4 flex justify-between lg:hidden">
              <BackButton fallback="/" />
              <div className="flex gap-2">
                <IconButton label="Share" onClick={share}>
                  <Share2 className="size-[18px]" />
                </IconButton>
                <IconButton label={wish.saved ? 'Remove from Want to try' : 'Save to Want to try'} onClick={toggleWish}>
                  <Heart className={cn('size-[18px]', wish.saved && 'fill-ink')} />
                </IconButton>
              </div>
            </div>
            {photoCount > 1 && <span className="sticker-label absolute right-3 bottom-3 hidden rounded-md bg-ink px-2 py-1 text-[11px] text-cream lg:inline">+{photoCount - 1} photos</span>}
          </Photo>
          <div className="relative px-5 lg:px-0">
            <OpenSticker opening={place.opening} className="absolute -top-[16px] left-5 lg:left-6" />
          </div>
          <div className="flex flex-col gap-4 px-5 pt-7 lg:px-0">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[30px] leading-none tracking-[-0.03em] lg:text-[40px]">{place.name}</h1>
                {place.status === 'unverified' && <Badge tone="dashed" className="border-2 px-2">Unverified</Badge>}
                {place.status === 'closed' && <Badge tone="ink">Permanently closed</Badge>}
              </div>
              <p className="pt-1 text-[13px] font-bold text-body lg:text-[15px]">{meta}</p>
              <p className="text-[13px] font-extrabold lg:text-[15px]">{rating}</p>
            </div>
            {actions}
            {place.status === 'unverified' && <Verification place={place} onConfirm={openConfirm} confirming={confirm.isPending} />}
            <div className="hidden grid-cols-2 gap-3 lg:grid">
              <HoursCard place={place} onAdd={openHours} />
              <FacilitiesCard stats={place.stats} />
            </div>
            {place.stats?.tags?.length > 0 && (
              <div className="hidden flex-wrap gap-2 lg:flex">
                {place.stats.tags.map((t) => (
                  <Chip key={t.id} as="span">
                    {t.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column (phone: continues below) */}
        <div className="flex flex-col gap-7 px-5 pt-7 pb-8 lg:px-0 lg:pt-0">
          <OrderThis items={orderThis} menuById={menuById} />
          <div className="flex flex-col gap-7 lg:grid lg:grid-cols-2 lg:gap-6">
            {menuQ.isPending ? <Skeleton className="h-40" /> : <FullMenu menu={menu} onAdd={openAddMenu} />}
            {place.stats?.tags?.length > 0 && (
              <section className="flex flex-col gap-3 lg:hidden">
                <SectionTitle>Good for</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {place.stats.tags.map((t) => (
                    <Chip key={t.id} as="span">
                      {t.name}
                    </Chip>
                  ))}
                </div>
              </section>
            )}
            <div className="grid grid-cols-2 gap-3 lg:hidden">
              <HoursCard place={place} onAdd={openHours} />
              <FacilitiesCard stats={place.stats} />
            </div>
            <section className="flex flex-col gap-3">
              <SectionTitle>Reviews</SectionTitle>
              {reviewsQ.isPending ? (
                <Skeleton className="h-24" />
              ) : reviews.length === 0 ? (
                <EmptyState title="No reviews yet" message="Been here? Tell people what it's like." className="p-4">
                  <Button variant="primary" onClick={openReview}>
                    Write the first review
                  </Button>
                </EmptyState>
              ) : (
                <>
                  {reviews.map((r) => (
                    <ReviewCard key={r.id} review={r} />
                  ))}
                  {reviewsQ.hasNextPage && (
                    <Button block onClick={() => reviewsQ.fetchNextPage()} loading={reviewsQ.isFetchingNextPage}>
                      More reviews
                    </Button>
                  )}
                </>
              )}
            </section>
          </div>
          <div className="flex items-center justify-between gap-3 border-t-2 border-dashed border-divider pt-4 text-xs font-bold text-body">
            <span>{credit}</span>
            <button type="button" className="link-plain text-xs" onClick={openReport}>
              Report a problem
            </button>
          </div>
        </div>
      </div>

      <AddMenuItemSheet
        open={sheet === 'rate-pick' || sheet === 'add-menu'}
        mode={sheet === 'rate-pick' ? 'rate' : 'add'}
        onOpenChange={(o) => !o && setSheet((s) => (s === 'rate-pick' || s === 'add-menu' ? null : s))}
        place={place}
        menu={menu}
        onPicked={(item) => {
          setRateItem({ ...item, placeId: place.id, placeName: place.name });
          setTimeout(() => setSheet('rate'), 50);
        }}
      />
      <RateSheet open={sheet === 'rate'} onOpenChange={(o) => !o && setSheet(null)} menuItem={rateItem} existing={null} />
      <ReviewSheet open={sheet === 'review'} onOpenChange={(o) => !o && setSheet(null)} place={place} existing={myReview} />
      <ReportSheet open={sheet === 'report'} onOpenChange={(o) => !o && setSheet(null)} place={place} />
      <HoursSheet open={sheet === 'hours'} onOpenChange={(o) => !o && setSheet(null)} place={place} />
      <NoteSheet open={sheet === 'note'} onOpenChange={(o) => !o && setSheet(null)} target={{ placeId: place.id }} existing={myNote} subtitle={place.name} />
    </div>
  );
}
