/* Web: Google's own "Sign in with Google" button (Google Identity Services). Google shows "to continue to
   regimenfit.ca" instead of the Supabase project address, and the ID token is handed to Supabase
   (signInWithIdToken) — no redirect through supabase.co. Needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (public) and the
   site's address in the Google client's "Authorized JavaScript origins". */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { friendlyAuthError } from './auth';
import { supabase } from './supabase';

const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
export const googleButtonAvailable = () => Platform.OS === 'web' && !!CLIENT_ID;

type GIS = {
  accounts: { id: {
    initialize: (o: Record<string, unknown>) => void;
    renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
  } };
};
declare global { interface Window { google?: GIS } }

let loading: Promise<GIS> | null = null;
function loadGis(): Promise<GIS> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!loading) loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => (window.google ? resolve(window.google) : reject(new Error('Google sign-in did not load.')));
    s.onerror = () => { loading = null; reject(new Error("Couldn't load Google sign-in. Check your connection.")); };
    document.head.appendChild(s);
  });
  return loading;
}

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Renders Google's button. onError gets a friendly message; success is picked up by the auth listener.
    If Google's script can't load (blocked, offline), `fallback` is shown instead (the redirect button). */
export function GoogleWebButton({ onError, onBusy, fallback }: { onError: (msg: string) => void; onBusy?: (b: boolean) => void; fallback?: ReactNode }) {
  const ref = useRef<View>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const g = await loadGis();
        const raw = crypto.getRandomValues(new Uint8Array(24)).reduce((a, b) => a + b.toString(16).padStart(2, '0'), '');
        const hashed = await sha256Hex(raw);
        if (!alive) return;
        g.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce: hashed,
          ux_mode: 'popup',
          use_fedcm_for_button: true,
          callback: async (resp: { credential?: string }) => {
            if (!resp.credential || !supabase) return onError('Google sign-in didn’t finish. Try again.');
            onBusy?.(true);
            const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: resp.credential, nonce: raw });
            onBusy?.(false);
            if (error) onError(friendlyAuthError(error));
          },
        });
        const el = ref.current as unknown as HTMLElement | null;
        if (!el) return;
        const width = Math.max(220, Math.min(400, Math.floor(el.getBoundingClientRect().width || 320)));
        g.accounts.id.renderButton(el, { type: 'standard', theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular', logo_alignment: 'center', width });
      } catch (e) {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return <>{fallback ?? null}</>;
  return <View ref={ref} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }} />;
}
