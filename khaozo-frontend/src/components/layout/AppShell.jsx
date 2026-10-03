import { useMatches } from 'react-router';
import TopBar from './TopBar.jsx';
import TabBar from './TabBar.jsx';
import { cn } from '@/lib/cn.js';

export default function AppShell({ children }) {
  const matches = useMatches();
  const handle = matches.at(-1)?.handle ?? {};
  const showTabBar = handle.tabBar !== false;
  const showTopBar = handle.topBar !== false;

  return (
    <div className="min-h-dvh bg-cream">
      {showTopBar && <TopBar tab={handle.tab} showSearch={handle.topSearch !== false} />}
      <main className={cn(showTabBar && 'pb-[100px] lg:pb-0')}>{children}</main>
      {showTabBar && <TabBar tab={handle.tab} />}
    </div>
  );
}
