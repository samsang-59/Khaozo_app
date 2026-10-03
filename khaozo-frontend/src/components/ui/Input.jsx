import { forwardRef } from 'react';
import { cn } from '@/lib/cn.js';

export const Input = forwardRef(function Input({ className, shadow = false, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-12 w-full rounded-xl border-2 border-ink bg-card px-3.5 text-[15px] font-semibold text-ink outline-none focus-visible:border-saffron',
        shadow && 'shadow-hard-sm',
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[84px] w-full resize-none rounded-xl border-2 border-ink bg-card px-3.5 py-3 text-[15px] leading-snug font-medium text-ink outline-none focus-visible:border-saffron',
        className,
      )}
      {...props}
    />
  );
});

export function Field({ label, htmlFor, children, className, hint }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="field-label">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-xs font-semibold text-muted">{hint}</p>}
    </div>
  );
}
