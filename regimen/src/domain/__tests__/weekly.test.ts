/* Weekly mode: more available days than plan workouts → each week runs the plan once from Day 1. */
import * as R from '../index';
import type { Ctx } from '../types';

const TODAY = '2026-11-16'; // a Monday
const make = (days: number[], today = TODAY): Ctx => {
  const s = R.sampleState(today);
  s.schedule = s.schedule.filter(e => e.date < today && e.status !== 'planned');
  s.profile.trainingDays = days; s.activePlanId = 'ul4';
  const ctx = { s, today }; R.ensureFuture(ctx); return ctx;
};
const week = (ctx: Ctx, mon: string) => ctx.s.schedule
  .filter(e => e.status === 'planned' && e.date >= mon && e.date <= R.add(mon, 6))
  .sort((a, b) => a.date < b.date ? -1 : 1);

describe('weekly mode', () => {
  const rot = () => R.activePlan(make([0, 1, 2, 3, 5, 6])).rotation;

  it('6 available days and a 4-workout plan: 4 per week, Day 1 every Monday', () => {
    const ctx = make([0, 1, 2, 3, 5, 6]);
    for (let w = 0; w < 8; w++) {
      const ents = week(ctx, R.add(TODAY, w * 7));
      expect(ents.map(e => e.workoutId)).toEqual(rot());
      expect(ents.map(e => R.dow(e.date))).toEqual([0, 1, 3, 5]); // Mon Tue Thu Sat
    }
  });

  it('a skipped workout leaves that week one short; next week starts at Day 1', () => {
    const ctx = make([0, 1, 2, 3, 5, 6]);
    const first = week(ctx, TODAY)[0];
    R.skipEntry(ctx, first.id);
    R.ensureFuture(ctx);
    expect(week(ctx, TODAY).length).toBe(3);
    expect(week(ctx, R.add(TODAY, 7))[0].workoutId).toBe(rot()[0]);
  });

  it('starting mid-week continues the week and resets on Monday', () => {
    const ctx = make([0, 1, 2, 3, 5, 6], '2026-11-19'); // Thursday
    const before = ctx.s.schedule.filter(e => e.planId === 'ul4' && e.date >= TODAY && e.date < '2026-11-19').length;
    expect(week(ctx, TODAY).map(e => e.workoutId)).toEqual(rot().slice(before).slice(0, week(ctx, TODAY).length));
    expect(week(ctx, R.add(TODAY, 7)).map(e => e.workoutId)).toEqual(rot());
  });

  it('rebuilds an old schedule that ran the rotation on every available day', () => {
    const ctx = make([0, 1, 2, 3, 5, 6]);
    ctx.s.schedule = ctx.s.schedule.filter(e => !(e.status === 'planned' && e.date >= TODAY));
    const r = rot(); let i = 0;
    for (let d = TODAY; d <= R.add(TODAY, 20); d = R.add(d, 1)) if (R.dow(d) !== 4) ctx.s.schedule.push({ id: 'x' + d, date: d, workoutId: r[i++ % r.length], planId: 'ul4', status: 'planned', origin: 'auto' });
    R.ensureFuture(ctx);
    for (let w = 0; w < 3; w++) expect(week(ctx, R.add(TODAY, w * 7)).map(e => e.workoutId)).toEqual(r);
  });

  it('pause and resume keep the weekly shape', () => {
    const ctx = make([0, 1, 2, 3, 5, 6]);
    R.pause(ctx, TODAY, null, 'Travel');
    ctx.today = R.add(TODAY, 14); R.resume(ctx);
    expect(week(ctx, ctx.today).map(e => e.workoutId)).toEqual(rot());
  });

  it('as many days as workouts keeps the continuous rotation', () => {
    const ctx = make([0, 1, 3, 4]);
    expect(R.weeklyMode(ctx)).toBe(false);
    expect(week(ctx, TODAY).length).toBe(4);
  });
});
