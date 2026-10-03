import { cn } from '@/lib/cn.js';
import { initial } from '@/lib/format.js';

// Square avatar (radius 10–12), cream with the first letter; guests get a dashed border
export function Avatar({ name, src, size = 38, guest = false, tone = 'cream', className }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border-2 border-ink font-display font-extrabold',
        guest && 'border-dashed',
        tone === 'amber' ? 'bg-amber' : tone === 'white' ? 'bg-card' : 'bg-cream',
        className,
      )}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="size-full object-cover" referrerPolicy="no-referrer" /> : initial(name)}
    </span>
  );
}
