// Report a place: reasons list + optional detail. Wrong location / hours / info carry the
// detail as a suggested change; duplicate asks which place it duplicates.
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { listPlaces, reportPlace } from '@/api/places.api.js';
import { Sheet } from '@/components/ui/Sheet.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Textarea, Input } from '@/components/ui/Input.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';
import { useDebounced } from '@/hooks/useDebounced.js';
import { formatDistance } from '@/lib/format.js';
import { cn } from '@/lib/cn.js';

const REASONS = [
  ['closed', 'Permanently closed'],
  ['not_found', "Couldn't find it here"],
  ['wrong_location', 'Wrong location'],
  ['wrong_hours', 'Wrong hours'],
  ['wrong_info', 'Wrong name or details'],
  ['duplicate', 'Duplicate of another place'],
];

export default function ReportSheet({ open, onOpenChange, place }) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [dupQ, setDupQ] = useState('');
  const [dupOf, setDupOf] = useState(null);
  const term = useDebounced(dupQ.trim(), 250);

  useEffect(() => {
    if (open) {
      setReason(null);
      setDetails('');
      setDupQ('');
      setDupOf(null);
    }
  }, [open]);

  const nearby = useQuery({
    queryKey: ['places', 'dup', place?.id, term],
    queryFn: () => listPlaces({ lat: place.location.lat, lng: place.location.lng, radius: 1000, q: term || undefined, limit: 8 }),
    enabled: open && reason === 'duplicate' && !!place?.location,
  });

  const send = useMutation({
    mutationFn: () => {
      const text = details.trim();
      const body = { reason };
      if (text) body.details = text;
      if (reason === 'wrong_info' && text) body.suggestedChange = { text: text.slice(0, 500) };
      if (reason === 'duplicate') body.duplicateOf = dupOf;
      return reportPlace(place.id, body);
    },
    onSuccess: () => {
      onOpenChange(false);
      toast.success('Thanks — an admin will check it soon');
    },
    onError: (err) => {
      if (err.code !== 'REPORT_ALREADY_PENDING') return toastError(err);
      onOpenChange(false);
      toast.info(err.message);
    },
  });

  const canSend = reason && (reason !== 'duplicate' || dupOf);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="What's wrong?"
      subtitle={place?.name}
      footer={
        <Button variant="dark" size="lg" block disabled={!canSend} loading={send.isPending} onClick={() => send.mutate()}>
          Send report
        </Button>
      }
    >
      <div className="flex flex-col gap-2.5 pb-2">
        {REASONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={reason === value}
            onClick={() => setReason(value)}
            className={cn('press flex h-12 items-center justify-between rounded-xl border-2 border-ink px-4 text-left text-[15px] font-bold', reason === value ? 'bg-ink text-cream' : 'bg-card')}
          >
            {label}
            {reason === value && <Check className="size-4" strokeWidth={3} aria-hidden />}
          </button>
        ))}
        {reason === 'duplicate' && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="field-label">Same as which place?</p>
            <Input value={dupQ} onChange={(e) => setDupQ(e.target.value)} placeholder="Search nearby places…" className="h-11" />
            <div className="flex flex-col gap-1.5">
              {(nearby.data?.items ?? [])
                .filter((p) => p.id !== place.id)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDupOf(p.id)}
                    aria-pressed={dupOf === p.id}
                    className={cn('flex items-center justify-between rounded-xl border-2 border-ink px-3 py-2 text-left text-sm font-bold', dupOf === p.id ? 'bg-ink text-cream' : 'bg-card')}
                  >
                    {p.name}
                    <span className="text-xs">{formatDistance(p.distanceM)}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Add a detail (optional)" maxLength={1000} className="mt-1" aria-label="Details" />
      </div>
    </Sheet>
  );
}
