// Add opening hours (only when a place has none): same every day / different by day,
// opens / closes, closed-on days.
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setHours } from '@/api/places.api.js';
import { Sheet } from '@/components/ui/Sheet.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Segmented } from '@/components/ui/Segmented.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';
import { DAY_LETTER, dayName } from '@/lib/format.js';
import { cn } from '@/lib/cn.js';

const DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon first

function TimeInput({ label, value, onChange }) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="field-label">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[52px] rounded-xl border-2 border-ink bg-card px-3 font-display text-xl font-extrabold"
      />
    </label>
  );
}

export default function HoursSheet({ open, onOpenChange, place }) {
  const [mode, setMode] = useState('same');
  const [same, setSame] = useState({ opensAt: '11:00', closesAt: '23:00' });
  const [closed, setClosed] = useState([]);
  const [byDay, setByDay] = useState(() => Object.fromEntries(DAYS.map((d) => [d, { opensAt: '11:00', closesAt: '23:00' }])));
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setMode('same');
      setClosed([]);
    }
  }, [open]);

  const hours = () =>
    DAYS.filter((d) => !closed.includes(d)).map((d) => ({ day: d, ...(mode === 'same' ? same : byDay[d]) }));

  const valid = hours().length > 0 && hours().every((h) => h.opensAt && h.closesAt && h.opensAt !== h.closesAt);

  const save = useMutation({
    mutationFn: () => setHours(place.id, hours()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['place', String(place.id)] });
      onOpenChange(false);
      toast.success('Hours added — thanks!');
    },
    onError: toastError,
  });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="When is it open?"
      subtitle={place?.name}
      footer={
        <Button variant="primary" size="lg" block disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
          Save hours
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Segmented
          block
          size="md"
          label="Hours pattern"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'same', label: 'Same every day' },
            { value: 'byDay', label: 'Different by day' },
          ]}
        />
        {mode === 'same' ? (
          <div className="flex gap-2.5">
            <TimeInput label="Opens" value={same.opensAt} onChange={(v) => setSame((s) => ({ ...s, opensAt: v }))} />
            <TimeInput label="Closes" value={same.closesAt} onChange={(v) => setSame((s) => ({ ...s, closesAt: v }))} />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {DAYS.filter((d) => !closed.includes(d)).map((d) => (
              <div key={d} className="flex items-center gap-2">
                <span className="w-10 text-sm font-extrabold">{dayName(d)}</span>
                {['opensAt', 'closesAt'].map((k) => (
                  <input
                    key={k}
                    type="time"
                    aria-label={`${dayName(d)} ${k === 'opensAt' ? 'opens' : 'closes'}`}
                    value={byDay[d][k]}
                    onChange={(e) => setByDay((s) => ({ ...s, [d]: { ...s[d], [k]: e.target.value } }))}
                    className="h-10 flex-1 rounded-[10px] border-2 border-ink bg-card px-2 text-sm font-bold"
                  />
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <p className="field-label">Closed on</p>
          <div className="flex gap-1.5">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={closed.includes(d)}
                aria-label={`Closed on ${dayName(d)}`}
                onClick={() => setClosed((c) => (c.includes(d) ? c.filter((x) => x !== d) : [...c, d]))}
                className={cn('press size-10 rounded-[10px] border-2 border-ink text-sm font-extrabold', closed.includes(d) ? 'bg-ink text-cream' : 'bg-card')}
              >
                {DAY_LETTER[d]}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs font-semibold text-muted">Closing after midnight? Just pick the time (e.g. 2:00 AM) — we handle it.</p>
      </div>
    </Sheet>
  );
}
