// "Rate a dish → pick the place first" / "Review a place": nearby places + name search.
// Picking one opens its place page with the Rate / Review sheet already open.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { listPlaces } from '@/api/places.api.js';
import { useUi } from '@/context/UiContext.jsx';
import { CITY_CENTRE, useUserLocation } from '@/context/LocationContext.jsx';
import { Sheet } from '@/components/ui/Sheet.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { ListCard } from '@/components/ui/Card.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { formatDistance, joinMeta } from '@/lib/format.js';
import { useDebounced } from '@/hooks/useDebounced.js';

export default function PlacePickerSheet() {
  const { placePicker, setPlacePicker } = useUi();
  const { centre } = useUserLocation();
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 250);
  const navigate = useNavigate();
  const open = !!placePicker;

  const { data, isPending } = useQuery({
    queryKey: ['places', 'picker', centre, term],
    queryFn: () => listPlaces({ ...(centre ?? CITY_CENTRE), radius: term ? 20000 : 3000, q: term || undefined, limit: 15 }),
    enabled: open,
  });

  const pick = (place) => {
    const action = placePicker;
    setPlacePicker(null);
    setQ('');
    navigate(`/places/${place.id}`, { state: { open: action } });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && setPlacePicker(null)}
      title={placePicker === 'review' ? 'Which place?' : 'Where did you eat?'}
      subtitle="Nearby first — or type the name."
    >
      <div className="flex flex-col gap-3 pb-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search places by name…" aria-label="Search places" autoFocus />
        {isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14" />
            <Skeleton alt className="h-14" />
          </div>
        ) : data?.items?.length ? (
          <ListCard>
            {data.items.map((p) => (
              <button key={p.id} type="button" onClick={() => pick(p)} className="flex w-full flex-col items-start px-4 py-3 text-left hover:bg-mixed">
                <span className="font-display text-base font-extrabold tracking-[-0.01em]">{p.name}</span>
                <span className="text-xs font-semibold text-body">{joinMeta(p.area?.name, formatDistance(p.distanceM))}</span>
              </button>
            ))}
          </ListCard>
        ) : (
          <p className="text-sm font-semibold text-body">No places match. You can add it from the + menu.</p>
        )}
      </div>
    </Sheet>
  );
}
