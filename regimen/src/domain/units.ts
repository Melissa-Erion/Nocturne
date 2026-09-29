/* Unit conversion happens only at display and input. Internally everything is metric. */
import type { State } from './types';
import { r1 } from './util';

export const makeUnits = (s: State) => {
  const imp = () => s.profile.units === 'imperial';
  return {
    imp,
    wu: () => imp() ? 'lb' : 'kg',
    lu: () => imp() ? 'in' : 'cm',
    /** Training load: lb rounded to 0.5 (or whole with dp=0). */
    w: (kg: number | null | undefined, dp?: number) => kg == null ? '—' : imp() ? String(Math.round(kg * 2.20462 * (dp === 0 ? 1 : 2)) / (dp === 0 ? 1 : 2)) : String(r1(kg)),
    /** Body weight, one decimal. */
    bw: (kg: number | null | undefined) => kg == null ? '—' : imp() ? (kg * 2.20462).toFixed(1) : Number(kg).toFixed(1),
    len: (cm: number | null | undefined) => cm == null ? '—' : imp() ? String(r1(cm / 2.54)) : String(r1(cm)),
    toKg: (v: number) => imp() ? v / 2.20462 : v,
    toCm: (v: number) => imp() ? v * 2.54 : v,
    g: (g: number) => imp() ? `${r1(g / 28.3495)} oz` : `${Math.round(g)} g`,
  };
};
export type Units = ReturnType<typeof makeUnits>;
