// Who's in: avatar (guests dashed), name · host / guest, status sticker
import { Avatar } from '@/components/shared/Avatar.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { firstName } from '@/lib/format.js';

const statusOf = (m, voting) => {
  if (!m.connected) return ['white', 'Offline'];
  if (voting) return m.hasVoted ? ['green', 'Voted'] : ['white', 'Thinking'];
  return m.ready ? ['green', 'Ready'] : ['amber', 'Choosing'];
};

export function MemberList({ members, voting = false, meId }) {
  return (
    <ul className="overflow-hidden rounded-2xl border-2 border-ink bg-card [&>*+*]:border-t-2 [&>*+*]:border-ink">
      {members.map((m, i) => {
        const [tone, label] = statusOf(m, voting);
        return (
          <li key={m.id} className="flex items-center gap-3 px-3.5 py-2.5">
            <Avatar name={m.name} guest={m.isGuest} tone={i % 3 === 1 ? 'amber' : 'white'} size={36} />
            <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">
              {firstName(m.name)}
              {m.id === meId && ' (you)'}
              <span className="font-bold text-body">{m.isCreator ? ' · host' : m.isGuest ? ' · guest' : ''}</span>
            </span>
            <Badge tone={tone}>{label}</Badge>
          </li>
        );
      })}
    </ul>
  );
}
