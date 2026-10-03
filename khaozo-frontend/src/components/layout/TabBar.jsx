// Phone only: floating ink tab bar — Home · Group · + · Journal · Me
import { Link } from 'react-router';
import { Plus, X } from 'lucide-react';
import { useUi } from '@/context/UiContext.jsx';
import { cn } from '@/lib/cn.js';

const items = [
  { to: '/', label: 'Home', tab: 'home' },
  { to: '/groups', label: 'Group', tab: 'group' },
  null,
  { to: '/journal', label: 'Journal', tab: 'journal' },
  { to: '/me', label: 'Me', tab: 'me' },
];

export default function TabBar({ tab }) {
  const { addMenuOpen, setAddMenuOpen } = useUi();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-[max(14px,env(safe-area-inset-bottom))] z-40 flex h-[62px] items-center justify-around rounded-[20px] bg-ink px-2 lg:hidden"
    >
      {items.map((it) =>
        it ? (
          <Link
            key={it.to}
            to={it.to}
            aria-current={tab === it.tab ? 'page' : undefined}
            className={cn('flex h-full w-14 items-center justify-center text-[11px] font-bold no-underline', tab === it.tab ? 'text-saffron' : 'text-inactive')}
          >
            {it.label}
          </Link>
        ) : (
          <button
            key="add"
            type="button"
            aria-label={addMenuOpen ? 'Close add menu' : 'Add something'}
            onClick={() => setAddMenuOpen(!addMenuOpen)}
            className={cn('press flex size-10 items-center justify-center rounded-xl', addMenuOpen ? 'bg-cream' : 'bg-saffron')}
          >
            {addMenuOpen ? <X className="size-5" strokeWidth={3} /> : <Plus className="size-6" strokeWidth={3} />}
          </button>
        ),
      )}
    </nav>
  );
}
