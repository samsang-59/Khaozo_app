import { useQuery } from '@tanstack/react-query';
import { listNotes } from '@/api/notes.api.js';
import { useAuth } from '@/context/AuthContext.jsx';

export function useNotes() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['me', 'notes'], queryFn: listNotes, enabled: !!user, staleTime: 30 * 1000 });
}

// My note on a place / dish (one per target in practice — the newest)
export function useMyNote({ placeId, menuItemId }) {
  const { data = [] } = useNotes();
  return data.find((n) => (placeId ? n.placeId === placeId : n.menuItemId === menuItemId)) ?? null;
}
