// Group room `/g/:code/room` — one route, states driven by socket snapshots:
// lobby (code, Share on WhatsApp, who's in, search around, prefs) → choosing → voting (live
// bars) → winner (Open in Maps) · ended. "Reconnecting…" banner when the socket drops.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext.jsx';
import { useUserLocation } from '@/context/LocationContext.jsx';
import { useGroupRoom, setGroupSession } from '@/hooks/useGroupRoom.js';
import { BackButton } from '@/components/layout/PageHeader.jsx';
import { Button, buttonVariants } from '@/components/ui/Button.jsx';
import { Segmented } from '@/components/ui/Segmented.jsx';
import { Chip } from '@/components/ui/Chip.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { MemberList } from '@/components/group/MemberList.jsx';
import { SuggestionCard } from '@/components/group/SuggestionCard.jsx';
import { PreferencesSheet } from '@/components/group/PreferencesSheet.jsx';
import { WinnerCard } from '@/components/group/WinnerCard.jsx';
import { GroupEnded } from '@/components/group/GroupEnded.jsx';
import { CopyLinkButton, WhatsAppButton } from '@/components/shared/ShareButton.jsx';
import MapView from '@/components/map/MapView.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';
import { cn } from '@/lib/cn.js';

const SPOTS = ['Patia', 'KIIT', 'Saheed Nagar', 'Jaydev Vihar', 'Old Town', 'Chandrasekharpur'];

function ConnectionBanner({ status }) {
  if (status !== 'reconnecting') return null;
  return (
    <div role="status" className="fixed inset-x-0 top-3 z-50 mx-auto w-fit rounded-xl border-2 border-ink bg-card px-4 py-2 text-sm font-extrabold shadow-hard">
      <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden />
      Reconnecting…
    </div>
  );
}

// Host: Everyone's midpoint / Pick a spot (area pins or my location)
function LocationChooser({ group, isCreator, onSet }) {
  const { areas, coords, askLocation } = useUserLocation();
  const loc = group.location;
  const mode = loc?.mode ?? null;
  const [choice, setChoice] = useState(mode === 'midpoint' ? 'midpoint' : 'spot');
  if (!isCreator) {
    return (
      <p className="text-[13px] font-bold text-body">
        {mode === 'spot' ? `Host picked: near ${loc.label}` : mode === 'midpoint' ? "Host picked: everyone's midpoint" : 'The host picks where to search.'}
      </p>
    );
  }
  const spotAreas = SPOTS.map((n) => areas.find((a) => a.name === n)).filter(Boolean);
  return (
    <div className="flex flex-col gap-2.5">
      <Segmented
        block
        size="md"
        label="Search around"
        value={choice}
        onChange={(v) => {
          setChoice(v);
          if (v === 'midpoint') onSet({ mode: 'midpoint' });
        }}
        options={[
          { value: 'midpoint', label: "Everyone's midpoint" },
          { value: 'spot', label: 'Pick a spot' },
        ]}
      />
      {choice === 'midpoint' && <p className="text-[13px] font-bold text-body">Uses the locations people share with their preferences (never shown to others).</p>}
      {choice === 'spot' && (
        <div className="flex flex-wrap gap-2">
          {spotAreas.map((a) => (
            <Chip key={a.id} size="sm" selected={mode === 'spot' && loc.label === a.name} onClick={() => onSet({ mode: 'spot', lat: a.lat, lng: a.lng, label: a.name })}>
              {a.name}
            </Chip>
          ))}
          <Chip
            size="sm"
            selected={mode === 'spot' && loc.label === 'Host location'}
            onClick={async () => {
              const c = coords ?? (await askLocation());
              if (c) onSet({ mode: 'spot', lat: c.lat, lng: c.lng, label: 'Host location' });
              else toast.info('Location is off — pick an area instead.');
            }}
          >
            My location
          </Chip>
        </div>
      )}
    </div>
  );
}

function Lobby({ room, code, onPrefs }) {
  const { group, isCreator, me } = room;
  const joinUrl = `${window.location.origin}/g/${code}`;
  const canSuggest = group.readyCount >= 2 && !!group.location;
  const busy = group.status === 'choosing';
  const [starting, setStarting] = useState(false);

  const start = async () => {
    setStarting(true);
    const res = await room.startSuggestions();
    setStarting(false);
    if (!res.ok) toastError(res.error);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="border-b-2 border-ink bg-saffron">
        <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-5 pt-5 pb-5 lg:pt-10">
          <div className="flex items-center justify-between">
            <BackButton fallback="/groups" />
            <button type="button" className="link-plain text-[13px]" onClick={room.onLeave}>
              Leave group
            </button>
          </div>
          <h1 className="text-[30px] leading-none tracking-[-0.03em] lg:text-[44px]">Group {code}</h1>
          <div className="flex gap-2.5">
            <div className="rounded-xl border-2 border-ink bg-cream px-3 py-1.5">
              <p className="font-display text-[10px] font-extrabold tracking-[0.06em] uppercase">Code</p>
              <p className="font-display text-[22px] leading-none font-extrabold tracking-[0.14em]">{code}</p>
            </div>
            <WhatsAppButton text={`Where are we eating? Join my Khaozo group: ${joinUrl}`} className="flex-1 text-sm" size="lg" />
          </div>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 px-5 pt-5 pb-32">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl tracking-[-0.02em]">Who's in · {group.members.length}</h2>
          <span className="text-[13px] font-extrabold">{group.readyCount} ready</span>
        </div>
        <MemberList members={group.members} meId={me?.id} />
        <CopyLinkButton url={joinUrl}>Copy invite link</CopyLinkButton>
        <h2 className="text-xl tracking-[-0.02em]">Search around</h2>
        <LocationChooser
          group={group}
          isCreator={isCreator}
          onSet={async (loc) => {
            const res = await room.setLocation(loc);
            if (!res.ok) toastError(res.error);
          }}
        />
        {busy && (
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Finding places for everyone…
          </p>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-cream">
        <div className="mx-auto flex max-w-[760px] gap-2.5 px-5 pt-3 pb-[max(14px,env(safe-area-inset-bottom))]">
          <Button size="lg" className="w-[34%]" onClick={onPrefs}>
            {me?.ready ? 'Edit prefs' : 'My prefs'}
          </Button>
          {isCreator ? (
            <Button variant="primary" size="lg" className="flex-1" disabled={!canSuggest || busy} loading={starting || busy} onClick={start}>
              Get suggestions
            </Button>
          ) : (
            <Button variant={me?.ready ? 'secondary' : 'primary'} size="lg" className="flex-1" onClick={onPrefs} disabled={me?.ready}>
              {me?.ready ? 'Ready ✓ · waiting for host' : "I'm ready"}
            </Button>
          )}
        </div>
        {isCreator && !canSuggest && (
          <p className="pb-2 text-center text-xs font-bold text-body">{group.readyCount < 2 ? 'Needs at least 2 people ready' : 'Pick where to search first'}</p>
        )}
      </div>
    </div>
  );
}

function Voting({ room, code }) {
  const { group, isCreator, myVote } = room;
  const [pending, setPending] = useState(false);
  const counts = group.voteCounts ?? {};
  const maxVotes = Math.max(0, ...Object.values(counts));
  const votedCount = group.members.filter((m) => m.hasVoted).length;
  const pins = useMemo(
    () => group.suggestions.map((s, i) => ({ id: s.placeId, lat: s.location.lat, lng: s.location.lng, alwaysLabel: `${i + 1} · ${s.name}`, tone: i === 0 ? null : 'white' })),
    [group.suggestions],
  );
  const centre = group.location?.lat != null ? { lat: group.location.lat, lng: group.location.lng } : null;

  const vote = async (placeId) => {
    setPending(true);
    const res = await room.vote(placeId);
    setPending(false);
    if (!res.ok) toastError(res.error);
  };
  const end = async () => {
    const res = await room.finish();
    if (!res.ok) toastError(res.error);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="border-b-2 border-ink bg-saffron">
        <div className="mx-auto flex max-w-[1180px] items-end justify-between gap-3 px-5 pt-6 pb-5 lg:px-12 lg:pt-12 lg:pb-8">
          <div>
            <p className="font-display text-xs font-extrabold tracking-[0.08em] uppercase">Group {code}</p>
            <h1 className="pt-1 text-[30px] leading-none tracking-[-0.03em] lg:text-[64px] lg:tracking-[-0.04em]">Vote for one</h1>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="sticker-label rounded-[10px] border-2 border-ink bg-cream px-2.5 py-1.5 text-xs lg:text-[15px]">
              {votedCount} of {group.members.length} voted
            </span>
            {isCreator && (
              <Button variant="dark" className="hidden lg:inline-flex" onClick={end}>
                End voting now
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-[1180px] flex-1 gap-6 px-5 pt-5 pb-32 lg:grid-cols-[260px_1fr_360px] lg:px-12 lg:pt-8 lg:pb-12">
        <div className="hidden flex-col gap-3 lg:flex">
          <h2 className="text-xl tracking-[-0.02em]">Who's in · {group.members.length}</h2>
          <MemberList members={group.members} voting meId={room.me?.id} />
          <WhatsAppButton text={`Vote with us on Khaozo: ${window.location.origin}/g/${code}`} size="md" />
        </div>
        <div className="flex flex-col gap-3">
          {group.suggestions.map((s, i) => (
            <SuggestionCard
              key={s.placeId}
              s={s}
              rank={i + 1}
              votes={counts[s.placeId] ?? 0}
              maxVotes={maxVotes}
              totalMembers={group.members.length}
              leader={(counts[s.placeId] ?? 0) === maxVotes}
              mine={myVote === s.placeId}
              voting={pending}
              onVote={() => vote(s.placeId)}
            />
          ))}
        </div>
        <div className="hidden lg:block">
          <MapView pins={pins} centre={centre} className="sticky top-6 h-[460px]" />
        </div>
      </div>
      {isCreator && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-cream px-5 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] lg:hidden">
          <Button variant="dark" size="lg" block onClick={end}>
            End voting now · host
          </Button>
        </div>
      )}
    </div>
  );
}

export default function GroupRoomPage() {
  const { code: raw } = useParams();
  const code = raw.toUpperCase();
  const { user } = useAuth();
  const navigate = useNavigate();
  const room = useGroupRoom(code);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    document.title = `Group ${code} — Khaozo`;
  }, [code]);

  // Not a member of this group in this tab → go to the join page
  useEffect(() => {
    if (room.status === 'error' && room.error?.code === 'NOT_A_MEMBER') navigate(`/g/${code}`, { replace: true });
  }, [room.status, room.error, code, navigate]);

  const onLeave = async () => {
    const res = await room.leave();
    if (!res.ok && res.error?.code !== 'OFFLINE') return toastError(res.error);
    setGroupSession(code, null);
    navigate(user ? '/groups' : '/', { replace: true });
  };

  const { group, status } = room;

  if (status === 'ended') return <GroupEnded />;
  if (status === 'error' && room.error?.code !== 'NOT_A_MEMBER') {
    return (
      <div className="flex min-h-dvh flex-col items-start justify-center gap-4 px-6">
        <h1 className="text-3xl tracking-[-0.03em]">Couldn't open the group</h1>
        <p className="font-bold text-body">{room.error?.message}</p>
        <Link to="/groups" className={buttonVariants({ variant: 'primary' })}>
          Back to groups
        </Link>
      </div>
    );
  }
  if (!group) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-48 rounded-none bg-saffron/70" />
        <div className="flex flex-col gap-3 px-5">
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (group.status === 'done' && group.result) {
    return (
      <WinnerCard
        result={group.result}
        code={code}
        votesTotal={Object.values(group.voteCounts ?? {}).reduce((a, b) => a + b, 0)}
        members={group.members.length}
        savedToHistory={!!user}
      />
    );
  }

  return (
    <div className={cn('bg-cream')}>
      <ConnectionBanner status={status} />
      {group.status === 'voting' ? <Voting room={room} code={code} /> : <Lobby room={{ ...room, onLeave }} code={code} onPrefs={() => setPrefsOpen(true)} />}
      <PreferencesSheet
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        signedIn={!!user}
        submitting={savingPrefs}
        onSubmit={async (prefs) => {
          setSavingPrefs(true);
          const res = await room.setPreferences(prefs);
          setSavingPrefs(false);
          if (res.ok) {
            setPrefsOpen(false);
            toast.success("You're ready");
          } else toastError(res.error);
        }}
      />
    </div>
  );
}
