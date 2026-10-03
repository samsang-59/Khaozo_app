// Wishlist `/wishlist` ("Want to try") — Dishes · Places tabs; ♥ removes; "Tried ✓" once rated.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { removeFromWishlist } from '@/api/wishlist.api.js';
import { useWishlist, WISHLIST_KEY } from '@/hooks/useWishlist.js';
import PageHeader, { Container } from '@/components/layout/PageHeader.jsx';
import { Segmented } from '@/components/ui/Segmented.jsx';
import { Photo } from '@/components/ui/Card.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { buttonVariants } from '@/components/ui/Button.jsx';
import { EmptyState, ErrorState } from '@/components/shared/States.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';
import { formatDate } from '@/lib/format.js';
import { cn } from '@/lib/cn.js';

const hrefFor = (t) => (t.kind === 'place' ? `/places/${t.id}` : t.kind === 'menu_item' ? `/menu-items/${t.id}` : `/dishes/${t.id}`);
const subFor = (t) => (t.kind === 'menu_item' ? t.place?.name : t.kind === 'standard_dish' ? 'Any place · see the best' : t.area ?? 'Place');

function Item({ item, primary }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => removeFromWishlist(item.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WISHLIST_KEY });
      toast.success('Removed from Want to try');
    },
    onError: toastError,
  });
  const t = item.target;
  return (
    <div className={cn('flex items-center gap-3.5 rounded-2xl border-2 border-ink bg-card p-3', primary && 'shadow-hard')}>
      <Link to={hrefFor(t)} className="flex min-w-0 flex-1 items-center gap-3.5 no-underline">
        <Photo className="size-16 shrink-0 rounded-xl border-2 border-ink" label="Photo" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-display text-base leading-tight font-extrabold tracking-[-0.01em]">{t.name}</span>
          <span className="truncate text-[13px] font-bold text-body">{subFor(t)}</span>
          <span>{item.triedAt ? <Badge tone="green">Tried ✓ {formatDate(item.triedAt)}</Badge> : <Badge tone="white">Saved {formatDate(item.createdAt)}</Badge>}</span>
        </span>
      </Link>
      <button type="button" aria-label={`Remove ${t.name}`} disabled={remove.isPending} onClick={() => remove.mutate()} className="p-2">
        <Heart className="size-5 fill-ink" />
      </button>
    </div>
  );
}

export default function WishlistPage() {
  const q = useWishlist();
  const [tab, setTab] = useState('dishes');
  useEffect(() => {
    document.title = 'Want to try — Khaozo';
  }, []);
  const all = q.data ?? [];
  const dishes = all.filter((w) => w.target?.kind !== 'place');
  const places = all.filter((w) => w.target?.kind === 'place');
  const shown = tab === 'dishes' ? dishes : places;

  return (
    <Container className="max-w-[760px] px-0 lg:px-5">
      <PageHeader title="Want to try" />
      <div className="flex flex-col gap-4 px-5 pb-8 lg:px-0">
        <Segmented
          block
          size="md"
          label="Saved"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'dishes', label: `Dishes · ${dishes.length}` },
            { value: 'places', label: `Places · ${places.length}` },
          ]}
        />
        {q.isPending ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState title={tab === 'dishes' ? 'No dishes saved' : 'No places saved'} message="Tap ♡ on a dish or a place to keep it here for later.">
            <Link to="/" className={buttonVariants({ variant: 'primary' })}>
              Explore
            </Link>
          </EmptyState>
        ) : (
          shown.map((w, i) => <Item key={w.id} item={w} primary={i === 0} />)
        )}
      </div>
    </Container>
  );
}
