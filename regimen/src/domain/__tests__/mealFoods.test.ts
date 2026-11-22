/* "Choose my foods": picks per meal drive today's and future days' meals; eaten meals are left alone. */
import * as R from '../index';
import { fromTables, TABLES } from '../../store/mapping';
import type { Ctx } from '../types';

const TODAY = '2026-11-16';
const make = (): Ctx => { const s = R.sampleState(TODAY); s.sample = false; const ctx = { s, today: TODAY }; R.getDay(ctx, TODAY); R.getDay(ctx, R.add(TODAY, 1)); return ctx; };
const ids = (ctx: Ctx, d: string, i: number) => R.getDay(ctx, d).meals[i].items.map(x => x.foodId).sort();

describe('setMealFoods', () => {
  it('rebuilds every meal from today on from the picks, portioned to the target', () => {
    const ctx = make();
    const picks = [['oats', 'yog'], ['chicken_c', 'rice_c', 'broccoli_c'], ['cottage', 'banana'], ['salmon_r', 'potato_c']];
    R.setMealFoods(ctx, picks);
    for (const d of [TODAY, R.add(TODAY, 1)]) picks.forEach((p, i) => expect(ids(ctx, d, i)).toEqual([...p].sort()));
    const t = R.dayMealTargets(ctx, TODAY)[1]; const m = R.sumM(ctx.s, R.getDay(ctx, TODAY).meals[1].items);
    expect(Math.abs(m.p - t.p)).toBeLessThan(8);
    // days created later use the picks too
    expect(ids(ctx, R.add(TODAY, 5), 0)).toEqual(['oats', 'yog']);
  });

  it('leaves eaten and prepped meals alone, and can change a single meal', () => {
    const ctx = make();
    const day = R.getDay(ctx, TODAY); day.meals[0].logged = true; const before = ids(ctx, TODAY, 0);
    R.setMealFoods(ctx, [['oats'], ['tuna', 'bread'], [], []]);
    expect(ids(ctx, TODAY, 0)).toEqual(before);
    expect(ids(ctx, TODAY, 1)).toEqual(['bread', 'tuna']);
    const dinner = ids(ctx, TODAY, 3);
    R.setMealFoods(ctx, [['oats'], ['eggs', 'bread'], [], []], 1);
    expect(ids(ctx, TODAY, 1)).toEqual(['bread', 'eggs']);
    expect(ids(ctx, TODAY, 3)).toEqual(dinner);
  });

  it('round-trips through the database mapping', () => {
    const ctx = make();
    R.setMealFoods(ctx, [['oats', 'yog'], ['chicken_c'], [], []]);
    const tables = Object.fromEntries(TABLES.map(t => [t.table, t.rows(ctx.s)]));
    const back = fromTables(tables as never, TODAY);
    expect(back!.profile.mealFoods).toEqual([['oats', 'yog'], ['chicken_c'], [], []]);
  });
});
