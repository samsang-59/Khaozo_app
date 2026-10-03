// Suggestion + live vote bar. Leader's bar is saffron, others ink. My vote = ink "✓ Your vote".
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button.jsx';
import { MatchBadge } from '@/components/ui/Badge.jsx';
import { cn } from '@/lib/cn.js';

export function SuggestionCard({ s, votes, maxVotes, totalMembers, leader, mine, onVote, voting, rank }) {
  const pct = totalMembers ? Math.round((votes / totalMembers) * 100) : 0;
  return (
    <article className={cn('flex flex-col gap-2 rounded-2xl border-2 border-ink bg-card p-4', leader && votes > 0 && 'shadow-hard')}>
      <div className="flex items-start justify-between gap-3">
        <Link to={`/places/${s.placeId}`} target="_blank" className="font-display text-[19px] leading-tight font-extrabold tracking-[-0.02em] no-underline lg:text-[22px]">
          <span className="sr-only">#{rank} </span>
          {s.name}
        </Link>
        <MatchBadge pct={s.matchPct} className="shrink-0" />
      </div>
      <p className="text-[13px] leading-snug font-bold text-body">{s.reason}</p>
      <div className="flex items-center gap-3">
        <div className="h-3.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-card" aria-hidden>
          <div className={cn('h-full transition-[width] duration-300', leader && votes === maxVotes && votes > 0 ? 'bg-saffron' : 'bg-ink')} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-16 shrink-0 font-display text-sm font-extrabold">
          {votes} vote{votes === 1 ? '' : 's'}
        </span>
      </div>
      <Button variant={mine ? 'dark' : 'secondary'} block onClick={onVote} disabled={voting} aria-pressed={mine}>
        {mine ? '✓ Your vote' : 'Vote'}
      </Button>
    </article>
  );
}
