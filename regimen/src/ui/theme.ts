/* Nocturne design tokens — from prototype/_ds/.../styles.css. Background, surface, divider and card outline were
   adjusted for clearer structure (cards and sections stand out more from the page). */

const DARK = {
  bg: '#12131d',
  surface: '#272a3b',
  text: '#e9e9ed',
  accent: '#9184d9',
  divider: 'rgba(233,233,237,0.2)', // text at 20%
  n100: '#f3f5fe', n200: '#e4e7f5', n300: '#cfd3e5', n400: '#b2b6ca', n500: '#9397ab', n600: '#75798c', n700: '#595d6c', n800: '#3f424d', n900: '#292b31',
  a100: '#f5f4ff', a200: '#e7e5fe', a300: '#d2cefd', a400: '#b5abfc', a500: '#968ae0', a600: '#796cbf', a700: '#5d5294', a800: '#423a6a', a900: '#2b2741',
  section: '#262a60', sectionGlow: '#353b80', // hero / stat band only
  sidebarTop: '#1a1c2a',
  heroTop: '#30344a',
  tour: '#2c2f45',
  /** Main call-to-action button: vivid purple with white text, so the one thing to do next stands out. */
  cta: '#6a55e8', ctaHover: '#7c69f2', ctaText: '#ffffff',
};
type Palette = { [K in keyof typeof DARK]: string };

/** Light theme in the social-post colours: warm paper background, ink text, deep purple accent. The neutral and accent
    scales run the other way round (n100 / a100 are the darkest), so every "light text on dark" use stays readable. */
const LIGHT: Palette = {
  bg: '#f3efe7',
  surface: '#fffdf8',
  text: '#0e0f16',
  accent: '#5b4fb3',
  divider: 'rgba(14,15,22,0.14)',
  n100: '#16171f', n200: '#24252e', n300: '#383a45', n400: '#4f5260', n500: '#625f6e', n600: '#75727f', n700: '#b9b3a7', n800: '#ddd6c9', n900: '#ebe5d9',
  a100: '#251e5c', a200: '#2f2775', a300: '#43389a', a400: '#5b4fb3', a500: '#6c60c4', a600: '#8b80d6', a700: '#b4abe8', a800: '#ddd8f6', a900: '#eeebfb',
  section: '#e6e1fa', sectionGlow: '#d3cbf3',
  sidebarTop: '#ebe5d9',
  heroTop: '#ece7fb',
  tour: '#fffdf8',
  cta: '#5b4fb3', ctaHover: '#4b409c', ctaText: '#ffffff',
};

/** Current colours. Mutated in place by applyTheme(); the app remounts after a switch so every screen re-reads them. */
export const C: Palette = { ...DARK };
export type ThemeMode = 'dark' | 'light';
export let themeMode: ThemeMode = 'dark';

/** CSS `color-mix(in srgb, <hex> <pct>%, transparent)` → rgba. */
export function alpha(hex: string, a: number) {
  const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const SPACE = { 1: 2.8, 2: 5.6, 3: 8.4, 4: 11.2, 6: 16.8, 8: 22.4 } as const;
export const R = { sm: 4, md: 8, lg: 14 } as const;
const SHADOW_DARK = {
  sm: '0 0 0 1px #50546a, 0 2px 10px rgba(0,0,0,0.35)',
  md: '0 0 0 1px #595d6c, 0 6px 18px rgba(0,0,0,0.55)',
  lg: '0 0 0 1px #9397ab, 0 16px 40px rgba(0,0,0,0.65)',
};
const SHADOW_LIGHT: typeof SHADOW_DARK = {
  sm: '0 0 0 1px #ddd6c9, 0 2px 8px rgba(40,30,70,0.06)',
  md: '0 0 0 1px #cfc8ba, 0 6px 18px rgba(40,30,70,0.10)',
  lg: '0 0 0 1px #b9b3a7, 0 16px 40px rgba(40,30,70,0.18)',
};
export const SHADOW = { ...SHADOW_DARK };

const listeners = new Set<() => void>();
/** Run `fn` after every theme switch (kit.tsx rebuilds its StyleSheet). */
export const onTheme = (fn: () => void) => { listeners.add(fn); };
/** Switch the colours in place. Callers remount the UI afterwards. */
export function applyTheme(mode: ThemeMode) {
  if (mode === themeMode) return;
  themeMode = mode;
  Object.assign(C, mode === 'light' ? LIGHT : DARK);
  Object.assign(SHADOW, mode === 'light' ? SHADOW_LIGHT : SHADOW_DARK);
  listeners.forEach(f => f());
}

export const FONT = {
  regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold',
  // Same typeface as the website (regimenfit.ca): Archivo ExtraBold, condensed for headings, a little wider for big numbers.
  display: 'ArchivoCondensed_800', numeral: 'ArchivoNarrow_800',
} as const;
/** Headings use the condensed display face (like the website); body text stays Inter. */
export const TYPE = { h1: 42, h2: 32, page: 28, h3: 25, h4: 20, body: 15, lineHeight: 1.55 } as const;

export const WIDE = 980; // ≥ 980 px: sticky 236 px sidebar; below: top bar + drawer
export const MAX_W = 1320;
