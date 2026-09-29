/* App store. The domain State is a single mutable object (as in the prototype); every change goes through
   update()/commit(), which bumps a version so React re-renders, caches locally, and syncs to Supabase. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { localToday } from '@/domain/dates';
import { ensureFuture } from '@/domain/schedule';
import { newUserState, sampleState } from '@/domain/seed';
import type { Ctx, State } from '@/domain/types';
import { syncCalendar } from '@/lib/calendar';
import { syncNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { CloudSync } from './sync';

export type Mode = 'cloud' | 'device';
export type Phase = 'booting' | 'signedOut' | 'loading' | 'ready' | 'error';

interface UI {
  phase: Phase;
  mode: Mode;
  userId: string | null;
  email: string | null;
  version: number;
  toast: { msg: string; id: number } | null;
  routeParam: unknown;
  sync: 'idle' | 'saving' | 'saved' | 'error';
  syncError: string | null;
  error: string | null;
}

export const useUI = create<UI>(() => ({
  phase: 'booting', mode: supabase ? 'cloud' : 'device', userId: null, email: null, version: 0,
  toast: null, routeParam: null, sync: 'idle', syncError: null, error: null,
}));

let S: State = newUserState(localToday());
let cloud: CloudSync | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let sideTimer: ReturnType<typeof setTimeout> | null = null;

export const getState = () => S;
export const ctx = (): Ctx => ({ s: S, today: localToday() });
const cacheKey = () => `regimen.state.${useUI.getState().userId || 'device'}`;

function persistSoon() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(cacheKey(), JSON.stringify(S)).catch(() => {});
    if (cloud) cloud.push(S);
  }, 600);
  if (sideTimer) clearTimeout(sideTimer);
  sideTimer = setTimeout(() => {
    syncNotifications(S).catch(() => {});
    syncCalendar(S, localToday()).catch(() => {});
  }, 4000);
}

/** Re-render and save. Call after mutating state. */
export function commit() {
  useUI.setState(u => ({ version: u.version + 1 }));
  persistSoon();
}

export function update(fn: (s: State) => void) { fn(S); commit(); }

/** Swap in a whole new state (sign-in, restore sample data). */
export function replaceState(next: State, opts: { resync?: boolean } = {}) {
  S = next;
  ensureFuture(ctx());
  if (opts.resync) cloud?.reset();
  commit();
}

let toastId = 0;
export function toast(msg: string) {
  const id = ++toastId;
  useUI.setState({ toast: { msg, id } });
  setTimeout(() => { if (useUI.getState().toast?.id === id) useUI.setState({ toast: null }); }, 3400);
}

async function readCache(): Promise<State | null> {
  try { const raw = await AsyncStorage.getItem(cacheKey()); const s = raw ? JSON.parse(raw) : null; return s && s.v === 1 ? s : null; } catch { return null; }
}

/** Load data for the signed-in user (cloud) or this device. */
async function loadFor(userId: string | null, email: string | null) {
  useUI.setState({ phase: 'loading', userId, email, error: null });
  const today = localToday();
  if (!supabase || !userId) {
    // EXPO_PUBLIC_DEMO=1 starts on-device mode with the sample data set (for demos and testing).
    S = (await readCache()) || (process.env.EXPO_PUBLIC_DEMO === '1' ? sampleState(today) : newUserState(today));
    cloud = null;
  } else {
    cloud = new CloudSync(userId, (st, msg) => useUI.setState({ sync: st, syncError: msg || null }));
    try {
      const remote = await cloud.load(today);
      S = remote || newUserState(today);
      if (!remote) cloud.reset();
    } catch (e) {
      // Offline or server error: fall back to the local cache so the app stays usable.
      const cached = await readCache();
      if (!cached) { useUI.setState({ phase: 'error', error: e instanceof Error ? e.message : 'Could not load your data.' }); return; }
      S = cached; toast('Offline — showing your last saved data. Changes will sync when you reconnect.');
    }
  }
  if (!S.photos) S.photos = {};
  ensureFuture(ctx());
  useUI.setState({ phase: 'ready' });
  commit();
}

/** Boot: resolve the auth session and load data. Also re-loads on sign-in/sign-out. */
export function boot() {
  if (!supabase) { loadFor(null, null); return; }
  supabase.auth.getSession().then(({ data }) => {
    const u = data.session?.user;
    if (u) loadFor(u.id, u.email ?? null); else useUI.setState({ phase: 'signedOut' });
  });
  supabase.auth.onAuthStateChange((event, session) => {
    const u = session?.user; const cur = useUI.getState().userId;
    if (event === 'SIGNED_OUT' || !u) { cloud = null; S = newUserState(localToday()); useUI.setState({ phase: 'signedOut', userId: null, email: null }); return; }
    if (u.id !== cur && event === 'SIGNED_IN') loadFor(u.id, u.email ?? null);
  });
}

export async function signOut() {
  if (cloud) await cloud.push(S);
  await supabase?.auth.signOut();
}

export const retrySync = () => { cloud?.push(S); };

/** Replace everything with the sample data set (Settings → Data & privacy). */
export async function resetToSample() {
  if (cloud) await cloud.wipe();
  replaceState(sampleState(localToday()), { resync: true });
}
