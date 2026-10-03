// My notes `/notes` — private notes on places and dishes; tap to edit (Note sheet).
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useNotes } from '@/hooks/useNotes.js';
import PageHeader, { Container } from '@/components/layout/PageHeader.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { buttonVariants } from '@/components/ui/Button.jsx';
import { EmptyState, ErrorState } from '@/components/shared/States.jsx';
import NoteSheet from '@/components/sheets/NoteSheet.jsx';
import { formatDate } from '@/lib/format.js';
import { cn } from '@/lib/cn.js';

const titleFor = (n) => (n.menuItemId ? `${n.menuItemPlaceName ?? ''} · ${n.menuItemName}` : n.placeName);

export default function NotesPage() {
  const q = useNotes();
  const [editing, setEditing] = useState(null);
  useEffect(() => {
    document.title = 'My notes — Khaozo';
  }, []);

  return (
    <Container className="max-w-[760px] px-0 lg:px-5">
      <PageHeader title="My notes" right={<Badge tone="outline" className="border-2 px-2 py-0.5">Private</Badge>} />
      <div className="flex flex-col gap-3 px-5 pb-8 lg:px-0">
        {q.isPending ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : q.data.length === 0 ? (
          <EmptyState title="No notes yet" message="Add a private note on any place or dish — “ask for less oil”, “corner table has a plug”. Only you see them.">
            <Link to="/" className={buttonVariants({ variant: 'primary' })}>
              Find a place
            </Link>
          </EmptyState>
        ) : (
          q.data.map((n, i) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setEditing(n)}
              className={cn('press flex flex-col gap-1.5 rounded-2xl border-2 border-ink bg-card px-4 py-3 text-left', i === 0 && 'shadow-hard')}
            >
              <span className="flex w-full items-baseline justify-between gap-3">
                <span className="truncate text-xs font-extrabold tracking-[0.04em] text-muted uppercase">{titleFor(n)}</span>
                <span className="shrink-0 text-xs font-bold text-body">{formatDate(n.updatedAt)}</span>
              </span>
              <span className="text-[15px] leading-snug font-bold whitespace-pre-line">{n.text}</span>
            </button>
          ))
        )}
      </div>
      <NoteSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        existing={editing}
        target={editing?.placeId ? { placeId: editing.placeId } : { menuItemId: editing?.menuItemId }}
        subtitle={editing ? titleFor(editing) : ''}
      />
    </Container>
  );
}
