/* Unit conversion happens only at display and input. Internally everything is metric. */
import type { Profile, State } from './types';
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

/** Default smallest weight jumps. Imperial defaults are whole pounds (5 lb, machines 10 lb), stored in kg. */
const LB = 0.45359237;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
export const INCREMENTS_METRIC: Record<string, number> = { Barbell: 2.5, Dumbbell: 2, Cable: 2.5, Machine: 5, Bodyweight: 0 };
export const INCREMENTS_IMPERIAL: Record<string, number> = { Barbell: r3(5 * LB), Dumbbell: r3(5 * LB), Cable: r3(5 * LB), Machine: r3(10 * LB), Bodyweight: 0 };
/** Kilograms to the stored precision used for increments (keeps 5 lb exactly 5 lb when shown). */
export const incKg = r3;

/** Switch units. If the weight increments are still the other system's defaults, they switch to this system's
    defaults too, so pounds users progress in 5 lb jumps instead of 5.5 lb (2.5 kg). Custom increments are kept. */
export function setUnits(p: Profile, units: 'metric' | 'imperial') {
  const from = units === 'imperial' ? INCREMENTS_METRIC : INCREMENTS_IMPERIAL;
  const to = units === 'imperial' ? INCREMENTS_IMPERIAL : INCREMENTS_METRIC;
  const isDefault = Object.keys(from).every(k => Math.abs((p.increments?.[k] ?? -1) - from[k]) < 0.01);
  p.units = units;
  if (isDefault) p.increments = { ...to };
}
