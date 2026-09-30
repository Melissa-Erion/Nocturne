/* Where a visitor first came from (utm_source=instagram, or the referring site), remembered on this device and saved
   once to public.signup_sources after they sign in. No cookies, no third-party trackers. The landing page stores the
   same key, so the source survives the jump from regimenfit.ca to regimenfit.ca/app. */
import { Platform } from 'react-native';
import { supabase } from './supabase';

const KEY = 'regimen.src';
const SENT = 'regimen.src.sent';
type Src = { source: string | null; medium: string | null; campaign: string | null; referrer: string | null; landing: string; first_seen: string };

const web = () => Platform.OS === 'web' && typeof window !== 'undefined';
const get = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* private mode */ } };

/** Remember the first source seen on this device (first touch wins). */
export function captureSource() {
  if (!web() || get(KEY)) return;
  const q = new URLSearchParams(window.location.search);
  let ref: string | null = null;
  try { ref = document.referrer ? new URL(document.referrer).hostname : null; } catch { ref = null; }
  // Our own pages and sign-in / payment round trips aren't sources.
  if (ref && (ref === window.location.hostname || /(^|\.)(accounts\.google\.com|supabase\.co|stripe\.com|revenuecat\.com)$/.test(ref))) ref = null;
  const utm = q.get('utm_source');
  if (!utm && !ref) return; // direct visit: nothing to remember
  const src: Src = { source: utm || ref, medium: q.get('utm_medium'), campaign: q.get('utm_campaign'), referrer: ref, landing: window.location.pathname, first_seen: new Date().toISOString() };
  set(KEY, JSON.stringify(src));
}

/** Save it to the signed-in account once. Existing rows are left alone. */
export async function saveSource(userId: string) {
  if (!web() || !supabase || get(SENT) === userId) return;
  const raw = get(KEY); if (!raw) return;
  try {
    const s = JSON.parse(raw) as Src;
    const { error } = await supabase.from('signup_sources').insert({ user_id: userId, ...s });
    if (!error || error.code === '23505') set(SENT, userId); // 23505 = already recorded
  } catch { /* try again next time */ }
}
