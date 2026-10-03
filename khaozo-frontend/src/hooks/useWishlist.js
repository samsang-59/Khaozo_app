// Wishlist ("Want to try") — saved places / dishes. Logged-out → no list (heart opens login).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addToWishlist, listWishlist, removeFromWishlist } from '@/api/wishlist.api.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';

export const WISHLIST_KEY = ['me', 'wishlist'];

export function useWishlist() {
  const { user } = useAuth();
  return useQuery({ queryKey: WISHLIST_KEY, queryFn: listWishlist, enabled: !!user, staleTime: 30 * 1000 });
}

// target: { placeId } | { menuItemId }
export function useWishlistToggle(target) {
  const qc = useQueryClient();
  const { data: list = [] } = useWishlist();
  const kind = target.placeId ? 'place' : 'menu_item';
  const id = target.placeId ?? target.menuItemId;
  const saved = list.find((w) => w.target?.kind === kind && w.target?.id === id) ?? null;

  const m = useMutation({
    mutationFn: () => (saved ? removeFromWishlist(saved.id) : addToWishlist(target)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WISHLIST_KEY });
      toast.success(saved ? 'Removed from Want to try' : 'Saved to Want to try');
    },
    onError: (err) => (err.code === 'ALREADY_IN_WISHLIST' ? qc.invalidateQueries({ queryKey: WISHLIST_KEY }) : toastError(err)),
  });
  return { saved: !!saved, toggle: () => m.mutate(), pending: m.isPending };
}
