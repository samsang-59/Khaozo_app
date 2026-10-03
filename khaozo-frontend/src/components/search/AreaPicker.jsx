// "Where are you eating?" — popular areas as chips, search all areas, or use my location
import { useMemo, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { useUserLocation } from '@/context/LocationContext.jsx';
import { Chip } from '@/components/ui/Chip.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { toast } from '@/components/ui/toast.jsx';

const POPULAR = ['Patia', 'KIIT', 'Saheed Nagar', 'Old Town', 'Jaydev Vihar', 'Chandrasekharpur', 'Nayapalli', 'Khandagiri'];

export default function AreaPicker({ onDone, showSearch = true }) {
  const { areas, area, mode, chooseArea, askLocation, status } = useUserLocation();
  const [q, setQ] = useState('');

  const popular = useMemo(() => POPULAR.map((n) => areas.find((a) => a.name === n)).filter(Boolean), [areas]);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return areas.filter((a) => a.name.toLowerCase().includes(t)).slice(0, 12);
  }, [areas, q]);

  const pick = (a) => {
    chooseArea(a);
    onDone?.();
  };

  const useMine = async () => {
    const c = await askLocation();
    if (c) onDone?.();
    else toast.info('Location is off. Turn it on in your browser settings, or pick an area.');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(matches.length ? matches : popular).map((a) => (
          <Chip key={a.id} selected={mode === 'area' && area?.id === a.id} onClick={() => pick(a)}>
            {a.name}
          </Chip>
        ))}
      </div>
      {showSearch && (
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all areas…" aria-label="Search areas" className="h-11" />
      )}
      <Button block onClick={useMine} loading={status === 'asking'}>
        <LocateFixed className="size-4" aria-hidden /> Use my location
      </Button>
    </div>
  );
}
