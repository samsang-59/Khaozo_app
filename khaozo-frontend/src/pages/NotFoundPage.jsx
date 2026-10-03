// Not found `*` — full saffron screen: 404 · "Nothing cooking here."
import { useEffect } from 'react';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/Button.jsx';

export default function NotFoundPage({ message = "This page doesn't exist, or the link is old." }) {
  useEffect(() => {
    document.title = 'Not found — Khaozo';
  }, []);
  return (
    <div className="flex min-h-dvh flex-col bg-saffron px-6 pt-8 pb-10 lg:px-16">
      <Link to="/" className="font-display text-[22px] font-extrabold tracking-[-0.03em] no-underline">
        khaozo
      </Link>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 lg:max-w-xl">
        <p className="font-display text-[120px] leading-[0.85] font-extrabold tracking-[-0.06em] lg:text-[180px]" aria-hidden>
          404
        </p>
        <h1 className="text-[30px] leading-none tracking-[-0.03em] lg:text-[44px]">Nothing cooking here.</h1>
        <p className="text-[15px] font-bold">{message}</p>
        <div className="flex flex-col gap-2.5 pt-2 sm:flex-row">
          <Link to="/" className={buttonVariants({ variant: 'dark', size: 'lg', className: 'shadow-hard-cream sm:flex-1' })}>
            Go home
          </Link>
          <Link to="/search?q=biryani" className={buttonVariants({ variant: 'cream', size: 'lg', className: 'sm:flex-1' })}>
            Search dishes
          </Link>
        </div>
      </div>
    </div>
  );
}
