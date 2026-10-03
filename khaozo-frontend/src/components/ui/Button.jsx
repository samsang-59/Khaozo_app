import { cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn.js';

// primary: saffron + hard shadow · secondary: white, no shadow · dark: ink + cream
// dashed: "+ More details" · danger: Delete account only · green: WhatsApp / Yes
const variants = cva(
  'press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-ink font-sans font-extrabold text-ink disabled:opacity-100 select-none',
  {
    variants: {
      variant: {
        primary: 'bg-saffron shadow-hard-sm disabled:bg-card disabled:text-inactive disabled:shadow-none',
        secondary: 'bg-card',
        cream: 'bg-cream',
        dark: 'bg-ink text-cream disabled:bg-inactive disabled:border-inactive',
        dashed: 'border-dashed bg-transparent',
        danger: 'bg-danger text-card shadow-hard-sm disabled:bg-card disabled:text-inactive disabled:shadow-none',
        green: 'bg-green text-card shadow-hard-sm',
        ghost: 'border-transparent bg-transparent',
      },
      size: {
        sm: 'h-9 px-3 text-[13px]',
        md: 'h-11 px-4 text-[15px]',
        lg: 'h-[52px] px-3 text-base lg:px-5',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

// Merged so Links styled as buttons resolve conflicts too (text-ink vs text-cream, etc.)
export const buttonVariants = ({ className, ...opts } = {}) => cn(variants(opts), className);

export function Button({ variant, size, block, className, loading, disabled, children, type = 'button', ...props }) {
  return (
    <button type={type} className={buttonVariants({ variant, size, block, className })} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

// Square 38px icon button used on photo headers (back / share / save)
export function IconButton({ className, label, children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('press inline-flex size-[38px] shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-card text-ink', className)}
      {...props}
    >
      {children}
    </button>
  );
}
