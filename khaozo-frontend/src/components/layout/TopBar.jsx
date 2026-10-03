// Laptop only (≥ 1024px): saffron bar — logo · search · Home / Group / Journal · + ADD · avatar
import { Link, NavLink } from 'react-router';
import { useAuth } from '@/context/AuthContext.jsx';
import { useUi } from '@/context/UiContext.jsx';
import SearchBar from '@/components/search/SearchBar.jsx';
import { Avatar } from '@/components/shared/Avatar.jsx';
import { cn } from '@/lib/cn.js';

const links = [
  { to: '/', label: 'Home', tab: 'home' },
  { to: '/groups', label: 'Group', tab: 'group' },
  { to: '/journal', label: 'Journal', tab: 'journal' },
];

export default function TopBar({ tab, showSearch = true }) {
  const { user, openLogin } = useAuth();
  const { setAddMenuOpen } = useUi();
  return (
    <header className="hidden h-[76px] items-center gap-8 border-b-2 border-ink bg-saffron px-9 lg:flex">
      <Link to="/" className="font-display text-[28px] font-extrabold tracking-[-0.04em] no-underline">
        khaozo
      </Link>
      <div className="max-w-[540px] flex-1">{showSearch && <SearchBar compact />}</div>
      <nav className="ml-auto flex items-center gap-6" aria-label="Main">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={cn(
              'text-sm font-extrabold no-underline decoration-ink decoration-[3px] underline-offset-[6px]',
              tab === l.tab && 'underline',
            )}
          >
            {l.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setAddMenuOpen(true)}
          className="press rounded-[10px] bg-ink px-4 py-2 font-display text-sm font-extrabold text-saffron"
        >
          + ADD
        </button>
        {user ? (
          <Link to="/me" aria-label="Me" className="no-underline">
            <Avatar name={user.name} src={user.avatarUrl} size={38} />
          </Link>
        ) : (
          <button type="button" onClick={() => openLogin()} className="press rounded-[10px] border-2 border-ink bg-cream px-3 py-1.5 text-sm font-extrabold">
            Sign in
          </button>
        )}
      </nav>
    </header>
  );
}
