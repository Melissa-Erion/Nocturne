/* Active workout lifecycle — port of prototype/store.js (startWorkout, finishWorkout, replaceExercise). */
import { START_KG } from './data/plans';
import { lastPerf, recommend } from './progression';
import { entry, todayEntry, workoutOf } from './schedule';
import type { ActiveSet, ActiveWorkout, Ctx, Recommendation, Session, SetLog } from './types';
import { r1, uid } from './util';

/** Returns true when a new active workout was created (false when resuming the same one). */
export function startWorkout(ctx: Ctx, entryId?: string): boolean {
  const { s } = ctx;
  const e = (entryId && entry(ctx, entryId)) || todayEntry(ctx); if (!e) return false;
  if (s.active && s.active.entryId === e.id) return false;
  const w = workoutOf(ctx, e.workoutId, e.planId); if (!w) return false;
  s.active = {
    entryId: e.id, workoutId: w.id, planId: e.planId, date: ctx.today, startedAt: Date.now(), restEnd: null, restFor: null, pausedAt: null, pausedMs: 0,
    ex: w.items.map(item => {
      const rec: Partial<Recommendation> = recommend(ctx, item.exId, item) || {};
      const kg = rec.kg ?? item.targetKg ?? (lastPerf(ctx, item.exId) || { sets: [{ kg: START_KG[item.exId] || 10 }] }).sets[0].kg;
      const sets: ActiveSet[] = [];
      for (let j = 0; j < item.warmups; j++) sets.push({ id: uid(), kg: r1(kg * (j === 0 ? 0.5 : 0.7)), reps: j === 0 ? 8 : 5, rir: null, warm: true, done: false, note: '', feel: '' });
      for (let j = 0; j < item.sets; j++) sets.push({ id: uid(), kg, reps: null, target: (rec.reps || [])[j] ?? item.repMin, rir: item.rir, warm: false, done: false, note: '', feel: '' });
      return { key: uid(), itemId: item.id, exId: item.exId, originalExId: item.exId, rec, recState: 'pending', sets, note: '', feel: '' };
    }),
  };
  return true;
}

/** The only place an entry becomes "done": finishing a session with at least one logged set.
    The session is dated the day it was actually done. A workout done on a different day than planned (early, or a
    missed one made up) moves to that day, so history, streaks and the schedule match reality. */
export function finishWorkout(ctx: Ctx): Session | undefined {
  const { s } = ctx; const a = s.active; if (!a) return;
  a.date = ctx.today;
  const sets: SetLog[] = [];
  a.ex.forEach(x => x.sets.filter(st => st.done && st.reps).forEach(st => sets.push({
    exId: x.exId, kg: Number(st.kg) || 0, reps: Number(st.reps), rir: st.rir === '' || st.rir == null ? null : Number(st.rir), warm: st.warm, note: st.note, feel: st.feel || x.feel,
    ...(x.exId !== x.originalExId ? { sub: x.originalExId } : {}),
  })));
  const ses: Session = { id: uid(), date: a.date, workoutId: a.workoutId, planId: a.planId, entryId: a.entryId, sets, durationMin: Math.max(1, Math.round(elapsedMs(a) / 60000)), notes: a.ex.map(x => x.note).filter(Boolean).join(' · ') };
  const e = entry(ctx, a.entryId);
  if (sets.length) { s.sessions.push(ses); if (e) { if (e.date !== ctx.today) { e.date = ctx.today; e.origin = 'rescheduled'; } e.status = 'done'; e.sessionId = ses.id; } }
  s.active = null;
  return ses;
}

export function discardWorkout(ctx: Ctx) { ctx.s.active = null; }

/** Active time so far: wall-clock time since start minus paused time (including a pause in progress). */
export function elapsedMs(a: ActiveWorkout, now = Date.now()) {
  return Math.max(0, now - a.startedAt - (a.pausedMs || 0) - (a.pausedAt ? now - a.pausedAt : 0));
}

/** Pause the active workout. The rest timer freezes too. */
export function pauseWorkout(ctx: Ctx, now = Date.now()) {
  const a = ctx.s.active; if (!a || a.pausedAt) return;
  a.pausedAt = now;
}

/** Resume: the paused time is added to pausedMs and a running rest timer is pushed back by the same amount. */
export function resumeWorkout(ctx: Ctx, now = Date.now()) {
  const a = ctx.s.active; if (!a || !a.pausedAt) return;
  const paused = now - a.pausedAt;
  a.pausedMs = (a.pausedMs || 0) + paused;
  if (a.restEnd) a.restEnd += paused;
  a.pausedAt = null;
}

/** Replacing records the old exercise in replaced[]; history stays with the original exercise. */
export function replaceExercise(ctx: Ctx, planId: string, workoutId: string, itemId: string, newExId: string) {
  const w = workoutOf(ctx, workoutId, planId); const i = w?.items.find(x => x.id === itemId); if (!i) return;
  i.replaced.push({ exId: i.exId, date: ctx.today }); i.exId = newExId;
}
