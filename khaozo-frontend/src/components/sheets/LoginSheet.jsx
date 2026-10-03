// Login: Google only. Opens from any 🔐 action; after sign-in the action resumes.
import { useState } from 'react';
import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext.jsx';
import { useGoogleButton } from '@/hooks/useGoogleButton.js';
import { Sheet } from '@/components/ui/Sheet.jsx';
import { toastError } from '@/components/ui/toast.jsx';

export default function LoginSheet() {
  const { loginOpen, closeLogin, signIn, loginReason } = useAuth();
  const [busy, setBusy] = useState(false);
  const { ref, status } = useGoogleButton({
    enabled: loginOpen,
    width: 320,
    onCredential: async (idToken) => {
      setBusy(true);
      try {
        await signIn(idToken);
      } catch (err) {
        toastError(err);
      } finally {
        setBusy(false);
      }
    },
  });

  return (
    <Sheet open={loginOpen} onOpenChange={(o) => !o && closeLogin()} title="Save this to your journal">
      <div className="flex flex-col gap-4 pb-4">
        <p className="text-sm leading-relaxed font-medium text-body">
          {loginReason ?? 'Sign in with Google to rate, save and add places. Takes 2 seconds.'}
        </p>
        <div className="relative flex min-h-[56px] items-center justify-center rounded-xl border-2 border-ink bg-card p-1.5 shadow-hard">
          {status === 'not_configured' ? (
            <p className="px-2 py-2 text-center text-sm font-bold text-muted">Google sign-in isn't set up here (VITE_GOOGLE_CLIENT_ID is missing).</p>
          ) : status === 'failed' ? (
            <p className="px-2 py-2 text-center text-sm font-bold text-muted">Couldn't load Google sign-in. Check your connection and reopen this.</p>
          ) : (
            <>
              <div ref={ref} className="flex min-h-[44px] justify-center" />
              {(status === 'loading' || busy) && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-card/90">
                  <Loader2 className="size-5 animate-spin" aria-label="Signing in" />
                </div>
              )}
            </>
          )}
        </div>
        <p className="text-xs font-medium text-body">
          By continuing you agree to the{' '}
          <Link to="/terms" className="link-plain" onClick={closeLogin}>
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="link-plain" onClick={closeLogin}>
            Privacy policy
          </Link>
          .
        </p>
      </div>
    </Sheet>
  );
}
