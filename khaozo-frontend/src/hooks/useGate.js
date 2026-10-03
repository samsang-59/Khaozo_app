// Login-gated action: const openRate = useGate('rate:12', () => setRateOpen(true))
// Logged out → Login sheet → after sign-in the same action runs (also after onboarding,
// which navigates back here with history state { resume: key }).
import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/context/AuthContext.jsx';

export function useGate(key, fn) {
  const { gate, handlers, user } = useAuth();
  const fnRef = useRef(fn);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    const h = () => fnRef.current?.();
    const map = handlers.current;
    map.set(key, h);
    return () => {
      if (map.get(key) === h) map.delete(key);
    };
  }, [key, handlers]);

  useEffect(() => {
    if (!user || !key || location.state?.resume !== key) return;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: { ...location.state, resume: null } });
    setTimeout(() => fnRef.current?.(), 0);
  }, [user, key, location, navigate]);

  return useCallback((...args) => gate(key, () => fnRef.current?.(...args)), [gate, key]);
}
