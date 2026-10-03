import { Chip } from '@/components/ui/Chip.jsx';

// Single choice (tap again to clear) or multi choice (array value)
export function ChoiceChips({ options, value, onChange, multi = false, label, size }) {
  const isOn = (v) => (multi ? (value ?? []).includes(v) : value === v);
  const toggle = (v) => {
    if (multi) onChange(isOn(v) ? value.filter((x) => x !== v) : [...(value ?? []), v]);
    else onChange(isOn(v) ? null : v);
  };
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <Chip key={String(o.value)} size={size} selected={isOn(o.value)} onClick={() => toggle(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

// Yes / No (green Yes when chosen) — "Would you order it again?"
export function YesNoToggle({ value, onChange, yes = 'Yes', no = 'No', label }) {
  const btn = (on, tone) =>
    `press h-12 flex-1 rounded-xl border-2 border-ink text-base font-extrabold ${on ? (tone === 'yes' ? 'bg-green text-card shadow-hard-sm' : 'bg-ink text-cream shadow-hard-sm') : 'bg-card'}`;
  return (
    <div className="flex gap-2.5" role="radiogroup" aria-label={label}>
      <button type="button" role="radio" aria-checked={value === true} className={btn(value === true, 'yes')} onClick={() => onChange(true)}>
        {yes}
      </button>
      <button type="button" role="radio" aria-checked={value === false} className={btn(value === false, 'no')} onClick={() => onChange(false)}>
        {no}
      </button>
    </div>
  );
}
