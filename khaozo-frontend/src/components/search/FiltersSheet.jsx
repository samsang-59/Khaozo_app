// All search filters in one sheet (price cap, open now, diet, spice, mood, meal time)
import { useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet.jsx';
import { Chip } from '@/components/ui/Chip.jsx';
import { Button } from '@/components/ui/Button.jsx';

const PRICES = [100, 150, 250, 400, 600];
const SPICES = [
  ['mild', 'Mild'],
  ['medium', 'Medium'],
  ['spicy', 'Spicy'],
  ['very_spicy', 'Very spicy'],
];
const DIETS = [
  ['veg', 'Veg'],
  ['egg', 'Egg'],
  ['non_veg', 'Non-veg'],
];
const MOODS = ['Work', 'Study', 'Date', 'Family', 'Friends', 'Solo', 'Quick bite', 'Late night', 'Celebration', 'Budget'];
const MEALS = ['Breakfast', 'Lunch', 'Evening snacks', 'Dinner', 'Late night'];

function Group({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="field-label">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function FiltersSheet({ open, onOpenChange, values, onApply, onClear }) {
  const [v, setV] = useState(values);
  useEffect(() => {
    if (open) setV(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const toggle = (key, value) => setV((s) => ({ ...s, [key]: s[key] === value ? undefined : value }));

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filters"
      footer={
        <div className="flex gap-2.5">
          <Button size="lg" className="w-1/3" onClick={onClear}>
            Clear
          </Button>
          <Button size="lg" variant="primary" className="flex-1" onClick={() => onApply(v)}>
            Show results
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <Group label="Price per dish">
          {PRICES.map((p) => (
            <Chip key={p} selected={String(v.maxPrice) === String(p)} onClick={() => toggle('maxPrice', String(p))}>
              Under ₹{p}
            </Chip>
          ))}
        </Group>
        <Group label="When">
          <Chip selected={v.openNow === '1'} onClick={() => toggle('openNow', '1')}>
            Open now
          </Chip>
          {MEALS.map((m) => (
            <Chip key={m} selected={v.mealTime === m} onClick={() => toggle('mealTime', m)}>
              {m}
            </Chip>
          ))}
        </Group>
        <Group label="Food">
          {DIETS.map(([k, l]) => (
            <Chip key={k} selected={v.diet === k} onClick={() => toggle('diet', k)}>
              {l}
            </Chip>
          ))}
        </Group>
        <Group label="Spice">
          {SPICES.map(([k, l]) => (
            <Chip key={k} selected={v.spice === k} onClick={() => toggle('spice', k)}>
              {l}
            </Chip>
          ))}
        </Group>
        <Group label="Good for">
          {MOODS.map((m) => (
            <Chip key={m} selected={v.mood === m} onClick={() => toggle('mood', m)}>
              {m}
            </Chip>
          ))}
        </Group>
      </div>
    </Sheet>
  );
}
