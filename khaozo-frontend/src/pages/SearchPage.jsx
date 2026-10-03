// Search `/search?q=` — filters live in the URL (back button restores them, links are
// shareable). Query in the header, filter chips, diet banner, "we widened" notice, count
// title, List ↔ Map (phone) / list + map (laptop), Load more. Empty + loading states.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { search } from '@/api/search.api.js';
import { useUserLocation } from '@/context/LocationContext.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { SaffronHeader } from '@/components/layout/PageHeader.jsx';
import { BackButton } from '@/components/layout/PageHeader.jsx';
import SearchBar from '@/components/search/SearchBar.jsx';
import ResultCard from '@/components/search/ResultCard.jsx';
import FiltersSheet from '@/components/search/FiltersSheet.jsx';
import MapView from '@/components/map/MapView.jsx';
import { Chip, ChipRow } from '@/components/ui/Chip.jsx';
import { Segmented } from '@/components/ui/Segmented.jsx';
import { RowSkeleton } from '@/components/ui/Skeleton.jsx';
import { Button, buttonVariants } from '@/components/ui/Button.jsx';
import { EmptyState, ErrorState } from '@/components/shared/States.jsx';
import { useIsLaptop } from '@/hooks/useMediaQuery.js';
import { formatPrice, formatStars, joinMeta, SPICE_LABEL } from '@/lib/format.js';

const PAGE = 10;
const FILTER_KEYS = ['maxPrice', 'openNow', 'diet', 'mood', 'mealTime', 'spice'];
const DIET_WORD = { veg: 'Veg', egg: 'Egg', non_veg: 'Non-veg' };

const plural = (n, word) => {
  if (!word) return n === 1 ? 'result' : 'results';
  const w = word.toLowerCase();
  if (n === 1 || /s$/.test(w)) return w;
  return /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`;
};

// Chips: what the search understood (from the sentence) + what the user picked (URL, removable)
const chipsFor = (understood, params) => {
  const chips = [];
  const from = (key) => (params.get(key) != null ? 'url' : 'ai');
  const val = (key) => params.get(key) ?? understood?.[key];
  const maxPrice = val('maxPrice');
  if (maxPrice) chips.push({ key: 'maxPrice', label: `Under ${formatPrice(Number(maxPrice))}`, source: from('maxPrice') });
  const spice = val('spice');
  if (spice) chips.push({ key: 'spice', label: SPICE_LABEL[spice] ?? spice, source: from('spice') });
  const openNow = params.get('openNow') ?? (understood?.openNow ? '1' : null);
  if (openNow === '1' || openNow === 'true') chips.push({ key: 'openNow', label: 'Open now', source: from('openNow') });
  const diet = val('diet');
  if (diet) chips.push({ key: 'diet', label: DIET_WORD[diet] ?? diet, source: from('diet') });
  const mood = val('mood');
  if (mood) chips.push({ key: 'mood', label: mood, source: from('mood') });
  const mealTime = val('mealTime');
  if (mealTime) chips.push({ key: 'mealTime', label: mealTime, source: from('mealTime') });
  return chips;
};

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const { centre } = useUserLocation();
  const { user } = useAuth();
  const laptop = useIsLaptop();
  const navigate = useNavigate();
  const [view, setView] = useState('list');
  const [shown, setShown] = useState(PAGE);
  const [hover, setHover] = useState(null);
  const [mapCentre, setMapCentre] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // "Search this area" puts lat/lng in the URL; otherwise the user's own point / area
  const urlPoint = params.get('lat') && params.get('lng') ? { lat: Number(params.get('lat')), lng: Number(params.get('lng')) } : null;
  const point = urlPoint ?? centre;

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? undefined]));
  const showAll = params.get('showAll') === '1';

  const query = useQuery({
    queryKey: ['search', q, point, filters, showAll, user?.id ?? null],
    queryFn: () => search({ q, lat: point?.lat, lng: point?.lng, ...filters, showAll: showAll ? '1' : undefined }),
    enabled: q.length >= 2,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    setShown(PAGE);
  }, [q, params]);

  useEffect(() => {
    document.title = q ? `${q} — Khaozo` : 'Search — Khaozo';
  }, [q]);

  const data = query.data;
  const items = data?.items ?? [];
  const pins = useMemo(
    () =>
      items
        .filter((it) => it.place.location)
        .map((it) => ({
          id: it.place.id,
          lat: it.place.location.lat,
          lng: it.place.location.lng,
          title: it.place.name,
          label: joinMeta(formatPrice(it.menuItem?.price), formatStars(it.menuItem?.stats?.avgStars)) || it.place.name,
        })),
    [items],
  );

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value == null || value === '') next.delete(key);
    else next.set(key, value);
    setParams(next);
  };

  if (!q) {
    return (
      <div className="px-5 pt-6">
        <SearchBar autoFocus />
      </div>
    );
  }

  const chips = chipsFor(data?.filters, params);
  const personal = data?.personalised;
  const dietFiltered = personal?.dietFilter?.diet || personal?.dietFilter?.avoidIds?.length;
  const dishWord = data?.resolved?.dish;
  const spiceWord = (params.get('spice') ?? data?.filters?.spice) ? SPICE_LABEL[params.get('spice') ?? data.filters.spice]?.toLowerCase() : null;
  const title = data ? `${items.length} ${spiceWord && dishWord ? `${spiceWord} ` : ''}${plural(items.length, dishWord)}` : 'Searching…';
  const subtitle = joinMeta(
    data?.resolved?.area ? `near ${data.resolved.area.name}` : null,
    (params.get('maxPrice') ?? data?.filters?.maxPrice) ? `under ${formatPrice(Number(params.get('maxPrice') ?? data.filters.maxPrice))}` : null,
  );

  const filterChips = (
    <>
      {chips.map((c) => (
        <Chip key={c.key} selected removable={c.source === 'url'} onClick={c.source === 'url' ? () => setParam(c.key, null) : undefined} as={c.source === 'url' ? 'button' : 'span'}>
          {c.label}
        </Chip>
      ))}
      {!chips.some((c) => c.key === 'openNow') && <Chip onClick={() => setParam('openNow', '1')}>Open now</Chip>}
      {!chips.some((c) => c.key === 'diet') && <Chip onClick={() => setParam('diet', 'veg')}>Veg</Chip>}
      {!chips.some((c) => c.key === 'mood') && <Chip onClick={() => setParam('mood', 'Late night')}>Late night</Chip>}
      <Chip onClick={() => setFiltersOpen(true)}>
        <SlidersHorizontal className="size-3.5" strokeWidth={2.5} aria-hidden /> Filters
      </Chip>
    </>
  );

  const dietBanner = (dietFiltered || showAll) && (
    <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink bg-veg-banner px-3.5 py-2 text-[13px] font-bold">
      <span>
        {showAll ? 'Showing veg + non-veg' : `Showing your diet only${personal?.hiddenByDiet ? ` · ${personal.hiddenByDiet} hidden` : ''}`}
      </span>
      <button type="button" className="link-plain" onClick={() => setParam('showAll', showAll ? null : '1')}>
        {showAll ? 'My diet only' : 'Show all'}
      </button>
    </div>
  );

  const relaxNote = data?.relaxed?.length > 0 && (
    <div className="rounded-xl border-2 border-dashed border-ink bg-notice px-3.5 py-2.5 text-[13px] leading-snug font-bold">{data.relaxed.join(' · ')}</div>
  );

  const results =
    query.isPending ? (
      <RowSkeleton count={3} />
    ) : query.isError ? (
      <ErrorState onRetry={() => query.refetch()} message={query.error?.message} />
    ) : items.length === 0 ? (
      <EmptyState label="Nothing found" title="Nothing matches, even after widening" message="Try a different dish or fewer filters. Know a stall we're missing?">
        <Button onClick={() => setParams({ q })}>Clear filters</Button>
        <Link to="/places/new" className={buttonVariants({ variant: 'primary' })}>
          Add a place
        </Link>
      </EmptyState>
    ) : (
      <div className="flex flex-col gap-3">
        {items.slice(0, shown).map((it) => (
          <ResultCard key={`${it.place.id}-${it.menuItem?.id ?? 'p'}`} item={it} active={hover === it.place.id} onHover={setHover} />
        ))}
        {shown < items.length && (
          <Button block onClick={() => setShown((n) => n + PAGE)}>
            Load more
          </Button>
        )}
      </div>
    );

  const map = (
    <MapView
      pins={pins}
      centre={point}
      activeId={hover ?? pins[0]?.id}
      onPinClick={(id) => setHover(id)}
      className={laptop ? 'sticky top-6 h-[calc(100dvh-140px)] min-h-[460px]' : 'h-[460px]'}
      onSearchArea={{
        visible: !!mapCentre,
        onMove: (c) => setMapCentre({ lat: c.lat, lng: c.lng }),
        onClick: () => {
          const next = new URLSearchParams(params);
          next.set('lat', mapCentre.lat.toFixed(5));
          next.set('lng', mapCentre.lng.toFixed(5));
          setMapCentre(null);
          setParams(next);
        },
      }}
    />
  );

  return (
    <div>
      {/* Phone header: back + query, filter chips */}
      <SaffronHeader className="lg:hidden">
        <div className="flex flex-col gap-3 px-4 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <BackButton fallback="/" className="size-[46px]" />
            <SearchBar className="flex-1" compact />
          </div>
          <ChipRow className="-mx-4 px-4">{filterChips}</ChipRow>
        </div>
      </SaffronHeader>

      <div className="mx-auto max-w-[1280px] px-4 pt-4 pb-8 lg:px-12 lg:pt-8">
        <div className="lg:grid lg:grid-cols-[1fr_440px] lg:gap-8">
          <div className="flex flex-col gap-3.5">
            <div className="hidden items-baseline gap-3 lg:flex">
              <h1 className="text-[38px] leading-none tracking-[-0.03em]">{title}</h1>
              {subtitle && <span className="text-[15px] font-bold text-body">{subtitle}</span>}
            </div>
            <div className="hidden flex-wrap gap-2 lg:flex">{filterChips}</div>
            {dietBanner}
            {relaxNote}
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <h1 className="font-display text-xl leading-tight font-extrabold tracking-[-0.02em]">{title}</h1>
              <Segmented label="View" value={view} onChange={setView} options={[{ value: 'list', label: 'List' }, { value: 'map', label: 'Map' }]} />
            </div>
            {!laptop && view === 'map' ? map : results}
          </div>
          {laptop && <div>{map}</div>}
        </div>
      </div>

      <FiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        values={filters}
        onApply={(next) => {
          const p = new URLSearchParams(params);
          for (const k of FILTER_KEYS) {
            if (next[k] == null || next[k] === '') p.delete(k);
            else p.set(k, next[k]);
          }
          setParams(p);
          setFiltersOpen(false);
        }}
        onClear={() => {
          setFiltersOpen(false);
          navigate(`/search?q=${encodeURIComponent(q)}`);
        }}
      />
    </div>
  );
}
