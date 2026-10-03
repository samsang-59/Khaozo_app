// Me hub `/me` — avatar, name, area + "since", rating count sticker; links to Taste profile,
// Wishlist, Notes, Past groups, Places I added, Settings (+ Admin for admins); About · Privacy · Terms.
import { useEffect } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { getStats, getContributions } from '@/api/journal.api.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useUserLocation } from '@/context/LocationContext.jsx';
import { useWishlist } from '@/hooks/useWishlist.js';
import { useNotes } from '@/hooks/useNotes.js';
import { SaffronHeader } from '@/components/layout/PageHeader.jsx';
import { Avatar } from '@/components/shared/Avatar.jsx';
import { Badge, Sticker } from '@/components/ui/Badge.jsx';
import { ListCard } from '@/components/ui/Card.jsx';
import { formatDate } from '@/lib/format.js';

function Row({ to, children }) {
  return (
    <Link to={to} className="flex items-center justify-between px-4 py-3.5 text-[15px] font-extrabold no-underline hover:bg-mixed">
      {children}
      <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
    </Link>
  );
}

export default function MePage() {
  const { user, isAdmin } = useAuth();
  const { label, hasChoice } = useUserLocation();
  const stats = useQuery({ queryKey: ['me', 'stats', 'all'], queryFn: () => getStats('all') });
  const contributions = useQuery({ queryKey: ['me', 'contributions'], queryFn: getContributions });
  const wishlist = useWishlist();
  const notes = useNotes();

  useEffect(() => {
    document.title = 'Me — Khaozo';
  }, []);

  const count = (q) => (q.data ? ` · ${q.data.length}` : '');
  const ratings = stats.data?.ratingsCount ?? 0;
  const top = stats.data?.topCuisine?.name;

  return (
    <div>
      <SaffronHeader>
        <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-5 pt-8 pb-6 lg:pt-12">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} src={user.avatarUrl} size={64} className="rounded-2xl shadow-hard-sm" />
            <div className="min-w-0">
              <h1 className="truncate text-[28px] leading-none tracking-[-0.03em] lg:text-[36px]">{user.name}</h1>
              <p className="pt-1 text-[13px] font-bold">
                {hasChoice ? `${label} · ` : ''}since {formatDate(user.createdAt, { month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {top && ratings >= 5 && <Sticker rotate={-2}>{top} lover</Sticker>}
            <Badge tone="white" className="border-2 px-2 py-0.5 text-[11px]">
              {ratings} rating{ratings === 1 ? '' : 's'}
            </Badge>
            {isAdmin && <Badge tone="ink" className="px-2 py-0.5 text-[11px]">Admin</Badge>}
          </div>
        </div>
      </SaffronHeader>
      <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-5 pt-5 pb-8">
        <ListCard>
          <Row to="/profile/taste">Taste profile</Row>
          <Row to="/wishlist">Want to try{count(wishlist)}</Row>
          <Row to="/notes">My notes{count(notes)}</Row>
          <Row to="/groups">Past groups</Row>
          <Row to="/journal?tab=contributions">Places I added{contributions.data ? ` · ${contributions.data.places.length}` : ''}</Row>
          <Row to="/settings">Settings</Row>
          {isAdmin && <Row to="/admin">Admin</Row>}
        </ListCard>
        <div className="flex gap-4 text-[13px]">
          <Link to="/about" className="link-plain">
            About
          </Link>
          <Link to="/privacy" className="link-plain">
            Privacy
          </Link>
          <Link to="/terms" className="link-plain">
            Terms
          </Link>
        </div>
      </div>
    </div>
  );
}
