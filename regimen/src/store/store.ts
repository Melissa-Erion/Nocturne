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
import { currentAccess } from '@/lib/billing';
import { hasFullAccess, type Subscription } from '@/lib/plans';
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
  toast: { msg: string; id: number; undo?: boolean } | null;
  /** Label of the schedule change Undo would reverse, or null. */
  undoLabel: string | null;
  routeParam: unknown;
  sync: 'idle' | 'saving' | 'saved' | 'error';
  syncError: string | null;
  /** The signed-in user's subscription row (null = none / not loaded / device mode). */
  subscription: Subscription | null;
  /** RevenueCat's page for changing or cancelling the subscription (web purchases), when there is one. */
  manageUrl: string | null;
  /** A locked screen the user tried to open: Shell shows the Regimen Pro pop-up for it. */
  lockPrompt: string | null;
  /** The guided app tour is showing (opened automatically once, or from Settings / the menu). */
  tourOpen: boolean;
  error: string | null;
}

export const useUI = create<UI>(() => ({
  phase: 'booting', mode: supabase ? 'cloud' : 'device', userId: null, email: null, version: 0,
  toast: null, undoLabel: null, routeParam: null, sync: 'idle', syncError: null, subscription: null, manageUrl: null, lockPrompt: null, tourOpen: false, error: null,
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
  S = next; clearUndo();
  ensureFuture(ctx());
  if (opts.resync) cloud?.reset();
  commit();
}

/* ── Undo for schedule changes: snapshots of schedule + pauses, newest last (max 20, this session only). ── */
interface UndoSnap { label: string; schedule: string; pauses: string }
let undoStack: UndoSnap[] = [];
let lastUndoAt = 0;
export function pushUndo(label: string) {
  undoStack.push({ label, schedule: JSON.stringify(S.schedule), pauses: JSON.stringify(S.pauses) });
  if (undoStack.length > 20) undoStack.shift();
  lastUndoAt = Date.now();
  useUI.setState({ undoLabel: label });
}
/** Forget the newest snapshot (the change it was taken for didn't happen). */
export function dropUndo() { undoStack.pop(); useUI.setState({ undoLabel: undoStack[undoStack.length - 1]?.label ?? null }); }
export function undo() {
  const u = undoStack.pop(); if (!u) return;
  S.schedule = JSON.parse(u.schedule); S.pauses = JSON.parse(u.pauses);
  useUI.setState({ undoLabel: undoStack[undoStack.length - 1]?.label ?? null, toast: null });
  commit();
  toast(`Undone: ${u.label}.`, false);
}
function clearUndo() { undoStack = []; useUI.setState({ undoLabel: null }); }

let toastId = 0;
/** Show a message. Right after a schedule change it carries an Undo button (pass false to suppress). */
export function toast(msg: string, allowUndo = true) {
  const id = ++toastId;
  const undoable = allowUndo && undoStack.length > 0 && Date.now() - lastUndoAt < 2000;
  useUI.setState({ toast: { msg, id, undo: undoable } });
  setTimeout(() => { if (useUI.getState().toast?.id === id) useUI.setState({ toast: null }); }, undoable ? 6000 : 3400);
}

async function readCache(): Promise<State | null> {
  try { const raw = await AsyncStorage.getItem(cacheKey()); const s = raw ? JSON.parse(raw) : null; return s && s.v === 1 ? s : null; } catch { return null; }
}

/** Load data for the signed-in user (cloud) or this device. */
/** Read the user's access row (written only by the server). Failures leave access unknown → treated as no subscription. */
export async function refreshSubscription() {
  const uid = useUI.getState().userId;
  if (!supabase || !uid) { useUI.setState({ subscription: null, manageUrl: null }); return; }
  let sub: Subscription | null = null;
  try {
    const { data } = await supabase.from('subscriptions').select('status, plan, period_end').eq('user_id', uid).maybeSingle();
    sub = data ? { status: data.status, plan: data.plan, periodEnd: data.period_end } : null;
    useUI.setState({ subscription: sub });
  } catch { /* keep previous value */ }
  // RevenueCat is checked too: it knows about a purchase a few seconds before the webhook updates the database,
  // and it provides the "manage subscription" link. Comp accounts never need it.
  if (sub?.status === 'comp') return;
  try {
    const rc = await currentAccess(uid);
    if (!rc || useUI.getState().userId !== uid) return;
    useUI.setState({ manageUrl: rc.manageUrl });
    if (rc.sub && hasFullAccess(rc.sub, Date.now(), true) && !hasFullAccess(sub, Date.now(), true)) useUI.setState({ subscription: rc.sub });
  } catch { /* RevenueCat unreachable: the database row stands */ }
}

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
  refreshSubscription();
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
    if (event === 'SIGNED_OUT' || !u) { cloud = null; S = newUserState(localToday()); useUI.setState({ phase: 'signedOut', userId: null, email: null, subscription: null, manageUrl: null }); return; }
    if (u.id !== cur && event === 'SIGNED_IN') loadFor(u.id, u.email ?? null);
  });
}

export async function signOut() {
  if (cloud) await cloud.push(S);
  await supabase?.auth.signOut();
}

export const retrySync = () => { cloud?.push(S); };

/** Replace everything with the sample data set (Settings → Data & privacy). */
/** Remove the sample data completely and start a blank account (keeps kg/lb). Used by "Remove sample data & set up my own". */
export async function clearSampleData() {
  const units = S.profile.units;
  if (cloud) await cloud.wipe();
  const fresh = newUserState(localToday()); fresh.profile.units = units;
  replaceState(fresh, { resync: true });
}

export async function resetToSample() {
  if (cloud) await cloud.wipe();
  replaceState(sampleState(localToday()), { resync: true });
}
