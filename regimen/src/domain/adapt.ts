/* Automatic calorie adjustment. Every two weeks, the last four weeks of weigh-ins are compared with the rate the goal
   calls for. When the trend is outside a sensible band, a change of 50–200 kcal a day is suggested (never below the
   calorie floor). The user decides; nothing changes on its own. Not medical advice. */
import { calorieFloor } from './misc';
import type { Ctx, ISODate, MacroTargets, Profile, State } from './types';
import { add as addDays, diff as diffDays } from './dates';

const KCAL_PER_KG = 7700;
/** Weekly rate as a share of body weight: [aim, low end of OK band, high end of OK band]. */
const RATES: Record<string, [number, number, number]> = {
  'Fat loss': [-0.005, -0.01, -0.0025],
  'Muscle gain': [0.0025, 0.001, 0.005],
};
const HOLD: [number, number, number] = [0, -0.0025, 0.0025];
export const REVIEW_EVERY_DAYS = 14;

export interface CalorieAdvice {
  status: 'adjust' | 'on-track' | 'at-floor' | 'not-enough-data';
  /** Current trend and the goal's aim, in kg per week (negative = losing). */
  rateKg: number | null; aimKg: number;
  /** Suggested change in daily calories and the resulting training-day target. */
  change: number; newKcal: number;
  weighIns: number; days: number;
}

/** Least-squares slope of weight against day number, in kg per week. */
function trend(points: { day: number; kg: number }[]) {
  const n = points.length; const mx = points.reduce((a, p) => a + p.day, 0) / n; const my = points.reduce((a, p) => a + p.kg, 0) / n;
  let num = 0, den = 0; for (const p of points) { num += (p.day - mx) * (p.kg - my); den += (p.day - mx) ** 2; }
  return den ? (num / den) * 7 : 0;
}

export function calorieAdvice({ s, today }: Ctx): CalorieAdvice {
  const P = s.profile; const from = addDays(today, -27);
  const ws = s.weights.filter(w => w.date >= from && w.date <= today && w.kg > 0);
  const span = ws.length ? diffDays(ws[0].date, ws[ws.length - 1].date) : 0;
  const [aimPct, lo, hi] = RATES[P.goal] || HOLD;
  const body = ws.length ? ws.slice(-7).reduce((a, w) => a + w.kg, 0) / Math.min(7, ws.length) : P.weightKg || 70;
  const aimKg = aimPct * body;
  const base = { aimKg, change: 0, newKcal: P.kcal, weighIns: ws.length, days: span };
  if (ws.length < 8 || span < 14) return { ...base, status: 'not-enough-data', rateKg: null };
  const rateKg = trend(ws.map(w => ({ day: diffDays(ws[0].date, w.date), kg: w.kg })));
  const pct = rateKg / body;
  if (pct >= lo && pct <= hi) return { ...base, status: 'on-track', rateKg };
  const raw = (aimKg - rateKg) * KCAL_PER_KG / 7; // kcal/day needed to move the trend to the aim
  const change = Math.sign(raw) * Math.min(200, Math.max(50, Math.round(Math.abs(raw) / 25) * 25));
  const floor = calorieFloor(P); const newKcal = Math.max(floor, P.kcal + change);
  if (change < 0 && newKcal >= P.kcal) return { ...base, status: 'at-floor', rateKg, newKcal: P.kcal };
  return { ...base, status: 'adjust', rateKg, change: newKcal - P.kcal, newKcal };
}

/** A review is due two weeks after the last one (or after the start date), once there is data to judge. */
export function calorieReviewDue(ctx: Ctx): boolean {
  const P = ctx.s.profile; const last = P.calReviewOn || P.startDate;
  return !last || diffDays(last, ctx.today) >= REVIEW_EVERY_DAYS;
}

/** Change the calorie targets by `change` kcal a day, keeping protein: 60% of the change comes from carbs, 40% from fat. */
function shift(t: MacroTargets, change: number): MacroTargets {
  const carbs = Math.max(0, Math.round(t.carbs + change * 0.6 / 4)); const fat = Math.max(20, Math.round(t.fat + change * 0.4 / 9));
  return { kcal: t.kcal + change, protein: t.protein, carbs, fat };
}
export function applyCalorieChange(s: State, change: number, today: ISODate) {
  const P: Profile = s.profile;
  const t = shift({ kcal: P.kcal, protein: P.protein, carbs: P.carbs, fat: P.fat }, change);
  P.kcal = t.kcal; P.carbs = t.carbs; P.fat = t.fat;
  if (P.restTargets) P.restTargets = shift(P.restTargets, change);
  P.calReviewOn = today;
}
