// Group hub `/groups` — Start a group · Join with a code · Past groups
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createGroup, listMyGroups } from '@/api/groups.api.js';
import { setGroupSession } from '@/hooks/useGroupRoom.js';
import { SaffronHeader } from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { ListCard } from '@/components/ui/Card.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { SectionTitle } from '@/components/shared/SectionTitle.jsx';
import { JoinCodeInput, CODE_LENGTH } from '@/components/group/JoinCodeInput.jsx';
import { toastError } from '@/components/ui/toast.jsx';
import { formatDate } from '@/lib/format.js';

export default function GroupHubPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const history = useQuery({ queryKey: ['me', 'groups'], queryFn: listMyGroups });

  useEffect(() => {
    document.title = 'Group — Khaozo';
  }, []);

  const start = useMutation({
    mutationFn: () => createGroup(),
    onSuccess: (data) => {
      setGroupSession(data.code, { memberId: data.memberId });
      navigate(`/g/${data.code}/room`);
    },
    onError: toastError,
  });
  const join = (c = code) => c.length === CODE_LENGTH && navigate(`/g/${c}`);

  return (
    <div>
      <SaffronHeader>
        <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-5 pt-8 pb-6 lg:pt-12 lg:pb-10">
          <h1 className="text-[34px] leading-none tracking-[-0.03em] lg:text-[56px]">Where are we eating?</h1>
          <p className="text-[15px] leading-snug font-bold">Start a group, everyone adds what they want, Khaozo suggests places, you vote.</p>
          <Button variant="dark" size="lg" className="shadow-hard-cream lg:w-[320px]" loading={start.isPending} onClick={() => start.mutate()}>
            Start a group
          </Button>
        </div>
      </SaffronHeader>
      <div className="mx-auto flex max-w-[760px] flex-col gap-7 px-5 pt-6 pb-8">
        <section className="flex flex-col gap-3">
          <SectionTitle>Join with a code</SectionTitle>
          <form
            className="flex gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              join();
            }}
          >
            <div className="flex-1">
              <JoinCodeInput value={code} onChange={setCode} onComplete={join} />
            </div>
            <Button type="submit" className="h-[50px] w-[70px]" disabled={code.length !== CODE_LENGTH}>
              Join
            </Button>
          </form>
        </section>
        <section className="flex flex-col gap-3">
          <SectionTitle>Past groups</SectionTitle>
          {history.isPending ? (
            <Skeleton className="h-20 rounded-2xl" />
          ) : !history.data?.length ? (
            <p className="text-sm font-semibold text-body">Groups you finish show up here with the place you picked.</p>
          ) : (
            <ListCard>
              {history.data.map((g) => (
                <Link key={g.id} to={`/places/${g.placeId}`} className="flex items-start justify-between gap-3 px-4 py-3 no-underline hover:bg-mixed">
                  <span>
                    <span className="block font-display text-base font-extrabold">{g.locationLabel ? `Near ${g.locationLabel}` : `Group ${g.code}`}</span>
                    <span className="block text-[13px] font-bold text-body">
                      {g.memberCount + g.guestCount} people · Won: {g.placeName}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-extrabold">{formatDate(g.endedAt)}</span>
                </Link>
              ))}
            </ListCard>
          )}
        </section>
      </div>
    </div>
  );
}
