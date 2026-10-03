// My journal `/journal` — Timeline · My Stats · My Contributions (plan). Saffron header with
// the all-time numbers and Share (public journal link, or a nudge to make it public).
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Share2 } from 'lucide-react';
import { getContributions, getJournal, getStats } from '@/api/journal.api.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { SaffronHeader } from '@/components/layout/PageHeader.jsx';
import { Segmented } from '@/components/ui/Segmented.jsx';
import { Chip } from '@/components/ui/Chip.jsx';
import { Button, buttonVariants } from '@/components/ui/Button.jsx';
import { ListCard } from '@/components/ui/Card.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { StatStrip } from '@/components/shared/StatStrip.jsx';
import { EmptyState, ErrorState } from '@/components/shared/States.jsx';
import { TimelineCard, groupByMonth } from '@/components/journal/TimelineCard.jsx';
import { StatsTiles } from '@/components/journal/StatsTiles.jsx';
import { DishContribution, PlaceContribution, ReportContribution } from '@/components/journal/ContributionItem.jsx';
import { shareLink } from '@/components/shared/ShareButton.jsx';
import { toast } from '@/components/ui/toast.jsx';

const TABS = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'stats', label: 'My Stats' },
  { value: 'contributions', label: 'Contributions' },
];

function Timeline() {
  const [filter, setFilter] = useState('all');
  const q = useInfiniteQuery({
    queryKey: ['me', 'journal'],
    queryFn: ({ pageParam }) => getJournal({ limit: 20, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const cards = useMemo(() => {
    const all = q.data?.pages.flatMap((p) => p.items) ?? [];
    if (filter === 'again') return all.filter((c) => c.entries.some((e) => e.wouldOrderAgain));
    if (filter === 'photos') return all.filter((c) => c.entries.some((e) => e.photos?.length));
    return all;
  }, [q.data, filter]);

  if (q.isPending) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton alt className="h-24 rounded-2xl" />
      </div>
    );
  }
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  if (!q.data.pages[0].items.length) {
    return (
      <EmptyState title="Your journal is empty" message="Rate a dish and it lands here — what you ate, where, and whether you'd order it again.">
        <Link to="/" className={buttonVariants({ variant: 'primary' })}>
          Find something to eat
        </Link>
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </Chip>
        <Chip selected={filter === 'again'} onClick={() => setFilter('again')}>
          Would order again
        </Chip>
        <Chip selected={filter === 'photos'} onClick={() => setFilter('photos')}>
          With photos
        </Chip>
      </div>
      {groupByMonth(cards).map((g, gi) => (
        <section key={g.label} className="flex flex-col gap-3">
          <h2 className="font-display text-xs font-extrabold tracking-[0.08em] text-muted">{g.label}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {g.cards.map((c, i) => (
              <TimelineCard key={`${c.place.id}-${c.startedAt}`} card={c} primary={gi === 0 && i === 0} />
            ))}
          </div>
        </section>
      ))}
      {cards.length === 0 && <p className="text-sm font-semibold text-body">Nothing matches this filter yet.</p>}
      {q.hasNextPage && (
        <Button block onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage}>
          Load more
        </Button>
      )}
    </div>
  );
}

function Stats() {
  const [period, setPeriod] = useState('all');
  const q = useQuery({ queryKey: ['me', 'stats', period], queryFn: () => getStats(period) });
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Period"
        size="md"
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'all', label: 'All time' },
          { value: 'month', label: 'This month' },
        ]}
      />
      {q.isPending ? <Skeleton className="h-40 rounded-2xl" /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : <StatsTiles stats={q.data} />}
    </div>
  );
}

function Contributions() {
  const q = useQuery({ queryKey: ['me', 'contributions'], queryFn: getContributions });
  if (q.isPending) return <Skeleton className="h-40 rounded-2xl" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const { places, dishes, reports } = q.data;
  if (!places.length && !dishes.length && !reports.length) {
    return (
      <EmptyState title="Nothing added yet" message="Places you add, new dishes and reports you send show up here — with whether they got verified or accepted.">
        <Link to="/places/new" className={buttonVariants({ variant: 'primary' })}>
          Add a missing place
        </Link>
      </EmptyState>
    );
  }
  const section = (title, items, render) =>
    items.length > 0 && (
      <section className="flex flex-col gap-2">
        <h2 className="text-lg tracking-[-0.02em]">
          {title} · {items.length}
        </h2>
        <ListCard>{items.map(render)}</ListCard>
      </section>
    );
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {section('Places I added', places, (p) => <PlaceContribution key={p.id} place={p} />)}
      {section('Dishes I added', dishes, (d) => <DishContribution key={d.id} dish={d} />)}
      {section('Reports', reports, (r) => <ReportContribution key={r.id} report={r} />)}
    </div>
  );
}

export default function JournalPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'timeline';
  const setTab = (t) => setParams(t === 'timeline' ? {} : { tab: t }, { replace: true });
  const stats = useQuery({ queryKey: ['me', 'stats', 'all'], queryFn: () => getStats('all') });

  useEffect(() => {
    document.title = 'My journal — Khaozo';
  }, []);

  const share = () => {
    if (user.journalVisibility !== 'public') {
      toast.info('Your journal is private. Turn on "Public journal" in Settings to share it.');
      navigate('/settings');
      return;
    }
    shareLink({ url: `${window.location.origin}/u/${user.id}`, title: `${user.name}'s food journal`, text: `My food journal on Khaozo` });
  };

  const s = stats.data;
  const strip = (
    <StatStrip
      tone="cream"
      items={[
        { value: s?.dishesTried ?? '–', label: 'dishes rated' },
        { value: s?.placesTried ?? '–', label: 'places' },
        { value: s?.topCuisine?.name ?? '–', label: 'top cuisine' },
      ]}
    />
  );

  return (
    <div>
      <SaffronHeader>
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-5 pt-6 pb-5 lg:flex-row lg:items-end lg:justify-between lg:px-12 lg:pt-12 lg:pb-10">
          <div className="flex items-center justify-between">
            <h1 className="text-[34px] leading-none tracking-[-0.03em] lg:text-[64px] lg:tracking-[-0.04em]">My journal</h1>
            <button type="button" onClick={share} className="press inline-flex items-center gap-1.5 rounded-[10px] border-2 border-ink bg-cream px-3 py-1.5 text-[13px] font-extrabold lg:hidden">
              <Share2 className="size-3.5" aria-hidden /> Share
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 lg:w-[480px]">{strip}</div>
            <Button variant="dark" className="hidden lg:inline-flex" onClick={share}>
              <Share2 className="size-4" aria-hidden /> Share journal
            </Button>
          </div>
        </div>
      </SaffronHeader>
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-5 pt-5 pb-8 lg:px-12 lg:pt-8">
        <Segmented block size="md" label="Journal sections" value={tab} onChange={setTab} options={TABS} className="lg:w-[480px] lg:flex-none" />
        {tab === 'timeline' && <Timeline />}
        {tab === 'stats' && <Stats />}
        {tab === 'contributions' && <Contributions />}
      </div>
    </div>
  );
}
