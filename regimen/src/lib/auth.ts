/* Sign-in helpers: Google (Supabase OAuth, PKCE) and the redirect address used by email links. */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

/** Where email links (confirm, reset, change email) return: the app's own address, including a sub-path such as /Nocturne. */
export function authRedirect() {
  return isWeb ? window.location.origin + (process.env.EXPO_PUBLIC_BASE_URL || '') + '/' : Linking.createURL('/');
}

const NOT_ENABLED = "Google sign-in isn't switched on yet. Use email and password for now.";

/** Turns Supabase / network errors into plain wording. */
export function friendlyAuthError(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  if (/provider is not enabled|unsupported provider/i.test(m)) return NOT_ENABLED;
  if (/network|failed to fetch|load failed/i.test(m)) return "Couldn't reach the server. Check your connection and try again.";
  if (/reauthenticat/i.test(m)) return 'For security, changing your password needs a fresh sign-in. Use "Send a reset email" instead.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
  return m || 'Something went wrong. Try again.';
}

/** Asks the server whether Google is switched on, so we can explain instead of opening an error page. Unknown → true. */
async function googleEnabled(): Promise<boolean> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL, key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !key) return true;
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: key } });
    if (!r.ok) return true;
    const j = (await r.json()) as { external?: Record<string, boolean> };
    return j.external?.google !== false;
  } catch { return true; }
}

/** Reads a parameter from a redirect URL's query or #fragment. */
function param(url: string, name: string): string | null {
  const re = new RegExp(`[?#&]${name}=([^&#]*)`);
  const m = url.match(re);
  return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
}

/**
 * Starts Google sign-in.
 * - Web: full-page redirect to Google; the session is picked up from the URL on return (resolves 'redirecting').
 * - iOS/Android: opens an in-app browser, then exchanges the returned code for a session ('signed-in'), or 'cancelled'.
 * Throws an Error with a friendly message on failure.
 */
export async function signInWithGoogle(): Promise<'redirecting' | 'signed-in' | 'cancelled'> {
  if (!supabase) throw new Error('Sign-in needs an internet connection to your Regimen account.');
  if (!(await googleEnabled())) throw new Error(NOT_ENABLED);

  if (isWeb) {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirect() } });
    if (error) throw new Error(friendlyAuthError(error));
    return 'redirecting';
  }

  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw new Error(friendlyAuthError(error));
  if (!data?.url) throw new Error("Couldn't start Google sign-in. Try again.");

  let res: WebBrowser.WebBrowserAuthSessionResult;
  try { res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo); }
  catch (e) { throw new Error(friendlyAuthError(e)); }
  if (res.type !== 'success') return 'cancelled';

  const errDesc = param(res.url, 'error_description') || param(res.url, 'error');
  if (errDesc) {
    if (/access_denied/i.test(errDesc)) return 'cancelled';
    throw new Error(friendlyAuthError(errDesc));
  }
  const code = param(res.url, 'code');
  if (!code) throw new Error("Google sign-in didn't finish. Try again.");
  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) throw new Error(friendlyAuthError(exErr));
  return 'signed-in';
}

/** On web, an OAuth error comes back in the address bar (?error_description=…). Returns it once, then tidies the URL. */
export function takeRedirectError(): string | null {
  if (!isWeb) return null;
  const href = window.location.href;
  const d = param(href, 'error_description') || (param(href, 'error') ? 'Sign-in was cancelled or failed. Try again.' : null);
  if (!d) return null;
  try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ }
  return friendlyAuthError(d);
}
