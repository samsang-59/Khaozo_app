// Add place `/places/new` — Step 1: pin (starts at your location, draggable), name, type,
// veg / non-veg, price. Similar place within 50–100 m → "Is it one of these?" (live, and the
// API's 409). Step 2 (optional): a dish you ate + rating + photo. → new Place page (Unverified).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { addPlace, listPlaces } from '@/api/places.api.js';
import { addMenuItem } from '@/api/dishes.api.js';
import { createRating } from '@/api/ratings.api.js';
import { uploadPhotos } from '@/api/photos.api.js';
import { CITY_CENTRE, useUserLocation } from '@/context/LocationContext.jsx';
import PinPicker from '@/components/map/PinPicker.jsx';
import { BackButton } from '@/components/layout/PageHeader.jsx';
import { Button, IconButton } from '@/components/ui/Button.jsx';
import { Field, Input } from '@/components/ui/Input.jsx';
import { ChoiceChips, YesNoToggle } from '@/components/inputs/ChoiceChips.jsx';
import { StarPicker } from '@/components/inputs/StarPicker.jsx';
import { PhotoUploader } from '@/components/inputs/PhotoUploader.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';
import { useDebounced } from '@/hooks/useDebounced.js';
import { formatDistance } from '@/lib/format.js';

const TYPES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Café' },
  { value: 'street_stall', label: 'Street stall' },
  { value: 'dhaba', label: 'Dhaba' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'sweet_shop', label: 'Sweet shop' },
];
const DIETS = [
  { value: 'pure_veg', label: 'Pure veg' },
  { value: 'both', label: 'Veg & non-veg' },
  { value: 'non_veg', label: 'Non-veg' },
];
const PRICES = [
  { value: 1, label: '₹' },
  { value: 2, label: '₹₹' },
  { value: 3, label: '₹₹₹' },
  { value: 4, label: '₹₹₹₹' },
];

export default function AddPlacePage() {
  const navigate = useNavigate();
  const { centre, coords, status, askLocation } = useUserLocation();
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState(coords ?? centre ?? CITY_CENTRE);
  const [form, setForm] = useState({ name: '', placeType: null, dietType: null, priceLevel: null });
  const [dish, setDish] = useState({ name: '', price: '', stars: null, again: null });
  const [photos, setPhotos] = useState([]);
  const [dupes, setDupes] = useState(null); // candidates from the API's 409

  useEffect(() => {
    document.title = 'Add a place — Khaozo';
  }, []);
  // The pin starts at the phone's location (asked here if we don't have it yet)
  useEffect(() => {
    if (!coords && status === 'idle') askLocation();
  }, [coords, status, askLocation]);
  useEffect(() => {
    const start = coords ?? centre;
    if (start) setPin((p) => (p === CITY_CENTRE ? start : p));
  }, [coords, centre]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const name = useDebounced(form.name.trim(), 350);
  const nearby = useQuery({
    queryKey: ['places', 'dupcheck', pin.lat.toFixed(4), pin.lng.toFixed(4), name],
    queryFn: () => listPlaces({ lat: pin.lat, lng: pin.lng, radius: 100, q: name, limit: 3 }),
    enabled: name.length >= 3,
  });
  const similar = dupes ?? nearby.data?.items ?? [];

  const valid1 = form.name.trim().length >= 1 && form.placeType;
  const dishStarted = dish.name.trim().length > 0;
  const valid2 = !dishStarted || (dish.name.trim().length >= 2 && dish.stars && dish.again != null);

  const submit = useMutation({
    mutationFn: async ({ confirmNew = false } = {}) => {
      const body = { name: form.name.trim(), lat: pin.lat, lng: pin.lng, placeType: form.placeType, confirmNew };
      if (form.dietType) body.dietType = form.dietType;
      if (form.priceLevel) body.priceLevel = form.priceLevel;
      const place = await addPlace(body);
      if (photos.length) await uploadPhotos('places', place.id, photos).catch(toastError);
      let dishDone = !dishStarted;
      if (dishStarted) {
        try {
          const item = await addMenuItem(place.id, {
            name: dish.name.trim(),
            price: dish.price ? Number(dish.price) : undefined,
          });
          await createRating(item.id, { stars: dish.stars, wouldOrderAgain: dish.again, pricePaid: dish.price ? Number(dish.price) : null });
          dishDone = true;
        } catch {
          dishDone = false; // needs "Is this X?" / new-dish details → finish on the place page
        }
      }
      return { place, dishDone };
    },
    onSuccess: ({ place, dishDone }) => {
      toast.success(dishDone ? 'Place added — ask friends to confirm it' : 'Place added — now pick the dish to save your rating');
      navigate(`/places/${place.id}`, { replace: true, state: dishDone ? {} : { open: 'rate' } });
    },
    onError: (err) => {
      if (err.code === 'POSSIBLE_DUPLICATE') {
        setDupes(err.details?.candidates ?? []);
        setStep(1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else toastError(err);
    },
  });

  const dupeBox = similar.length > 0 && (
    <div className="flex flex-col gap-1.5 rounded-xl border-2 border-dashed border-ink bg-notice px-3.5 py-2.5">
      <p className="text-[13px] font-extrabold">Is it one of these? (within 100 m)</p>
      {similar.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-2 text-[13px] font-bold">
          <span>
            {p.name} <span className="text-body">· {formatDistance(p.distanceM)}</span>
          </span>
          <button type="button" className="link-plain" onClick={() => navigate(`/places/${p.id}`)}>
            That's it
          </button>
        </div>
      ))}
      {dupes && (
        <button type="button" className="link-plain w-fit text-[13px]" onClick={() => submit.mutate({ confirmNew: true })}>
          No — mine is a different place
        </button>
      )}
    </div>
  );

  const stepOne = (
    <div className="flex flex-col gap-4">
      <PinPicker value={pin} onChange={(p) => setPin({ lat: p.lat, lng: p.lng })} className="h-[240px] lg:hidden" />
      {dupeBox}
      <Field label="Name *" htmlFor="place-name">
        <Input id="place-name" value={form.name} onChange={(e) => {
            set('name')(e.target.value);
            setDupes(null);
          }} maxLength={150} placeholder="e.g. Maa Tarini Tiffin Centre" />
      </Field>
      <Field label="Type *">
        <ChoiceChips options={TYPES} value={form.placeType} onChange={set('placeType')} label="Type" />
      </Field>
      <Field label="Food">
        <ChoiceChips options={DIETS} value={form.dietType} onChange={set('dietType')} label="Food" />
      </Field>
      <Field label="Price">
        <ChoiceChips options={PRICES} value={form.priceLevel} onChange={set('priceLevel')} label="Price" />
      </Field>
    </div>
  );

  const stepTwo = (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold text-body">Add one dish and rate it (optional). The place goes live as Unverified until a few people confirm it.</p>
      <Field label="Dish" htmlFor="dish">
        <Input id="dish" value={dish.name} onChange={(e) => setDish((d) => ({ ...d, name: e.target.value }))} placeholder="Masala Dosa" shadow />
      </Field>
      <Field label="Price" htmlFor="dish-price">
        <Input id="dish-price" inputMode="numeric" value={dish.price} onChange={(e) => setDish((d) => ({ ...d, price: e.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="₹" className="w-40" />
      </Field>
      {dishStarted && (
        <>
          <Field label="Your rating *">
            <StarPicker value={dish.stars} onChange={(v) => setDish((d) => ({ ...d, stars: v }))} label="Your rating" />
          </Field>
          <Field label="Would you order it again? *">
            <YesNoToggle value={dish.again} onChange={(v) => setDish((d) => ({ ...d, again: v }))} label="Would you order it again?" />
          </Field>
        </>
      )}
      <Field label="Photo of the place">
        <PhotoUploader files={photos} onChange={setPhotos} />
      </Field>
    </div>
  );

  const actions =
    step === 1 ? (
      <Button variant="primary" size="lg" block disabled={!valid1} onClick={() => setStep(2)}>
        Next · add a dish
      </Button>
    ) : (
      <div className="flex gap-2.5">
        <Button size="lg" className="w-1/3" onClick={() => setStep(1)}>
          Back
        </Button>
        <Button variant="primary" size="lg" className="flex-1" disabled={!valid2} loading={submit.isPending} onClick={() => submit.mutate({ confirmNew: false })}>
          Add place
        </Button>
      </div>
    );

  const mapLabel = useMemo(() => form.name.trim() || 'Your place', [form.name]);

  return (
    <div className="min-h-dvh">
      {/* Phone */}
      <div className="flex min-h-dvh flex-col px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex items-center justify-between">
          {step === 1 ? (
            <IconButton label="Cancel" onClick={() => navigate(-1)}>
              <X className="size-5" strokeWidth={2.5} />
            </IconButton>
          ) : (
            <BackButton />
          )}
          <span className="font-display text-xs font-extrabold tracking-[0.08em] uppercase">Step {step} of 2</span>
        </div>
        <h1 className="pt-4 pb-4 text-[30px] leading-none tracking-[-0.03em]">{step === 1 ? 'Where is it?' : 'What did you eat there?'}</h1>
        <div className="flex-1">{step === 1 ? stepOne : stepTwo}</div>
        <div className="pt-6">{actions}</div>
      </div>

      {/* Laptop: map left, form right */}
      <div className="hidden lg:block">
        <div className="flex h-[76px] items-center justify-between border-b-2 border-ink bg-saffron px-9">
          <span className="font-display text-[15px] font-extrabold tracking-[0.04em] uppercase">Add a place · step {step} of 2</span>
          <button type="button" className="link-plain text-sm" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
        <div className="mx-auto grid max-w-[1280px] grid-cols-[1fr_520px] gap-10 px-12 py-8">
          <PinPicker value={pin} onChange={(p) => setPin({ lat: p.lat, lng: p.lng })} className="h-[calc(100dvh-200px)] min-h-[520px]" caption={`${mapLabel} · drag to the exact spot`} />
          <div className="flex flex-col gap-5">
            <h1 className="text-[40px] leading-none tracking-[-0.03em]">{step === 1 ? 'Where is it?' : 'What did you eat there?'}</h1>
            {step === 1 ? stepOne : stepTwo}
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}
