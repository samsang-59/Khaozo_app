// Add a dish to a place's menu — also the "Which dish?" step of "Rate a dish" on a place page.
// Typed name → API matches it to the catalogue:
//   exact → linked · similar → "Is this Chicken Dum Biryani?" yes / no · unknown → new dish
//   (category, cuisine, veg / non-veg) waiting for admin review.
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addMenuItem } from '@/api/dishes.api.js';
import { listCuisines, listDishCategories } from '@/api/meta.api.js';
import { Sheet } from '@/components/ui/Sheet.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Input, Field } from '@/components/ui/Input.jsx';
import { ChoiceChips } from '@/components/inputs/ChoiceChips.jsx';
import { DietMark } from '@/components/place/DietMark.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';
import { formatPrice } from '@/lib/format.js';

const DIETS = [
  { value: 'veg', label: 'Veg' },
  { value: 'egg', label: 'Egg' },
  { value: 'non_veg', label: 'Non-veg' },
];

// mode 'rate': pick from the menu first, or add a new dish; onPicked(menuItem) then opens the Rate sheet
export default function AddMenuItemSheet({ open, onOpenChange, place, menu = [], mode = 'add', onPicked }) {
  const [step, setStep] = useState(mode === 'rate' ? 'pick' : 'form');
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [newDish, setNewDish] = useState({ categoryId: null, cuisineId: null, diet: null });
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setStep(mode === 'rate' ? 'pick' : 'form');
    setQ('');
    setName('');
    setPrice('');
    setCandidates([]);
    setNewDish({ categoryId: null, cuisineId: null, diet: null });
  }, [open, mode]);

  const cats = useQuery({ queryKey: ['meta', 'dishCategories'], queryFn: listDishCategories, staleTime: 24 * 3600 * 1000, enabled: step === 'new' });
  const cuisines = useQuery({ queryKey: ['meta', 'cuisines'], queryFn: listCuisines, staleTime: 24 * 3600 * 1000, enabled: step === 'new' });

  const finish = (item) => {
    qc.invalidateQueries({ queryKey: ['placeMenu', String(place.id)] });
    qc.invalidateQueries({ queryKey: ['place', String(place.id)] });
    if (mode === 'rate') onPicked?.({ id: item.id, name: item.name, price: item.price ?? null });
    else toast.success(item.standardDish?.status === 'pending_review' ? 'Added — the new dish waits for a quick review' : 'Added to the menu');
    onOpenChange(false);
  };

  const add = useMutation({
    mutationFn: (extra) => addMenuItem(place.id, { name: name.trim(), price: price ? Number(price) : undefined, ...extra }),
    onSuccess: finish,
    onError: (err) => {
      if (err.code === 'DISH_NEEDS_CONFIRMATION') {
        setCandidates(err.details?.candidates ?? []);
        setStep('confirm');
      } else if (err.code === 'DISH_DETAILS_REQUIRED') setStep('new');
      else if (err.code === 'MENU_ITEM_EXISTS' && err.details?.menuItemId) {
        const existing = menu.find((m) => m.id === err.details.menuItemId);
        if (mode === 'rate') finish(existing ?? { id: err.details.menuItemId, name: name.trim() });
        else toast.info(err.message);
      } else toastError(err);
    },
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? menu.filter((m) => m.name.toLowerCase().includes(t) || m.standardDish?.toLowerCase().includes(t)) : menu;
  }, [menu, q]);

  const validName = name.trim().length >= 2;
  const titles = { pick: 'Which dish?', form: 'Add to the menu', confirm: `Is this ${candidates[0]?.name ?? 'it'}?`, new: 'New dish' };

  let footer = null;
  if (step === 'form') {
    footer = (
      <Button variant="primary" size="lg" block disabled={!validName} loading={add.isPending} onClick={() => add.mutate({})}>
        {mode === 'rate' ? 'Next · rate it' : 'Add dish'}
      </Button>
    );
  } else if (step === 'new') {
    footer = (
      <Button
        variant="primary"
        size="lg"
        block
        disabled={!newDish.categoryId || !newDish.cuisineId || !newDish.diet}
        loading={add.isPending}
        onClick={() => add.mutate({ newDish })}
      >
        Add new dish
      </Button>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={titles[step]} subtitle={place?.name} footer={footer}>
      <div className="flex flex-col gap-3 pb-3">
        {step === 'pick' && (
          <>
            {menu.length > 5 && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the menu…" aria-label="Search the menu" className="h-11" />}
            {filtered.length > 0 && (
              <div className="overflow-hidden rounded-2xl border-2 border-ink bg-card [&>*+*]:border-t-2 [&>*+*]:border-dashed [&>*+*]:border-divider">
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onPicked?.({ id: m.id, name: m.name, price: m.price });
                      onOpenChange(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-mixed"
                  >
                    <DietMark diet={m.diet} />
                    <span className="flex-1 text-[15px] font-bold">{m.name}</span>
                    <span className="text-sm font-bold text-body">{formatPrice(m.price)}</span>
                  </button>
                ))}
              </div>
            )}
            <Button
              variant="dashed"
              block
              onClick={() => {
                setName(q);
                setStep('form');
              }}
            >
              + Not on the menu? Add it
            </Button>
          </>
        )}

        {step === 'form' && (
          <>
            <Field label="Dish *" htmlFor="dish-name">
              <Input id="dish-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken Dum Biryani" maxLength={150} autoFocus shadow />
            </Field>
            <Field label="Price (full plate)" htmlFor="dish-price">
              <Input id="dish-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="₹" />
            </Field>
          </>
        )}

        {step === 'confirm' && (
          <>
            <p className="text-sm font-semibold text-body">We think “{name.trim()}” is one of these. Picking one keeps ratings in one place.</p>
            <div className="flex flex-col gap-2">
              {candidates.slice(0, 4).map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={add.isPending}
                  onClick={() => add.mutate({ standardDishId: c.id })}
                  className={`press flex items-center justify-between rounded-xl border-2 border-ink px-4 py-3 text-left ${i === 0 ? 'bg-saffron shadow-hard-sm' : 'bg-card'}`}
                >
                  <span>
                    <span className="block font-display text-base font-extrabold">Yes, {c.name}</span>
                    <span className="block text-xs font-bold">{c.category}</span>
                  </span>
                  <DietMark diet={c.diet} />
                </button>
              ))}
            </div>
            <Button variant="dashed" block onClick={() => setStep('new')}>
              No — it's a different dish
            </Button>
          </>
        )}

        {step === 'new' && (
          <>
            <p className="text-sm font-semibold text-body">“{name.trim()}” is new to Khaozo. Tell us a little about it — an admin checks new dishes.</p>
            <Field label="Veg or non-veg? *">
              <ChoiceChips options={DIETS} value={newDish.diet} onChange={(v) => setNewDish((d) => ({ ...d, diet: v }))} label="Diet" />
            </Field>
            <Field label="Kind of dish *">
              <ChoiceChips options={(cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))} value={newDish.categoryId} onChange={(v) => setNewDish((d) => ({ ...d, categoryId: v }))} size="sm" label="Category" />
            </Field>
            <Field label="Cuisine *">
              <ChoiceChips options={(cuisines.data ?? []).map((c) => ({ value: c.id, label: c.name }))} value={newDish.cuisineId} onChange={(v) => setNewDish((d) => ({ ...d, cuisineId: v }))} size="sm" label="Cuisine" />
            </Field>
          </>
        )}
      </div>
    </Sheet>
  );
}
