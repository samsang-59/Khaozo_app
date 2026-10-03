import { cn } from '@/lib/cn.js';

// Indian food mark: green square (veg) / red square (non-veg; egg uses amber)
export function DietMark({ diet, className }) {
  if (!diet) return null;
  const color = diet === 'veg' ? 'border-green' : diet === 'egg' ? 'border-amber' : 'border-nonveg';
  return (
    <span className={cn('inline-block size-[14px] shrink-0 rounded-[3px] border-2 bg-card', color, className)} role="img" aria-label={diet === 'veg' ? 'Veg' : diet === 'egg' ? 'Egg' : 'Non-veg'} />
  );
}
