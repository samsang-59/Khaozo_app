// Join group `/g/:code` — "Ankit invited you" + who's in; guests enter a display name (guest
// pass for this one group, kept per tab), or continue with Google. Ended / wrong code states.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { joinGroup, peekGroup } from '@/api/groups.api.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useGate } from '@/hooks/useGate.js';
import { getGroupSession, setGroupSession } from '@/hooks/useGroupRoom.js';
import { Avatar } from '@/components/shared/Avatar.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { GroupEnded } from '@/components/group/GroupEnded.jsx';
import { toastError } from '@/components/ui/toast.jsx';
import { firstName } from '@/lib/format.js';

export default function JoinGroupPage() {
  const { code: raw } = useParams();
  const code = raw.toUpperCase();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const peek = useQuery({ queryKey: ['group', code], queryFn: () => peekGroup(code), retry: false });

  useEffect(() => {
    document.title = 'Join group — Khaozo';
  }, []);

  // Already in this group (this tab has its pass, or you're a member) → straight to the room
  const group = peek.data;
  const alreadyIn = group && group.status !== 'done' && ((user && group.members.some((m) => m.id === `u${user.id}`)) || (!user && getGroupSession(code)?.guestPass));
  useEffect(() => {
    if (alreadyIn) navigate(`/g/${code}/room`, { replace: true });
  }, [alreadyIn, code, navigate]);

  const join = useMutation({
    mutationFn: (guestName) => joinGroup(code, guestName ? { name: guestName } : {}),
    onSuccess: (data) => {
      setGroupSession(code, { memberId: data.memberId, guestPass: data.guestPass ?? null });
      navigate(`/g/${code}/room`, { replace: true });
    },
    onError: toastError,
  });
  const signInAndJoin = useGate(`group:${code}:join`, () => join.mutate());

  if (peek.isError) return <GroupEnded title={peek.error?.code === 'GROUP_NOT_FOUND' ? 'This group has ended' : "Couldn't open this group"} message={peek.error?.message} />;
  if (group?.status === 'done') return <GroupEnded result={group.result} />;

  const host = group?.members.find((m) => m.isCreator);
  const full = group && group.members.length >= 10;

  return (
    <div className="flex min-h-dvh flex-col bg-saffron lg:items-center lg:justify-center lg:py-10">
      <div className="flex flex-1 flex-col lg:w-[520px] lg:flex-none lg:overflow-hidden lg:rounded-[22px] lg:border-2 lg:border-ink lg:shadow-hard-lg">
        <div className="flex flex-col gap-3 px-6 pt-7 pb-10 lg:bg-saffron">
          <Link to="/" className="font-display text-[22px] font-extrabold tracking-[-0.03em] no-underline">
            khaozo
          </Link>
          {!group ? (
            <Skeleton className="mt-4 h-24 bg-amber/60" />
          ) : (
            <>
              <p className="pt-4 font-display text-xs font-extrabold tracking-[0.08em] uppercase">{host ? `${firstName(host.name)} invited you to` : "You're invited to"}</p>
              <h1 className="text-[40px] leading-none tracking-[-0.04em] lg:text-[48px]">Group {code}</h1>
              <div className="flex items-center gap-3 pt-1">
                <div className="flex">
                  {group.members.slice(0, 5).map((m, i) => (
                    <Avatar key={m.id} name={m.name} guest={m.isGuest} tone={i === 1 ? 'amber' : 'cream'} size={36} className={i ? '-ml-2' : ''} />
                  ))}
                </div>
                <span className="text-[13px] font-extrabold">
                  {group.members.length} {group.members.length === 1 ? 'person is' : 'people are'} in
                </span>
              </div>
            </>
          )}
        </div>
        <div className="mt-auto flex flex-col gap-3 rounded-t-[26px] border-t-2 border-ink bg-cream px-6 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] lg:mt-0 lg:rounded-none">
          {full ? (
            <p className="text-sm font-bold">This group is full (10 people max).</p>
          ) : user ? (
            <>
              <h2 className="text-[22px] tracking-[-0.02em]">Join as {firstName(user.name)}</h2>
              <p className="text-[13px] font-semibold text-body">Your taste profile fills in your preferences — change them for this outing in the room.</p>
              <Button variant="primary" size="lg" block loading={join.isPending} disabled={!group} onClick={() => join.mutate()}>
                Join group
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-[22px] tracking-[-0.02em]">What should we call you?</h2>
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) join.mutate(name.trim());
                }}
              >
                <label className="text-[13px] font-extrabold" htmlFor="guest-name">
                  Your name
                </label>
                <Input id="guest-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Neha" shadow autoComplete="given-name" />
                <Button type="submit" variant="primary" size="lg" block disabled={!name.trim() || !group} loading={join.isPending}>
                  Join as guest
                </Button>
              </form>
              <div className="flex items-center gap-3 text-xs font-extrabold text-body">
                <span className="h-0.5 flex-1 bg-divider" />
                or
                <span className="h-0.5 flex-1 bg-divider" />
              </div>
              <Button size="lg" block onClick={signInAndJoin}>
                Continue with Google
              </Button>
              <p className="text-center text-xs font-bold text-body">Guests can vote. Sign in to use your taste profile for suggestions.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
