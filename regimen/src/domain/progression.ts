/* Progressive overload, PRs and exercise history — port of prototype/store.js (history, prs, recommend).
   Everything is computed from working sets only (warm-ups excluded). */
import { exById } from './exercises';
import { activePlan } from './schedule';
import type { Ctx, ISODate, PlanItem, Recommendation, SetLog, Workout } from './types';
import { makeUnits } from './units';
import { r1, sum } from './util';

export interface HistoryEntry { date: ISODate; sessionId: string; workoutId: string; sets: SetLog[] }

export const history = ({ s }: Ctx, exId: string): HistoryEntry[] =>
  s.sessions.filter(x => x.sets.some(st => st.exId === exId && !st.warm)).sort((a, b) => a.date < b.date ? -1 : 1)
    .map(x => ({ date: x.date, sessionId: x.id, workoutId: x.workoutId, sets: x.sets.filter(st => st.exId === exId && !st.warm) }));

export const lastPerf = (ctx: Ctx, exId: string) => { const h = history(ctx, exId); return h[h.length - 1] || null; };

/** Epley estimated one-rep max. */
export const e1rm = (kg: number, reps: number) => kg * (1 + reps / 30);

export interface PRs {
  heavy: { kg: number; reps: number; date: ISODate };
  e1: { v: number; kg: number; reps: number; date: ISODate };
  vol: { v: number; date: ISODate };
  best: { sc: number; kg: number; reps: number[]; date: ISODate };
  repsAt: Record<string, { reps: number; date: ISODate }>;
}

export function prs(ctx: Ctx, exId: string): PRs | null {
  const h = history(ctx, exId); if (!h.length) return null;
  let heavy: PRs['heavy'] | null = null, e1: PRs['e1'] | null = null, vol: PRs['vol'] | null = null, best: PRs['best'] | null = null;
  const repsAt: PRs['repsAt'] = {};
  h.forEach(ses => {
    let v = 0;
    ses.sets.forEach(x => {
      v += x.kg * x.reps;
      if (!heavy || x.kg > heavy.kg || (x.kg === heavy.kg && x.reps > heavy.reps)) heavy = { kg: x.kg, reps: x.reps, date: ses.date };
      const e = e1rm(x.kg, x.reps);
      if (!e1 || e > e1.v) e1 = { v: e, kg: x.kg, reps: x.reps, date: ses.date };
      if (!repsAt[x.kg] || x.reps > repsAt[x.kg].reps) repsAt[x.kg] = { reps: x.reps, date: ses.date };
    });
    if (!vol || v > vol.v) vol = { v, date: ses.date };
    const tot = sum(ses.sets.map(x => x.reps)); const sc = ses.sets[0].kg * tot;
    if (!best || sc > best.sc) best = { sc, kg: ses.sets[0].kg, reps: ses.sets.map(x => x.reps), date: ses.date };
  });
  return { heavy: heavy!, e1: e1!, vol: vol!, best: best!, repsAt };
}

export function planItemFor(ctx: Ctx, exId: string): { item: PlanItem; workout: Workout } | null {
  for (const w of activePlan(ctx).workouts) for (const i of w.items) if (i.exId === exId) return { item: i, workout: w };
  return null;
}

/** Next-session recommendation from the last session's working sets. */
export function recommend(ctx: Ctx, exId: string, item?: PlanItem | null): Recommendation | null {
  item = item || (planItemFor(ctx, exId) || { item: null }).item; if (!item) return null;
  const U = makeUnits(ctx.s);
  const h = history(ctx, exId); const inc = ctx.s.profile.increments[exById(ctx.s, exId)?.equip as string] ?? 2.5;
  if (!h.length) {
    const lastRepl = item.replaced && item.replaced.length ? item.replaced[item.replaced.length - 1] : null;
    const rep = lastRepl ? lastPerf(ctx, lastRepl.exId) : null;
    return {
      type: 'baseline', kg: null, reps: Array(item.sets).fill(item.repMin),
      reason: rep && lastRepl
        ? `New exercise — replaces ${exById(ctx.s, lastRepl.exId)?.name}. Pick a weight you can do for ${item.repMin}–${item.repMax} at RIR ${item.rir}; this session sets the baseline.`
        : `No history yet. Choose a weight for ${item.repMin}–${item.repMax} reps at RIR ${item.rir}.`,
    };
  }
  const last = h[h.length - 1]; const prev = h[h.length - 2]; const kg = last.sets[0].kg; const reps = last.sets.map(x => x.reps);
  const rirOk = last.sets.every(x => x.rir == null || x.rir >= item!.rir - 1);
  const allTop = reps.length >= item.sets && reps.every(r => r >= item!.repMax);
  const anyBelow = reps.some(r => r < item!.repMin);
  const prevBelow = !!prev && prev.sets[0].kg === kg && prev.sets.some(x => x.reps < item!.repMin);
  const rule = ctx.s.profile.progression;
  if (rule === 'linear' && !anyBelow && rirOk) return { type: 'increase', kg: r1(kg + inc), reps: Array(item.sets).fill(item.repMin), reason: `Linear rule: all sets reached ${item.repMin}+. Add ${U.w(inc)} ${U.wu()}.` };
  if (allTop && rirOk) return { type: 'increase', kg: r1(kg + inc), reps: Array(item.sets).fill(item.repMin), reason: `All ${reps.length} sets hit ${item.repMax} at RIR ${item.rir}+. Add the smallest available increment (${U.w(inc)} ${U.wu()}) and restart at ${item.repMin}.` };
  if (allTop && !rirOk) return { type: 'hold', kg, reps: reps.map(() => item!.repMax), reason: `Top of range reached, but effort was harder than RIR ${item.rir}. Repeat at the same weight before adding load.` };
  if (anyBelow && prevBelow) return { type: 'reduce', kg: r1(Math.max(0, kg - Math.max(inc, Math.round(kg * 0.05 / (inc || 1)) * (inc || 1)))), reps: Array(item.sets).fill(item.repMin + 1), reason: `Below ${item.repMin} reps two sessions running. Drop ~5% and rebuild through the range.` };
  if (anyBelow) return { type: 'hold', kg, reps: reps.map(r => Math.max(item!.repMin, r)), reason: `${reps.filter(r => r < item!.repMin).length} set(s) fell short of ${item.repMin}. Keep ${U.w(kg)} ${U.wu()} and aim to reach ${item.repMin} on every set.` };
  const tgt = reps.map(r => Math.min(item!.repMax, r + 1));
  return { type: 'hold', kg, reps: tgt, reason: `Within range. Keep ${U.w(kg)} ${U.wu()} and add a rep where you can (target ${tgt.join(', ')}).` };
}
