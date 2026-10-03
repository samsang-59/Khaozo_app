// Taste profile `/profile/taste` — learned from ratings + quiz. Tap a level to set and lock it.
// Diet, favourite cuisines, never-show-me ingredients; Retake quiz.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { editTasteProfile, getTasteProfile } from '@/api/me.api.js';
import { listCuisines, listMainIngredients } from '@/api/meta.api.js';
import PageHeader, { Container } from '@/components/layout/PageHeader.jsx';
import { TasteSlider } from '@/components/inputs/TasteSlider.jsx';
import { ChoiceChips } from '@/components/inputs/ChoiceChips.jsx';
import { Chip } from '@/components/ui/Chip.jsx';
import { Sheet } from '@/components/ui/Sheet.jsx';
import { Button, buttonVariants } from '@/components/ui/Button.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { ErrorState } from '@/components/shared/States.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';

const FIELDS = [
  { key: 'spice', label: 'Spice', max: 4, labels: ['Mild', 'Medium', 'Spicy', 'Very spicy'] },
  { key: 'sweet', label: 'Sweetness', max: 3, labels: ['Not too sweet', 'Just right', 'Extra sweet'] },
  { key: 'oiliness', label: 'Oiliness', max: 3, labels: ['Light', 'Medium', 'Rich'], tone: 'ink' },
  { key: 'budget', label: 'Budget', max: 4, labels: ['< ₹150', '₹150–300', '₹300–600', '₹600+'], tone: 'ink' },
];
const DIETS = [
  { value: 'veg', label: 'Veg' },
  { value: 'egg', label: 'Egg + veg' },
  { value: 'non_veg', label: 'Veg + non-veg' },
];

function PickSheet({ open, onOpenChange, title, options, selected, onSave, saving }) {
  const [v, setV] = useState(selected);
  useEffect(() => {
    if (open) setV(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <Button variant="primary" size="lg" block loading={saving} onClick={() => onSave(v)}>
          Save
        </Button>
      }
    >
      <div className="pb-2">
        <ChoiceChips multi options={options} value={v} onChange={setV} label={title} />
      </div>
    </Sheet>
  );
}

export default function TasteProfilePage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me', 'taste'], queryFn: getTasteProfile });
  const cuisines = useQuery({ queryKey: ['meta', 'cuisines'], queryFn: listCuisines, staleTime: 24 * 3600 * 1000 });
  const ingredients = useQuery({ queryKey: ['meta', 'ingredients'], queryFn: listMainIngredients, staleTime: 24 * 3600 * 1000 });
  const [picking, setPicking] = useState(null); // 'cuisines' | 'avoid'

  useEffect(() => {
    document.title = 'Your taste — Khaozo';
  }, []);

  const edit = useMutation({
    mutationFn: editTasteProfile,
    onSuccess: (data) => {
      qc.setQueryData(['me', 'taste'], data);
      qc.invalidateQueries({ queryKey: ['search'] });
      setPicking(null);
      toast.success('Saved');
    },
    onError: toastError,
  });

  const p = q.data;
  const nameOf = (list, id) => list.data?.find((x) => x.id === id)?.name ?? '…';

  return (
    <Container className="max-w-[760px] px-0 lg:px-5">
      <PageHeader title="Your taste" />
      <div className="flex flex-col gap-5 px-5 pb-8 lg:px-0">
        {q.isPending ? (
          <Skeleton className="h-60 rounded-2xl" />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <>
            <div className="rounded-2xl border-2 border-ink bg-amber px-4 py-3 text-sm leading-snug font-extrabold shadow-hard">
              {p.ratingsUsed > 0
                ? `Learned from ${p.ratingsUsed} rating${p.ratingsUsed === 1 ? '' : 's'}${p.quizDone ? ' and your quiz' : ''}.`
                : p.quizDone
                  ? 'From your quiz — your ratings take over as you go.'
                  : 'Take the quick quiz, or just rate dishes — we learn as you go.'}{' '}
              This powers "Your match" on every card.
            </div>
            <div className="flex flex-col gap-4 rounded-2xl border-2 border-ink bg-card p-4">
              {FIELDS.map((f) => (
                <TasteSlider
                  key={f.key}
                  label={f.label}
                  max={f.max}
                  labels={f.labels}
                  tone={f.tone}
                  value={p.effective[f.key]}
                  locked={p.fields[f.key].locked}
                  disabled={edit.isPending}
                  onChange={(v) => edit.mutate({ [f.key]: v })}
                />
              ))}
              <p className="text-xs font-semibold text-muted">Tap a level to set it yourself (🔒) — learning won't change a field you set.</p>
            </div>
            <section className="flex flex-col gap-2.5">
              <h2 className="field-label">Diet</h2>
              <ChoiceChips options={DIETS} value={p.diet} onChange={(v) => edit.mutate({ diet: v })} label="Diet" />
            </section>
            <section className="flex flex-col gap-2.5">
              <h2 className="field-label">Favourite cuisines</h2>
              <div className="flex flex-wrap gap-2">
                {p.cuisineIds.map((id) => (
                  <Chip key={id} selected removable onClick={() => edit.mutate({ cuisineIds: p.cuisineIds.filter((x) => x !== id) })}>
                    {nameOf(cuisines, id)}
                  </Chip>
                ))}
                <Chip className="border-dashed" onClick={() => setPicking('cuisines')}>
                  + Add
                </Chip>
              </div>
            </section>
            <section className="flex flex-col gap-2.5">
              <h2 className="field-label">Never show me</h2>
              <div className="flex flex-wrap gap-2">
                {p.avoidIds.map((id) => (
                  <Chip key={id} removable onClick={() => edit.mutate({ avoidIds: p.avoidIds.filter((x) => x !== id) })}>
                    {nameOf(ingredients, id)}
                  </Chip>
                ))}
                <Chip className="border-dashed" onClick={() => setPicking('avoid')}>
                  + Add
                </Chip>
              </div>
            </section>
            <Link to="/onboarding" state={{ next: '/profile/taste' }} className={buttonVariants({ size: 'lg', block: true })}>
              Retake quiz
            </Link>
          </>
        )}
      </div>
      <PickSheet
        open={picking === 'cuisines'}
        onOpenChange={(o) => !o && setPicking(null)}
        title="Favourite cuisines"
        options={(cuisines.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        selected={p?.cuisineIds ?? []}
        saving={edit.isPending}
        onSave={(ids) => edit.mutate({ cuisineIds: ids })}
      />
      <PickSheet
        open={picking === 'avoid'}
        onOpenChange={(o) => !o && setPicking(null)}
        title="Never show me"
        options={(ingredients.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        selected={p?.avoidIds ?? []}
        saving={edit.isPending}
        onSave={(ids) => edit.mutate({ avoidIds: ids })}
      />
    </Container>
  );
}
