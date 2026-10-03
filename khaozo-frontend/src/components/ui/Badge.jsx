import { cn } from '@/lib/cn.js';

const tones = {
  green: 'bg-green text-card border-green',
  amber: 'bg-amber text-ink border-ink',
  ink: 'bg-ink text-cream border-ink',
  white: 'bg-card text-ink border-ink',
  outline: 'bg-transparent text-ink border-ink',
  dashed: 'bg-card text-ink border-ink border-dashed',
};

// Small uppercase tag: MUST ORDER, MIXED REVIEWS, AGAIN ✓, UNVERIFIED, READY…
export function Badge({ tone = 'white', className, children, ...props }) {
  return (
    <span
      className={cn('sticker-label inline-flex items-center gap-1 rounded-md border-[1.5px] px-1.5 py-[1px] text-[10px] leading-[1.5]', tones[tone], className)}
      {...props}
    >
      {children}
    </span>
  );
}

// Rotated sticker (Match %, OPEN TILL…, MUST ORDER on hero photos) — the only rotated things
export function Sticker({ tone = 'amber', rotate = 3, className, children }) {
  return (
    <span
      style={{ transform: `rotate(${rotate}deg)` }}
      className={cn(
        'sticker-label inline-flex items-center rounded-lg border-2 border-ink px-2 py-[3px] text-xs whitespace-nowrap',
        tone === 'amber' && 'bg-amber text-ink',
        tone === 'green' && 'bg-green text-card shadow-hard-sm',
        tone === 'ink' && 'bg-ink text-cream',
        tone === 'white' && 'bg-card text-ink',
        className,
      )}
    >
      {children}
    </span>
  );
}

export const LabelBadge = ({ label }) =>
  label === 'must_order' ? <Badge tone="green">Must order</Badge> : label === 'mixed_reviews' ? <Badge tone="amber">Mixed reviews</Badge> : null;

export const MatchBadge = ({ pct, long = false, className }) =>
  pct == null ? null : (
    <Sticker rotate={3} className={className}>
      {Math.round(pct)}% {long ? 'your match' : 'match'}
    </Sticker>
  );
