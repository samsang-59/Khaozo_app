// Google Identity Services: loads the script once and renders the official
// "Continue with Google" button into a container; the callback gets the ID token.
import { useEffect, useRef, useState } from 'react';

const SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise = null;

const loadScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error('Google sign-in could not load'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
};

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function useGoogleButton({ enabled, onCredential, width = 320 }) {
  const ref = useRef(null);
  const cb = useRef(onCredential);
  const [status, setStatus] = useState(GOOGLE_CLIENT_ID ? 'loading' : 'not_configured');

  useEffect(() => {
    cb.current = onCredential;
  });

  useEffect(() => {
    if (!enabled || !GOOGLE_CLIENT_ID) return undefined;
    let alive = true;
    // The sheet's content mounts a frame later than this effect on some devices → wait for the node
    const render = () => {
      if (!alive) return;
      if (!ref.current) return requestAnimationFrame(render);
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (res) => res?.credential && cb.current?.(res.credential),
        ux_mode: 'popup',
        context: 'signin',
        itp_support: true,
      });
      ref.current.innerHTML = '';
      window.google.accounts.id.renderButton(ref.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'center',
        width: Math.min(width, 400),
      });
      setStatus('ready');
      return undefined;
    };
    loadScript()
      .then(render)
      .catch(() => alive && setStatus('failed'));
    return () => {
      alive = false;
    };
  }, [enabled, width]);

  return { ref, status };
}
