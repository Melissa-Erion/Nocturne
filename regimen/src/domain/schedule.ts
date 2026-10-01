/* Scheduling engine — port of prototype/store.js (fill, regenerate, moveEntry, pause, resume, streak).
   Rules:
   - Walk forward day by day; on training days that are not paused and have no active entry,
     place rotation[idx] unless an adjacent day holds the same region and allowConsecutive is off.
   - Never set status "done" except by finishing a logged session (see workout.ts).
   - Missed → reschedule creates a new entry and keeps the missed record. */
import { workoutTimeOn } from './clock';
import { add, dow, fmtD } from './dates';
import type { Ctx, ISODate, Plan, ScheduleEntry, Workout } from './types';
import { uid } from './util';

export const HORIZON_DAYS = 70;

export const activePlan = ({ s }: Ctx): Plan => s.plans.find(p => p.id === s.activePlanId) || s.plans[0];

export const workoutOf = (ctx: Ctx, wid: string, planId?: string): Workout | undefined => {
  const p = planId ? ctx.s.plans.find(x => x.id === planId) : activePlan(ctx);
  return p && p.workouts.find(w => w.id === wid);
};

export const inPause = ({ s }: Ctx, d: ISODate) => s.pauses.some(p => d >= p.from && (!p.to || d <= p.to));
export const activePause = ({ s, today }: Ctx) => s.pauses.find(p => today >= p.from && (!p.to || today <= p.to));

export function nextRotationIndex(ctx: Ctx, fromDate: ISODate) {
  const plan = activePlan(ctx);
  const done = ctx.s.schedule.filter(e => e.date < fromDate && e.status === 'done' && e.planId === plan.id).sort((a, b) => a.date < b.date ? -1 : 1);
  const last = done[done.length - 1];
  if (!last) return 0;
  return (plan.rotation.indexOf(last.workoutId) + 1) % plan.rotation.length;
}

export function recoveryClash(ctx: Ctx, date: ISODate, wid: string, ignoreId?: string): { date: ISODate; name: string } | null {
  const plan = activePlan(ctx);
  if (plan.allowConsecutive) return null;
  const w = workoutOf(ctx, wid);
  if (!w) return null;
  for (const o of [-1, 1]) {
    const e = ctx.s.schedule.find(x => x.date === add(date, o) && x.id !== ignoreId && x.status !== 'skipped' && x.status !== 'missed');
    if (e) {
      const w2 = workoutOf(ctx, e.workoutId, e.planId);
      if (w2 && w2.region === w.region && w.region !== 'core') return { date: e.date, name: w2.name };
    }
  }
  return null;
}

export function fill(ctx: Ctx, fromDate: ISODate, idx: number, untilDate: ISODate) {
  const { s } = ctx; const plan = activePlan(ctx);
  if (!plan || !plan.rotation.length) return;
  let d = fromDate; let guard = 0;
  while (d <= untilDate && guard++ < 400) {
    if (s.profile.trainingDays.includes(dow(d)) && !inPause(ctx, d) && !s.schedule.some(e => e.date === d && e.status !== 'skipped' && e.status !== 'missed')) {
      const wid = plan.rotation[idx % plan.rotation.length];
      if (!recoveryClash(ctx, d, wid)) { s.schedule.push({ id: uid(), date: d, workoutId: wid, planId: plan.id, status: 'planned', origin: 'auto' }); idx++; }
    }
    d = add(d, 1);
  }
}

const byDate = (a: ScheduleEntry, b: ScheduleEntry) => a.date < b.date ? -1 : 1;

/** Rebuild auto-placed planned entries from a date, keeping manual moves and all history. */
export function regenerate(ctx: Ctx, fromDate: ISODate = ctx.today) {
  const { s } = ctx;
  const planned = s.schedule.filter(e => e.status === 'planned' && e.date >= fromDate).sort(byDate);
  const plan = activePlan(ctx);
  const idx = planned.length && planned[0].planId === plan.id ? plan.rotation.indexOf(planned[0].workoutId) : nextRotationIndex(ctx, fromDate);
  s.schedule = s.schedule.filter(e => !(e.status === 'planned' && e.date >= fromDate && e.origin === 'auto'));
  fill(ctx, fromDate, Math.max(0, idx), add(ctx.today, HORIZON_DAYS));
}

/** Keep the schedule populated HORIZON_DAYS ahead (called on load). */
export function ensureFuture(ctx: Ctx) {
  const { s, today } = ctx;
  if (!s.schedule.some(e => e.date >= today && e.status === 'planned')) { fill(ctx, today, nextRotationIndex(ctx, today), add(today, HORIZON_DAYS)); return; }
  // top up the far end so the horizon rolls forward day by day
  const last = s.schedule.filter(e => e.status === 'planned').sort(byDate).pop()!;
  const plan = activePlan(ctx);
  if (last.planId === plan.id && last.date < add(today, HORIZON_DAYS)) {
    const idx = (plan.rotation.indexOf(last.workoutId) + 1) % plan.rotation.length;
    fill(ctx, add(last.date, 1), Math.max(0, idx), add(today, HORIZON_DAYS));
  }
}

export const entriesOn = ({ s }: Ctx, d: ISODate) => s.schedule.filter(e => e.date === d).sort((a, b) => Number(a.status === 'missed') - Number(b.status === 'missed'));
export const entry = ({ s }: Ctx, id: string) => s.schedule.find(e => e.id === id);
export const todayEntry = ({ s, today }: Ctx) => s.schedule.find(e => e.date === today && (e.status === 'planned' || e.status === 'done'));
export const nextEntry = ({ s, today }: Ctx, after?: ISODate) => s.schedule.filter(e => e.status === 'planned' && e.date > (after || today)).sort(byDate)[0];

export interface MoveResult { error?: string; note?: string; warning?: string }

/** Move a planned entry to a new day.
    - Shift later ON: if the new day already has a planned workout, that workout moves to the next training day;
      if that day is taken too, its workout moves on one training day, and so on until a free day. Each workout moves
      at most one training day, and workouts between the old and new dates are untouched, so nothing jumps weeks.
    - Shift later OFF: the moved workout simply joins the new day; nothing else moves (no swapping). */
export function moveEntry(ctx: Ctx, id: string, newDate: ISODate, shift?: boolean | null): MoveResult {
  const { s } = ctx;
  const e = entry(ctx, id);
  if (!e || e.status === 'done') return { error: 'Completed workouts stay on the day they were logged.' };
  const shiftLater = shift == null ? s.profile.shiftLater : shift;
  const occupants = s.schedule.filter(x => x.date === newDate && x.id !== id && x.status === 'planned');
  let note = '';
  e.date = newDate;
  if (shiftLater && occupants.length) {
    let bumped = occupants; let from = newDate; let count = 0;
    while (bumped.length && count < 200) {
      const d = nextTrainingDay(ctx, from); if (!d) break;
      const next = s.schedule.filter(x => x.date === d && x.status === 'planned' && x.id !== id);
      bumped.forEach(o => { o.date = d; o.origin = 'manual'; count++; });
      bumped = next.filter(x => !bumped.includes(x)); from = d;
    }
    const first = workoutOf(ctx, occupants[0].workoutId, occupants[0].planId)?.name;
    note = count === 1 ? `${first} moved to ${fmtD(occupants[0].date)}.` : `${first} and ${count - 1} later workout${count > 2 ? 's' : ''} each moved one training day later.`;
  } else if (occupants.length) {
    note = `${fmtD(newDate)} now has ${occupants.length + 1} workouts.`;
  }
  e.origin = 'manual';
  const clash = recoveryClash(ctx, newDate, e.workoutId, e.id);
  const name = workoutOf(ctx, e.workoutId, e.planId)?.name;
  return { note, warning: clash ? `${name} is next to ${clash.name} (${fmtD(clash.date)}) — same muscle groups on consecutive days.` : '' };
}

/** Next training day after `after` that isn't paused. */
export function nextTrainingDay(ctx: Ctx, after: ISODate): ISODate | null {
  let d = add(after, 1);
  for (let g = 0; g < 21; g++, d = add(d, 1)) if (ctx.s.profile.trainingDays.includes(dow(d)) && !inPause(ctx, d)) return d;
  return null;
}

/** Rebuild upcoming workouts from the plan: every planned workout from today on is removed (including moved ones)
    and the rotation is refilled from where the logged history left off. History and pauses are kept. */
export function resetSchedule(ctx: Ctx) {
  const { s, today } = ctx;
  s.schedule = s.schedule.filter(e => !(e.status === 'planned' && e.date >= today));
  fill(ctx, today, nextRotationIndex(ctx, today), add(today, HORIZON_DAYS));
}

export function swapEntries(ctx: Ctx, a: string, b: string) {
  const A = entry(ctx, a), B = entry(ctx, b); if (!A || !B) return;
  const t = A.date; A.date = B.date; B.date = t; A.origin = B.origin = 'manual';
}
export function skipEntry(ctx: Ctx, id: string) { const e = entry(ctx, id); if (e && e.status === 'planned') e.status = 'skipped'; }
export function missEntry(ctx: Ctx, id: string) { const e = entry(ctx, id); if (e && e.status === 'planned') e.status = 'missed'; }
export function restoreEntry(ctx: Ctx, id: string) { const e = entry(ctx, id); if (e && (e.status === 'skipped' || e.status === 'missed')) e.status = 'planned'; }

export function rescheduleMissed(ctx: Ctx, id: string, date: ISODate) {
  const e = entry(ctx, id); if (!e) return;
  const n: ScheduleEntry = { id: uid(), date, workoutId: e.workoutId, planId: e.planId, status: 'planned', origin: 'rescheduled', from: e.id };
  e.rescheduledTo = n.id; ctx.s.schedule.push(n);
}

/** Pause removes planned entries from its start and refills after it, starting with the same next workout. */
export function pause(ctx: Ctx, from: ISODate, to: ISODate | null, reason: string) {
  const { s } = ctx;
  s.pauses.push({ id: uid(), from, to: to || null, reason });
  const planned = s.schedule.filter(e => e.status === 'planned' && e.date >= from).sort(byDate);
  const idx = planned.length ? activePlan(ctx).rotation.indexOf(planned[0].workoutId) : nextRotationIndex(ctx, from);
  s.schedule = s.schedule.filter(e => !(e.status === 'planned' && e.date >= from));
  fill(ctx, from, Math.max(0, idx), add(ctx.today, HORIZON_DAYS));
}

/** Resume closes the pause yesterday and refills from today. The rotation is never lost. */
export function resume(ctx: Ctx) {
  const { s, today } = ctx;
  const p = activePause(ctx) || s.pauses.find(x => !x.to); if (!p) return;
  const planned = s.schedule.filter(e => e.status === 'planned' && e.date >= today).sort(byDate);
  const idx = planned.length ? activePlan(ctx).rotation.indexOf(planned[0].workoutId) : nextRotationIndex(ctx, today);
  p.to = add(today, -1);
  if (p.to < p.from) s.pauses = s.pauses.filter(x => x !== p);
  s.schedule = s.schedule.filter(e => !(e.status === 'planned' && e.date >= today));
  fill(ctx, today, Math.max(0, idx), add(today, HORIZON_DAYS));
}

export function weekStats({ s }: Ctx, mon: ISODate) {
  const all = s.schedule.filter(e => e.date >= mon && e.date <= add(mon, 6));
  const done = all.filter(e => e.status === 'done').length;
  const total = all.filter(e => e.status !== 'missed' || !e.rescheduledTo).filter(e => e.status !== 'skipped').length;
  return { done, total: Math.max(total, done), missed: all.filter(e => e.status === 'missed').length, skipped: all.filter(e => e.status === 'skipped').length, pct: total ? Math.round(done / total * 100) : 0, ents: all.filter(e => e.origin !== 'rescheduled') };
}

/** Consecutive done entries counting back; missed entries that were rescheduled don't break it. */
export function streak({ s, today }: Ctx) {
  const past = s.schedule.filter(e => e.date <= today && e.status !== 'planned' && e.status !== 'skipped').sort((a, b) => a.date < b.date ? 1 : -1);
  let n = 0;
  for (const e of past) {
    if (e.status === 'done') n++;
    else if (e.status === 'missed' && !e.rescheduledTo) break;
  }
  return n;
}

export function icsExport(ctx: Ctx) {
  const { s } = ctx;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Regimen//Fitness//EN'];
  s.schedule.filter(e => e.status === 'planned').forEach(e => {
    const w = workoutOf(ctx, e.workoutId, e.planId); if (!w) return;
    const [h, m] = workoutTimeOn(s.profile, dow(e.date)).padStart(5, '0').split(':');
    const dt = e.date.replace(/-/g, '') + 'T' + h + m + '00';
    lines.push('BEGIN:VEVENT', 'UID:' + e.id + '@regimen', 'DTSTART:' + dt, 'DURATION:PT' + s.profile.duration + 'M', 'SUMMARY:' + w.name, 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
