// Search box: white, 2px border, radius 14, hard shadow. Submitting goes to /search?q=
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { cn } from '@/lib/cn.js';

export default function SearchBar({ placeholder = 'spicy biryani under ₹250…', compact = false, big = false, className, autoFocus }) {
  const [params] = useSearchParams();
  const urlQ = params.get('q') ?? '';
  const [q, setQ] = useState(urlQ);
  const navigate = useNavigate();

  useEffect(() => setQ(urlQ), [urlQ]);

  const submit = (e) => {
    e.preventDefault();
    const text = q.trim();
    if (text.length < 2) return;
    navigate(`/search?q=${encodeURIComponent(text)}`);
  };

  return (
    <form role="search" onSubmit={submit} className={cn('relative', className)}>
      <label className="sr-only" htmlFor={compact ? 'top-search' : 'main-search'}>
        Search dishes, places or a mood
      </label>
      <span className={cn('pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 rounded-full border-[2.5px] border-ink', compact ? 'size-3.5' : 'size-[15px]')} aria-hidden />
      <input
        id={compact ? 'top-search' : 'main-search'}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={compact ? 'Search a dish, place or mood…' : placeholder}
        className={cn(
          'w-full rounded-[14px] border-2 border-ink bg-card pl-10 font-semibold text-ink shadow-hard outline-none focus-visible:border-ink',
          compact ? 'h-11 pr-4 text-[15px]' : big ? 'h-[66px] pr-32 text-lg' : 'h-[52px] pr-4 text-[15px]',
        )}
      />
      {big && (
        <button type="submit" className="press absolute top-1/2 right-3 -translate-y-1/2 rounded-[10px] bg-ink px-4 py-2 font-display text-[15px] font-extrabold text-cream">
          SEARCH
        </button>
      )}
    </form>
  );
}
