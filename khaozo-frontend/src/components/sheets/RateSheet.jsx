// Rate a dish — overall ★ + "Would you order it again?" are required (Save stays disabled
// until both are set). "+ More details" is folded by default. Rated within 30 days →
// edit mode (PATCH). After saving: photos upload, toast "Added to your journal · View".
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRating, updateRating } from '@/api/ratings.api.js';
import { uploadPhotos } from '@/api/photos.api.js';
import { Sheet } from '@/components/ui/Sheet.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Input, Textarea } from '@/components/ui/Input.jsx';
import { StarPicker, ScoreRow } from '@/components/inputs/StarPicker.jsx';
import { ChoiceChips, YesNoToggle } from '@/components/inputs/ChoiceChips.jsx';
import { PhotoUploader } from '@/components/inputs/PhotoUploader.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';

const SPICE = [
  { value: 'mild', label: 'Mild' },
  { value: 'medium', label: 'Medium' },
  { value: 'spicy', label: 'Spicy' },
  { value: 'very_spicy', label: 'Very spicy' },
];
const LEVEL = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
];
const DETAIL_KEYS = ['taste', 'portion', 'value', 'spice', 'sweetness', 'oiliness', 'reviewText', 'pricePaid'];

const fromRating = (r) => ({
  stars: r?.stars ?? null,
  wouldOrderAgain: r?.wouldOrderAgain ?? null,
  taste: r?.taste ?? null,
  portion: r?.portion ?? null,
  value: r?.value ?? null,
  spice: r?.spice ?? null,
  sweetness: r?.sweetness ?? null,
  oiliness: r?.oiliness ?? null,
  reviewText: r?.reviewText ?? '',
  pricePaid: r?.pricePaid ?? '',
});

export const invalidateAfterContribution = (qc, { menuItemId, placeId } = {}) => {
  if (menuItemId) {
    qc.invalidateQueries({ queryKey: ['menuItem', String(menuItemId)] });
    qc.invalidateQueries({ queryKey: ['menuItemRatings', String(menuItemId)] });
  }
  if (placeId) qc.invalidateQueries({ queryKey: ['place', String(placeId)] });
  qc.invalidateQueries({ queryKey: ['me'] });
  qc.invalidateQueries({ queryKey: ['search'] });
};

// menuItem: { id, name, placeName, placeId, price } · existing: my current rating (edit mode)
export default function RateSheet({ open, onOpenChange, menuItem, existing }) {
  const [form, setForm] = useState(fromRating(existing));
  const [editId, setEditId] = useState(existing?.id ?? null);
  const [more, setMore] = useState(false);
  const [photos, setPhotos] = useState([]);
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setForm(fromRating(existing));
    setEditId(existing?.id ?? null);
    setMore(!!existing && DETAIL_KEYS.some((k) => existing[k] != null && existing[k] !== ''));
    setPhotos([]);
  }, [open, existing]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const body = () => {
    const b = { stars: form.stars, wouldOrderAgain: form.wouldOrderAgain };
    for (const k of ['taste', 'portion', 'value', 'spice', 'sweetness', 'oiliness']) b[k] = form[k] ?? null;
    b.reviewText = form.reviewText.trim() || null;
    b.pricePaid = form.pricePaid === '' ? null : Number(form.pricePaid);
    return b;
  };

  const save = useMutation({
    mutationFn: async () => {
      let rating;
      try {
        rating = editId ? await updateRating(editId, body()) : await createRating(menuItem.id, body());
      } catch (err) {
        // Rated this dish within 30 days → save into that rating instead
        if (err.code === 'RATING_TOO_SOON' && err.details?.ratingId) {
          setEditId(err.details.ratingId);
          rating = await updateRating(err.details.ratingId, body());
        } else throw err;
      }
      if (photos.length) {
        try {
          await uploadPhotos('ratings', rating.id, photos);
        } catch (err) {
          toastError(err);
        }
      }
      return rating;
    },
    onSuccess: () => {
      invalidateAfterContribution(qc, { menuItemId: menuItem.id, placeId: menuItem.placeId });
      onOpenChange(false);
      toast.success(editId ? 'Rating updated' : 'Added to your journal', { label: 'View', onClick: () => navigate('/journal') });
    },
    onError: toastError,
  });

  const ready = form.stars != null && form.wouldOrderAgain != null;
  const validPrice = form.pricePaid === '' || (Number(form.pricePaid) > 0 && Number(form.pricePaid) <= 100000);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={menuItem?.name}
      subtitle={menuItem?.placeName}
      footer={
        <Button variant="primary" size="lg" block disabled={!ready || !validPrice} loading={save.isPending} onClick={() => save.mutate()}>
          {editId ? 'Save changes' : 'Save rating'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {editId && <p className="rounded-xl border-2 border-dashed border-ink bg-notice px-3 py-2 text-[13px] font-bold">You rated this recently — you're editing that rating.</p>}
        <div className="flex flex-col gap-2">
          <p className="field-label">Overall *</p>
          <StarPicker value={form.stars} onChange={set('stars')} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="field-label">Would you order it again? *</p>
          <YesNoToggle value={form.wouldOrderAgain} onChange={set('wouldOrderAgain')} label="Would you order it again?" />
        </div>

        {!more ? (
          <Button variant="dashed" block onClick={() => setMore(true)} className="h-auto min-h-12 py-2">
            + More details (taste, spice, photo, price)
          </Button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              <ScoreRow label="Taste" value={form.taste} onChange={set('taste')} />
              <ScoreRow label="Portion" value={form.portion} onChange={set('portion')} />
              <ScoreRow label="Value" value={form.value} onChange={set('value')} />
            </div>
            <div className="flex flex-col gap-2">
              <p className="field-label">Spice</p>
              <ChoiceChips options={SPICE} value={form.spice} onChange={set('spice')} label="Spice" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="field-label">Oiliness</p>
              <ChoiceChips options={LEVEL} value={form.oiliness} onChange={set('oiliness')} label="Oiliness" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="field-label">Sweetness</p>
              <ChoiceChips options={LEVEL} value={form.sweetness} onChange={set('sweetness')} label="Sweetness" />
            </div>
            <Textarea value={form.reviewText} onChange={(e) => set('reviewText')(e.target.value)} placeholder="Short review (optional)" maxLength={1000} aria-label="Short review" />
            <div className="flex flex-wrap items-start gap-2.5">
              <label className="relative w-[150px]">
                <span className="sr-only">Price paid in rupees</span>
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-bold">₹</span>
                <Input
                  inputMode="numeric"
                  value={form.pricePaid}
                  onChange={(e) => set('pricePaid')(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={menuItem?.price ? String(menuItem.price) : 'Price paid'}
                  className="h-11 pl-7"
                />
              </label>
              <PhotoUploader files={photos} onChange={setPhotos} />
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
