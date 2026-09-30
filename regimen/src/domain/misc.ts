/* Quotes, weight trends, check-ins, charts and safety — port of prototype/store.js plus the spec's safety rules. */
import { add, diff, dow } from './dates';
import { QUOTES } from './data/quotes';
import type { Ctx, ISODate, Profile, State, WeightEntry } from './types';
import { r1, sum } from './util';

/* ── Quotes ── */
export interface QuoteView { id: string; text: string; tone: string; custom: boolean }
export const quoteList = (s: State): QuoteView[] =>
  QUOTES.map((q, i) => ({ id: 'q' + i, text: q[0], tone: q[1], custom: false })).concat(s.quotes.custom.map(c => ({ ...c, custom: true })));
export const todayQuote = (s: State, today: ISODate, offset = 0): QuoteView => {
  const tone = s.profile.quoteTone;
  let l = quoteList(s).filter(q => !s.quotes.hidden[q.id] && (tone === 'All' || q.tone === tone || q.custom));
  if (!l.length) l = quoteList(s);
  const dayNo = diff(today.slice(0, 4) + '-01-01', today) + 1; // day of year — rotates daily
  return l[((dayNo + offset) % l.length + l.length) % l.length];
};

/* ── Weights ── */
export function avgWeight(ws: WeightEntry[], d: ISODate, n = 7) {
  const a = ws.filter(w => w.date <= d && w.date > add(d, -n));
  return a.length ? r1(sum(a.map(w => w.kg)) / a.length) : null;
}
export function logWeight(ctx: Ctx, kg: number, date?: ISODate) {
  const { s, today } = ctx; date = date || today;
  const e = s.weights.find(w => w.date === date);
  if (e) e.kg = r1(kg); else s.weights.push({ date, kg: r1(kg) });
  s.weights.sort((a, b) => a.date < b.date ? -1 : 1);
  s.profile.weightKg = avgWeight(s.weights, today);
}

/* ── Check-ins ── */
export function nextCheckIn({ s, today }: Ctx): ISODate {
  const last = s.checkins.map(c => c.date).sort().pop() || today;
  const step = s.profile.checkInFreq === 'Monthly' ? 28 : s.profile.checkInFreq === 'Biweekly' ? 14 : 7;
  let d = add(last, step); let g = 0;
  while (d < today && g++ < 400) d = add(d, step);
  const cd = Number(s.profile.checkInDay) || 0; g = 0;
  while (dow(d) !== cd && g++ < 7) d = add(d, 1);
  return d;
}

/* ── Charts ── */
/** SVG polyline points for a series in a w×h box. Nulls are skipped. */
export const pts = (vals: (number | null)[], w: number, h: number, lo?: number, hi?: number) => {
  const nn = vals.filter((v): v is number => v != null);
  const mn = lo ?? Math.min(...nn), mx = hi ?? Math.max(...nn); const n = vals.length - 1 || 1;
  return vals.map((v, i) => v == null ? null : `${(i / n * w).toFixed(1)},${(h - (v - mn) / ((mx - mn) || 1) * h).toFixed(1)}`).filter(Boolean).join(' ');
};
export const rolling = (vals: (number | null)[], n: number) => vals.map((_, i) => {
  const a = vals.slice(Math.max(0, i - n + 1), i + 1).filter((v): v is number => v != null);
  return a.length ? sum(a) / a.length : null;
});

/* ── Safety ── */
/** Mifflin-St Jeor basal metabolic rate. */
export function bmr(p: Pick<Profile, 'weightKg' | 'heightCm' | 'age' | 'sex'>) {
  if (!p.weightKg || !p.heightCm || !p.age) return null;
  return Math.round(10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'Male' ? 5 : -161));
}
export const ACTIVITY: Record<string, number> = { Sedentary: 1.2, 'Lightly active': 1.375, 'Moderately active': 1.55, 'Very active': 1.725, 'Extremely active': 1.9 };
export const tdee = (p: Profile) => { const b = bmr(p); return b ? Math.round(b * (ACTIVITY[p.activity] || 1.55)) : null; };
/** Calories must not fall below max(estimated BMR, 1200 kcal female / 1500 kcal male). */
export function calorieFloor(p: Profile) { return Math.max(bmr(p) || 0, p.sex === 'Male' ? 1500 : 1200); }
/** True if the training-day or rest-day calorie target is below the floor. */
export const lowCalorie = (p: Profile) => Math.min(p.kcal, p.restTargets?.kcal ?? p.kcal) < calorieFloor(p);
export const NOT_MEDICAL = 'Not medical advice. Estimates only — check with a qualified professional before large changes to diet or training.';
