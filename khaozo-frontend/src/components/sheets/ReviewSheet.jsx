// Review a place — ★ required; "+ More details" folded (vibe, hygiene, Wi-Fi, parking…);
// "Good for:" tag chips. Reviewed within 30 days → edits that review.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createReview, updateReview } from '@/api/reviews.api.js';
import { uploadPhotos } from '@/api/photos.api.js';
import { listTags } from '@/api/meta.api.js';
import { Sheet } from '@/components/ui/Sheet.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Textarea } from '@/components/ui/Input.jsx';
import { StarPicker, ScoreRow } from '@/components/inputs/StarPicker.jsx';
import { ChoiceChips } from '@/components/inputs/ChoiceChips.jsx';
import { PhotoUploader } from '@/components/inputs/PhotoUploader.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';
import { invalidateAfterContribution } from './RateSheet.jsx';
import { cn } from '@/lib/cn.js';

const FACILITIES = [
  ['wifi', 'Wi-Fi'],
  ['plugPoints', 'Plug points'],
  ['ac', 'AC'],
  ['washroom', 'Washroom'],
  ['bikeParking', 'Bike parking'],
  ['carParking', 'Car parking'],
  ['acceptsCash', 'Cash'],
  ['acceptsUpi', 'UPI'],
  ['acceptsCard', 'Card'],
];
const SCORES = [
  ['vibe', 'Vibe'],
  ['looks', 'Looks'],
  ['serviceSpeed', 'Speed'],
  ['staff', 'Staff'],
  ['hygiene', 'Hygiene'],
];

// Tap: not answered → yes → no → not answered
function TriChip({ label, value, onChange }) {
  const next = value == null ? true : value === true ? false : null;
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-label={`${label}: ${value == null ? 'not answered' : value ? 'yes' : 'no'}`}
      className={cn(
        'press rounded-[10px] border-2 border-ink px-3 py-1.5 text-[13px] font-bold',
        value === true && 'bg-ink text-cream',
        value === false && 'bg-card text-muted line-through',
        value == null && 'bg-card',
      )}
    >
      {label}
      {value === true ? ' ✓' : value === false ? ' ✗' : ''}
    </button>
  );
}

const empty = (r) => ({
  stars: r?.stars ?? null,
  ...Object.fromEntries(SCORES.map(([k]) => [k, r?.[k] ?? null])),
  ...Object.fromEntries(FACILITIES.map(([k]) => [k, r?.[k] ?? null])),
  noise: r?.noise ?? null,
  crowd: r?.crowd ?? null,
  reviewText: r?.reviewText ?? '',
  tagIds: [],
});

export default function ReviewSheet({ open, onOpenChange, place, existing }) {
  const [form, setForm] = useState(empty(existing));
  const [editId, setEditId] = useState(existing?.id ?? null);
  const [more, setMore] = useState(false);
  const [photos, setPhotos] = useState([]);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: tags = [] } = useQuery({ queryKey: ['meta', 'tags'], queryFn: listTags, staleTime: 24 * 3600 * 1000, enabled: open });

  useEffect(() => {
    if (!open) return;
    setForm(empty(existing));
    setEditId(existing?.id ?? null);
    setMore(false);
    setPhotos([]);
  }, [open, existing]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const body = () => {
    const b = { ...form, reviewText: form.reviewText.trim() || null };
    if (!b.tagIds.length) delete b.tagIds;
    return b;
  };

  const save = useMutation({
    mutationFn: async () => {
      let review;
      try {
        review = editId ? await updateReview(editId, body()) : await createReview(place.id, body());
      } catch (err) {
        if (err.code === 'REVIEW_TOO_SOON' && err.details?.reviewId) {
          setEditId(err.details.reviewId);
          review = await updateReview(err.details.reviewId, body());
        } else throw err;
      }
      if (photos.length) await uploadPhotos('reviews', review.id, photos).catch(toastError);
      return review;
    },
    onSuccess: () => {
      invalidateAfterContribution(qc, { placeId: place.id });
      qc.invalidateQueries({ queryKey: ['placeReviews', String(place.id)] });
      onOpenChange(false);
      toast.success('Review saved', { label: 'View', onClick: () => navigate('/journal') });
    },
    onError: toastError,
  });

  // Mood tags first, then meal times (same name "Late night" exists in both — keep the mood one)
  const tagOptions = tags
    .filter((t, i, all) => all.findIndex((x) => x.name === t.name) === i)
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'mood' ? -1 : 1))
    .map((t) => ({ value: t.id, label: t.name }));

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`How was ${place?.name}?`}
      footer={
        <Button variant="primary" size="lg" block disabled={form.stars == null} loading={save.isPending} onClick={() => save.mutate()}>
          {editId ? 'Save changes' : 'Save review'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {editId && <p className="rounded-xl border-2 border-dashed border-ink bg-notice px-3 py-2 text-[13px] font-bold">You reviewed this place recently — you're editing that review.</p>}
        <StarPicker value={form.stars} onChange={set('stars')} label="Overall stars" />
        {!more ? (
          <Button variant="dashed" block onClick={() => setMore(true)} className="h-auto min-h-12 py-2">
            + More details (vibe, hygiene, Wi-Fi, parking…)
          </Button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              {SCORES.map(([k, l]) => (
                <ScoreRow key={k} label={l} value={form[k]} onChange={set(k)} />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <p className="field-label">Noise</p>
              <ChoiceChips options={[{ value: 'quiet', label: 'Quiet' }, { value: 'moderate', label: 'Moderate' }, { value: 'loud', label: 'Loud' }]} value={form.noise} onChange={set('noise')} label="Noise" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="field-label">Crowd</p>
              <ChoiceChips options={[{ value: 'empty', label: 'Empty' }, { value: 'okay', label: 'Okay' }, { value: 'packed', label: 'Packed' }]} value={form.crowd} onChange={set('crowd')} label="Crowd" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="field-label">Facilities · tap once for yes, twice for no</p>
              <div className="flex flex-wrap gap-2">
                {FACILITIES.map(([k, l]) => (
                  <TriChip key={k} label={l} value={form[k]} onChange={set(k)} />
                ))}
              </div>
            </div>
            <Textarea value={form.reviewText} onChange={(e) => set('reviewText')(e.target.value)} placeholder="What should people know? (optional)" maxLength={1000} aria-label="Review text" />
            <PhotoUploader files={photos} onChange={setPhotos} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <p className="field-label">Good for</p>
          <ChoiceChips multi options={tagOptions} value={form.tagIds} onChange={set('tagIds')} label="Good for" />
        </div>
      </div>
    </Sheet>
  );
}
