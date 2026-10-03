// Onboarding `/onboarding` — 6 skippable questions (diet, spice, sweet, budget, cuisines,
// never show me). Saves with PUT /me/taste-profile, then returns to where the user was and
// resumes the action they tapped before signing in.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { saveTasteQuiz } from '@/api/me.api.js';
import { listCuisines, listMainIngredients } from '@/api/meta.api.js';
import { Button } from '@/components/ui/Button.jsx';
import { Chip } from '@/components/ui/Chip.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';
import { cn } from '@/lib/cn.js';

const STEPS = [
  { key: 'diet', tag: 'Food', question: 'Veg, egg or non-veg?', options: [['veg', 'Veg'], ['egg', 'Egg + veg'], ['non_veg', 'Non-veg']] },
  { key: 'spice', tag: 'Taste', question: 'How spicy do you like it?', options: [[1, 'Mild'], [2, 'Medium'], [3, 'Spicy'], [4, 'Very spicy']] },
  { key: 'sweet', tag: 'Taste', question: 'How sweet do you like it?', options: [[1, 'Not too sweet'], [2, 'Just right'], [3, 'Extra sweet']] },
  { key: 'budget', tag: 'Budget', question: 'Usual spend per meal?', options: [[1, '< ₹150'], [2, '₹150–300'], [3, '₹300–600'], [4, '₹600+']], grid: true },
  { key: 'cuisineIds', tag: 'Pick any', question: 'Favourite cuisines?', multi: true },
  { key: 'avoidIds', tag: 'Pick any', question: 'Never show me…', multi: true, hint: "Dishes with these won't show up in your results." },
];

function Progress({ step }) {
  return (
    <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
      {STEPS.map((s, i) => (
        <span key={s.key} className={cn('h-[7px] w-[34px] rounded-full border-2 border-ink', i <= step ? 'bg-ink' : 'bg-cream')} />
      ))}
    </div>
  );
}

function StepBody({ def, value, onChange, lists, inCard }) {
  if (def.multi) {
    const items = def.key === 'cuisineIds' ? lists.cuisines : lists.ingredients;
    const set = new Set(value ?? []);
    return (
      <div className="flex flex-wrap gap-2.5">
        {items.map((it) => (
          <Chip
            key={it.id}
            selected={set.has(it.id)}
            onClick={() => onChange(set.has(it.id) ? [...set].filter((x) => x !== it.id) : [...set, it.id])}
            className={cn('px-4 py-2.5 text-sm', !set.has(it.id) && !inCard && 'bg-cream')}
          >
            {it.name}
            {set.has(it.id) && ' ✓'}
          </Chip>
        ))}
      </div>
    );
  }
  return (
    <div className={cn('grid gap-3', def.grid && inCard ? 'grid-cols-2' : 'grid-cols-1')} role="radiogroup" aria-label={def.question}>
      {def.options.map(([v, label]) => {
        const on = value === v;
        return (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? null : v)}
            className={cn(
              'press flex h-[52px] items-center justify-between rounded-xl border-2 border-ink px-4 text-left',
              def.grid ? 'font-display text-lg font-extrabold' : 'text-base font-extrabold',
              on ? (inCard ? 'bg-ink text-cream shadow-[3px_3px_0_#ff7a1a]' : 'bg-ink text-cream shadow-hard-cream') : inCard ? 'bg-card' : 'bg-cream',
            )}
          >
            {label}
            {on && <Check className="size-4 text-saffron" strokeWidth={3} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const next = location.state?.next ?? '/';
  const resume = location.state?.resume ?? null;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ cuisineIds: [], avoidIds: [] });

  const cuisines = useQuery({ queryKey: ['meta', 'cuisines'], queryFn: listCuisines, staleTime: 24 * 3600 * 1000 });
  const ingredients = useQuery({ queryKey: ['meta', 'ingredients'], queryFn: listMainIngredients, staleTime: 24 * 3600 * 1000 });
  const lists = { cuisines: cuisines.data ?? [], ingredients: ingredients.data ?? [] };

  useEffect(() => {
    document.title = 'Your taste — Khaozo';
  }, []);

  const goBack = () => navigate(next === '/onboarding' ? '/' : next, { replace: true, state: resume ? { resume } : undefined });

  const save = useMutation({
    mutationFn: () => {
      // Skipped questions are left out (the API treats missing as "no answer")
      const body = Object.fromEntries(Object.entries(answers).filter(([, v]) => v != null));
      return saveTasteQuiz(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['search'] });
      toast.success('Taste saved — your matches are ready');
      goBack();
    },
    onError: toastError,
  });

  const def = STEPS[step];
  const last = step === STEPS.length - 1;
  const set = (v) => setAnswers((a) => ({ ...a, [def.key]: v }));
  const onNext = () => (last ? save.mutate() : setStep((s) => s + 1));
  const skip = () => (Object.values(answers).some((v) => (Array.isArray(v) ? v.length : v != null)) ? save.mutate() : goBack());

  const header = (inCard) => (
    <>
      <div className="flex items-center justify-between">
        <Progress step={step} />
        <button type="button" onClick={skip} className="link-plain text-sm">
          Skip
        </button>
      </div>
      <p className="pt-5 font-display text-xs font-extrabold tracking-[0.08em] uppercase">
        {step + 1} of {STEPS.length} · {def.tag}
      </p>
      <h1 className={cn('pt-3 tracking-[-0.03em]', inCard ? 'text-[30px] leading-[1.02]' : 'text-[36px] leading-[1.02]')}>{def.question}</h1>
      {def.hint && <p className="pt-2 text-sm font-bold">{def.hint}</p>}
    </>
  );
  const buttons = (inCard) => (
    <div className="flex gap-2.5">
      <Button size="lg" variant={inCard ? 'secondary' : 'cream'} className="w-[34%]" onClick={() => (step === 0 ? goBack() : setStep((s) => s - 1))}>
        {step === 0 ? 'Later' : 'Back'}
      </Button>
      <Button size="lg" variant={inCard ? 'primary' : 'dark'} className="flex-1" loading={save.isPending} onClick={onNext}>
        {last ? 'Done' : 'Next'}
      </Button>
    </div>
  );

  return (
    <div className="min-h-dvh bg-saffron">
      {/* Phone: full saffron screen */}
      <div className="flex min-h-dvh flex-col px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))] lg:hidden">
        {header(false)}
        <div className="flex-1 pt-6">
          <StepBody def={def} value={answers[def.key]} onChange={set} lists={lists} inCard={false} />
        </div>
        <div className="pt-6">{buttons(false)}</div>
      </div>

      {/* Laptop: pitch on the left, cream card on the right */}
      <div className="mx-auto hidden min-h-dvh max-w-[1180px] items-center gap-16 px-16 lg:flex">
        <div className="flex-1">
          <Link to="/" className="font-display text-[28px] font-extrabold tracking-[-0.04em] no-underline">
            khaozo
          </Link>
          <p className="pt-8 font-display text-[72px] leading-[0.92] font-extrabold tracking-[-0.05em]">
            30 seconds to
            <br />
            better picks.
          </p>
          <p className="max-w-[420px] pt-6 text-lg leading-snug font-bold">
            Six quick questions. Your answers power "Match for you" and auto-fill group mode. Your ratings take over as you go.
          </p>
        </div>
        <div className="flex w-[540px] flex-col gap-5 rounded-[22px] border-2 border-ink bg-cream p-8 shadow-hard-lg">
          <div>{header(true)}</div>
          <StepBody def={def} value={answers[def.key]} onChange={set} lists={lists} inCard />
          {buttons(true)}
        </div>
      </div>
    </div>
  );
}
