/* Nocturne design tokens — from prototype/_ds/.../styles.css. Background, surface, divider and card outline were
   adjusted for clearer structure (cards and sections stand out more from the page). */

export const C = {
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
} as const;

/** CSS `color-mix(in srgb, <hex> <pct>%, transparent)` → rgba. */
export function alpha(hex: string, a: number) {
  const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const SPACE = { 1: 2.8, 2: 5.6, 3: 8.4, 4: 11.2, 6: 16.8, 8: 22.4 } as const;
export const R = { sm: 4, md: 8, lg: 14 } as const;
export const SHADOW = {
  sm: '0 0 0 1px #50546a, 0 2px 10px rgba(0,0,0,0.35)',
  md: '0 0 0 1px #595d6c, 0 6px 18px rgba(0,0,0,0.55)',
  lg: '0 0 0 1px #9397ab, 0 16px 40px rgba(0,0,0,0.65)',
} as const;

export const FONT = {
  regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold',
  // Same typeface as the website (regimenfit.ca): Archivo ExtraBold, condensed for headings, a little wider for big numbers.
  display: 'ArchivoCondensed_800', numeral: 'ArchivoNarrow_800',
} as const;
/** Headings use the condensed display face (like the website); body text stays Inter. */
export const TYPE = { h1: 42, h2: 32, page: 28, h3: 25, h4: 20, body: 15, lineHeight: 1.55 } as const;

export const WIDE = 980; // ≥ 980 px: sticky 236 px sidebar; below: top bar + drawer
export const MAX_W = 1320;
