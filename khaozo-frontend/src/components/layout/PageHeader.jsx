// Cream page header with a square back button: "‹ Want to try" (Wishlist, Notes, Taste, Settings)
import { useNavigate } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { IconButton } from '@/components/ui/Button.jsx';
import { cn } from '@/lib/cn.js';

export function BackButton({ fallback = '/', className, label = 'Back' }) {
  const navigate = useNavigate();
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(fallback));
  return (
    <IconButton label={label} onClick={back} className={className}>
      <ChevronLeft className="size-5" strokeWidth={2.5} />
    </IconButton>
  );
}

export default function PageHeader({ title, fallback = '/me', right, className }) {
  return (
    <div className={cn('flex items-center gap-3 px-5 pt-6 pb-4 lg:px-0 lg:pt-10', className)}>
      <BackButton fallback={fallback} className="lg:hidden" />
      <h1 className="flex-1 text-[30px] leading-none tracking-[-0.03em] lg:text-[40px]">{title}</h1>
      {right}
    </div>
  );
}

// Saffron header block (Home, Search, Best-for-dish, Journal, Me, Group hub…)
export function SaffronHeader({ className, children }) {
  return <div className={cn('border-b-2 border-ink bg-saffron', className)}>{children}</div>;
}

// Laptop content width wrapper
export function Container({ className, children, wide = false }) {
  return <div className={cn('mx-auto w-full px-5 lg:px-12', wide ? 'max-w-[1280px]' : 'max-w-[1100px]', className)}>{children}</div>;
}
