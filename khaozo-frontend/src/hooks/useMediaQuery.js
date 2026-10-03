import { useSyncExternalStore } from 'react';

const subscribe = (query) => (cb) => {
  const mql = window.matchMedia(query);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
};

export const useMediaQuery = (query) =>
  useSyncExternalStore(subscribe(query), () => window.matchMedia(query).matches, () => false);

// Laptop layout ≥ 1024px (design handoff); below that the phone layout
export const useIsLaptop = () => useMediaQuery('(min-width: 1024px)');
