/* "Log something else": unplanned food shrinks the meals not yet eaten so the day still lands on target. */
import * as R from '../index';
import { TABLES, fromTables } from '../../store/mapping';
import type { Ctx } from '../types';

const TODAY = '2026-09-30';
// A day with nothing eaten or prepped yet (the sample data pre-marks today's first meals).
const make = (): Ctx => {
  const ctx = { s: R.sampleState('2026-09-29'), today: TODAY }; R.ensureFuture(ctx);
  R.getDay(ctx, TODAY).meals.forEach(m => { m.logged = false; m.prepped = false; });
  return ctx;
};
const near = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('unplanned food (extras)', () => {
  it('without extras, day targets are the normal meal targets', () => {
    const ctx = make(); const day = R.getDay(ctx, TODAY);
    expect(R.dayMealTargets(ctx, TODAY)).toEqual(R.mealTargets(ctx, day.type));
  });

  it('counts as eaten, and the open meals share what is left of the day', () => {
    const ctx = make(); const day = R.getDay(ctx, TODAY); const T = R.dayTargets(ctx.s.profile, day.type);
    day.meals[0].logged = true;
    day.extras = [{ key: 'x1', name: 'Latte', estimate: { kcal: 190, p: 10, c: 18, f: 9 }, g: 0 }];
    const tgs = R.dayMealTargets(ctx, TODAY);
    const eaten = R.sumM(ctx.s, day.meals[0].items);
    // open meals add up to the target minus what was eaten (meal 1 + the latte), per macro
    const open = tgs.filter((_, i) => i > 0);
    near(open.reduce((a, t) => a + t.p, 0), T.protein - eaten.p - 10, 1);
    near(open.reduce((a, t) => a + t.c, 0), T.carbs - eaten.c - 18, 1);
    near(open.reduce((a, t) => a + t.f, 0), T.fat - eaten.f - 9, 1);
    // the eaten meal keeps its own target
    expect(tgs[0]).toEqual(R.mealTargets(ctx, day.type)[0]);
    // totals include the extra
    const tot = R.dayTotals(ctx, TODAY);
    near(tot.logged.kcal, eaten.kcal + 190, 0.01);
  });

  it('refitDay re-portions open meals smaller, and never below zero', () => {
    const ctx = make(); const day = R.getDay(ctx, TODAY);
    const before = R.sumM(ctx.s, day.meals.flatMap(m => m.items)).kcal;
    day.extras = [{ key: 'x1', name: 'Pizza', estimate: { kcal: 600, p: 25, c: 70, f: 24 }, g: 0 }];
    R.refitDay(ctx, TODAY);
    const after = R.sumM(ctx.s, day.meals.flatMap(m => m.items)).kcal;
    expect(after).toBeLessThan(before - 400);
    day.extras.push({ key: 'x2', name: 'Huge buffet', estimate: { kcal: 9000, p: 400, c: 900, f: 400 }, g: 0 });
    const tgs = R.dayMealTargets(ctx, TODAY);
    tgs.forEach(t => { expect(t.p).toBeGreaterThanOrEqual(0); expect(t.c).toBeGreaterThanOrEqual(0); expect(t.f).toBeGreaterThanOrEqual(0); });
  });

  it('a library food extra uses its macros per gram', () => {
    const ctx = make();
    const m = R.extraMacros(ctx.s, { key: 'x', name: 'Banana', foodId: 'banana', g: 118 });
    const per = R.macros(ctx.s, 'banana', 118);
    expect(m).toEqual(per);
  });

  it('round-trips through the sync tables', () => {
    const ctx = make(); const day = R.getDay(ctx, TODAY);
    day.extras = [{ key: 'xa', name: 'Banana', foodId: 'banana', g: 118 }, { key: 'xb', name: 'Latte', g: 0, estimate: { kcal: 190, p: 10, c: 18, f: 9 } }];
    const t: Record<string, Record<string, unknown>[]> = {};
    for (const d of TABLES) t[d.table] = d.rows(ctx.s).map(r => ({ ...r }));
    const back = fromTables(t, TODAY)!;
    expect(back.days[TODAY].extras).toEqual(day.extras);
  });
});
