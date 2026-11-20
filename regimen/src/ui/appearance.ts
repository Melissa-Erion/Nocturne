/* Light / dark appearance. The choice is per device (saved in AsyncStorage), defaults to dark, and "system" follows
   the phone or computer setting. Switching changes the colours in place and remounts the app (see app/_layout). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { create } from 'zustand';
import { applyTheme, type ThemeMode } from './theme';

export type AppearancePref = 'dark' | 'light' | 'system';
const KEY = 'regimen.appearance';

export const useAppearance = create<{ pref: AppearancePref; mode: ThemeMode }>(() => ({ pref: 'dark', mode: 'dark' }));

const resolve = (pref: AppearancePref): ThemeMode => (pref === 'system' ? (Appearance.getColorScheme() === 'light' ? 'light' : 'dark') : pref);
function apply(pref: AppearancePref) {
  const mode = resolve(pref);
  applyTheme(mode);
  useAppearance.setState({ pref, mode });
}

/** Change the appearance and remember it on this device. */
export function setAppearance(pref: AppearancePref) {
  apply(pref);
  AsyncStorage.setItem(KEY, pref).catch(() => {});
}

// Web: AsyncStorage is localStorage underneath, so read the saved choice synchronously before the first render.
// Without this a light-mode user would see a flash of the dark theme on every page load.
try {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  if (v === 'light' || v === 'dark' || v === 'system') apply(v);
} catch { /* not on web, or storage blocked */ }

let started = false;
/** Load the saved choice and follow system changes. Call once at start-up. */
export async function initAppearance() {
  if (started) return; started = true;
  Appearance.addChangeListener(() => { const p = useAppearance.getState().pref; if (p === 'system') apply(p); });
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') apply(v);
  } catch { /* keep dark */ }
}
