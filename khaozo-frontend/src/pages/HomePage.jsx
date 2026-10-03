// Home `/` — saffron header (logo, area pill, headline, search), mood chips, "Open now near
// you" (list ↔ map on phone, side by side on laptop), "Best in Bhubaneswar for…" tiles.
// Location is asked on first visit; denied → area picker card.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { listPlaces } from '@/api/places.api.js';
import { matchDish } from '@/api/dishes.api.js';
import { useUserLocation } from '@/context/LocationContext.jsx';
import { SaffronHeader } from '@/components/layout/PageHeader.jsx';
import SearchBar from '@/components/search/SearchBar.jsx';
import AreaPill from '@/components/search/AreaPill.jsx';
import AreaPicker from '@/components/search/AreaPicker.jsx';
import PlaceCard from '@/components/search/PlaceCard.jsx';
import MapView from '@/components/map/MapView.jsx';
import { Chip, ChipRow } from '@/components/ui/Chip.jsx';
import { Segmented } from '@/components/ui/Segmented.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { SectionTitle } from '@/components/shared/SectionTitle.jsx';
import { EmptyState, ErrorState } from '@/components/shared/States.jsx';
import { buttonVariants } from '@/components/ui/Button.jsx';
import { useIsLaptop } from '@/hooks/useMediaQuery.js';

// Mood chips → plain-language search with the mood filter set
export const MOOD_CHIPS = [
  { label: 'Late night', mood: 'Late night' },
  { label: 'Date', mood: 'Date' },
  { label: 'Quick bite', mood: 'Quick bite' },
  { label: 'Study', mood: 'Study' },
  { label: 'Work / laptop', mood: 'Work' },
  { label: 'Budget meal', mood: 'Budget' },
];

// "Best in Bhubaneswar for…" — catalogue dish names (resolved to ids via /dishes/match)
const BEST_FOR = [
  { label: 'Biryani', dish: 'Chicken Dum Biryani' },
  { label: 'Dahibara', dish: 'Dahibara Aloodum' },
  { label: 'Chhena Poda', dish: 'Chhena Poda' },
  { label: 'Momos', dish: 'Chicken Steamed Momos' },
  { label: 'Cold Coffee', dish: 'Cold Coffee' },
  { label: 'Masala Dosa', dish: 'Masala Dosa' },
];

function MoodChips({ className }) {
  const navigate = useNavigate();
  return (
    <ChipRow className={className}>
      {MOOD_CHIPS.map((m, i) => (
        <Chip
          key={m.mood}
          selected={i === 0}
          className="lg:shadow-none"
          onClick={() => navigate(`/search?q=${encodeURIComponent(m.label)}&mood=${encodeURIComponent(m.mood)}`)}
        >
          {m.label}
        </Chip>
      ))}
    </ChipRow>
  );
}

function BestForTiles() {
  const results = useQueries({
    queries: BEST_FOR.map((b) => ({
      queryKey: ['dishMatch', b.dish],
      queryFn: () => matchDish(b.dish),
      staleTime: 24 * 3600 * 1000,
    })),
  });
  const tiles = BEST_FOR.map((b, i) => ({ ...b, id: results[i].data?.match?.id })).filter((t) => t.id);
  if (!tiles.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Best in Bhubaneswar for…</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5 lg:flex lg:flex-wrap">
        {tiles.map((t) => (
          <Link
            key={t.id}
            to={`/dishes/${t.id}`}
            className="press flex items-center justify-between gap-2 rounded-xl border-2 border-ink bg-card px-3.5 py-2.5 font-display text-[15px] font-extrabold no-underline lg:px-4"
          >
            {t.label}
            <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}

function NearYou() {
  const { centre, needsPicker, status } = useUserLocation();
  const laptop = useIsLaptop();
  const [view, setView] = useState('list');
  const [hover, setHover] = useState(null);

  const openQ = useQuery({
    queryKey: ['places', 'near', centre, 'open'],
    queryFn: () => listPlaces({ ...centre, openNow: true, limit: 12 }),
    enabled: !!centre,
  });
  const anyQ = useQuery({
    queryKey: ['places', 'near', centre, 'any'],
    queryFn: () => listPlaces({ ...centre, limit: 12 }),
    enabled: !!centre && openQ.isSuccess && openQ.data.items.length === 0,
  });
  const showingOpen = !openQ.data || openQ.data.items.length > 0;
  const items = showingOpen ? (openQ.data?.items ?? []) : (anyQ.data?.items ?? []);
  const loading = !!centre && (openQ.isPending || (!showingOpen && anyQ.isPending));
  const pins = useMemo(
    () => items.map((p) => ({ id: p.id, lat: p.location.lat, lng: p.location.lng, label: p.name, title: p.name })),
    [items],
  );

  if (needsPicker && !centre) {
    return (
      <section className="rounded-[18px] border-2 border-ink bg-card p-5 shadow-hard">
        <p className="mb-1 text-[11px] font-bold tracking-[0.12em] text-muted uppercase">Location is off</p>
        <h2 className="mb-1 text-[22px] tracking-[-0.02em]">Where are you eating?</h2>
        <p className="mb-4 text-sm font-medium text-body">Pick an area, or turn on location for distances from where you are.</p>
        <AreaPicker showSearch={false} />
      </section>
    );
  }

  const title = showingOpen ? 'Open now near you' : 'Near you';
  const list = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
      {items.map((p) => (
        <PlaceCard key={p.id} place={p} onHover={setHover} active={hover === p.id} />
      ))}
    </div>
  );

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle right={!laptop && <Segmented label="View" value={view} onChange={setView} options={[{ value: 'list', label: 'List' }, { value: 'map', label: 'Map' }]} />}>
        {title}
      </SectionTitle>
      {!showingOpen && <p className="-mt-2 text-sm font-semibold text-body">Nothing nearby is open right now — here's what's closest.</p>}
      {loading || status === 'asking' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-[200px] rounded-[18px]" />
          <Skeleton alt className="h-[200px] rounded-[18px]" />
        </div>
      ) : openQ.isError ? (
        <ErrorState onRetry={() => openQ.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="No places here yet" message="Know a good stall nearby? Add it — it goes live once a few people confirm it.">
          <Link to="/places/new" className={buttonVariants({ variant: 'primary' })}>
            Add a place
          </Link>
        </EmptyState>
      ) : laptop ? (
        <div className="grid grid-cols-[1fr_440px] gap-7">
          {list}
          <MapView pins={pins} centre={centre} activeId={hover} onPinClick={(id) => setHover(id)} className="sticky top-6 h-[480px]" />
        </div>
      ) : view === 'map' ? (
        <MapView pins={pins} centre={centre} activeId={hover} onPinClick={(id) => setHover(id)} className="h-[420px]" />
      ) : (
        list
      )}
    </section>
  );
}

export default function HomePage() {
  const { mode, status, askLocation } = useUserLocation();

  // Ask for location on the first visit (mode === null means "never decided")
  useEffect(() => {
    if (mode === null && status === 'idle') askLocation();
  }, [mode, status, askLocation]);

  useEffect(() => {
    document.title = 'Khaozo — stop guessing, start eating right';
  }, []);

  return (
    <div>
      <SaffronHeader>
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 pt-5 pb-6 lg:flex-row lg:items-end lg:gap-12 lg:px-12 lg:pt-14 lg:pb-12">
          <div className="flex items-center justify-between lg:hidden">
            <span className="font-display text-[22px] font-extrabold tracking-[-0.03em]">khaozo</span>
            <AreaPill />
          </div>
          <div className="flex flex-col gap-4 lg:flex-1">
            <div className="hidden lg:block">
              <AreaPill />
            </div>
            <h1 className="text-[34px] leading-none tracking-[-0.03em] lg:text-[64px] lg:leading-[0.95] lg:tracking-[-0.04em]">
              Stop guessing.
              <br />
              Start eating right.
            </h1>
          </div>
          <div className="flex flex-col gap-3 lg:w-[540px] lg:pb-2">
            <SearchBar big={false} className="lg:hidden" />
            <SearchBar big placeholder='Try "quiet café with wifi near KIIT"' className="hidden lg:block" />
            <MoodChips className="hidden lg:flex lg:flex-wrap" />
          </div>
        </div>
      </SaffronHeader>

      <div className="mx-auto flex max-w-[1280px] flex-col gap-7 px-5 pt-[18px] pb-8 lg:px-12 lg:pt-8">
        <MoodChips className="lg:hidden" />
        <NearYou />
        <BestForTiles />
      </div>
    </div>
  );
}
