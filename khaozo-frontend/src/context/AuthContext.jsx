// Who's logged in + the login gate.
// - Start-up: silent POST /auth/refresh (the httpOnly cookie survives reloads; the access
//   token lives in memory only). The app renders once this settles (ready).
// - Login gate: gate(key, fn) runs fn when signed in; otherwise opens the Login sheet and
//   resumes fn after sign-in — on the same screen, or after onboarding for a new user
//   (the page re-registers the same key with useGate and picks it up from history state).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthEvent, refreshSession, setAccessToken } from '@/api/client.js';
import * as authApi from '@/api/auth.api.js';
import { toast } from '@/components/ui/toast.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginReason, setLoginReason] = useState(null);
  const pending = useRef(null); // { key, path }
  const handlers = useRef(new Map()); // key → fn (registered by mounted pages)
  const userRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Start-up silent refresh (shares the client's single-flight promise)
  useEffect(() => {
    let alive = true;
    refreshSession()
      .then((session) => alive && setUser(session?.user ?? null))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  // Token refreshed / session ended somewhere in the API layer
  useEffect(
    () =>
      onAuthEvent((type, payload) => {
        if (type === 'refreshed' && payload?.user) setUser(payload.user);
        if (type === 'logged_out' && userRef.current) {
          setUser(null);
          queryClient.removeQueries({ predicate: (q) => q.queryKey[0] === 'me' });
          setLoginReason(payload?.code === 'SESSION_REUSED' ? payload.message : 'Your session has ended. Please sign in again.');
          setLoginOpen(true);
        }
      }),
    [queryClient],
  );

  const runPending = useCallback(() => {
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    const fn = handlers.current.get(p.key);
    if (fn) setTimeout(fn, 0); // after the login sheet has closed
  }, []);

  const signIn = useCallback(
    async (idToken) => {
      const data = await authApi.loginWithGoogle(idToken);
      setAccessToken(data.accessToken);
      setUser(data.user);
      setLoginOpen(false);
      setLoginReason(null);
      queryClient.invalidateQueries(); // Match % etc. are personal
      if (data.isNewUser) {
        const p = pending.current;
        pending.current = null;
        navigate('/onboarding', { state: { next: p?.path ?? `${location.pathname}${location.search}`, resume: p?.key ?? null } });
      } else {
        toast.success(`Welcome back, ${data.user.name.split(' ')[0]}`);
        runPending();
      }
      return data;
    },
    [location.pathname, location.search, navigate, queryClient, runPending],
  );

  const signOut = useCallback(
    async ({ everywhere = false } = {}) => {
      try {
        await (everywhere ? authApi.logoutAll() : authApi.logout());
      } catch {
        /* already gone — still clear locally */
      }
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
      navigate('/');
    },
    [navigate, queryClient],
  );

  // Account deleted (DELETE /me already cleared the cookie)
  const forgetUser = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const openLogin = useCallback((reason = null) => {
    setLoginReason(reason);
    setLoginOpen(true);
  }, []);

  const gate = useCallback(
    (key, fn) => {
      if (userRef.current) return fn();
      pending.current = { key, path: `${window.location.pathname}${window.location.search}` };
      handlers.current.set(key, fn);
      openLogin(null);
      return undefined;
    },
    [openLogin],
  );

  const value = useMemo(
    () => ({
      user,
      ready,
      isLoggedIn: !!user,
      isAdmin: user?.role === 'admin',
      setUser,
      signIn,
      signOut,
      forgetUser,
      gate,
      handlers,
      loginOpen,
      loginReason,
      openLogin,
      closeLogin: () => {
        setLoginOpen(false);
        pending.current = null;
      },
    }),
    [user, ready, signIn, signOut, forgetUser, gate, loginOpen, loginReason, openLogin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
