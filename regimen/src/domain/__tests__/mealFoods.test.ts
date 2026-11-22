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

describe('building meals from the foods you like', () => {
  it('puts a protein and a carb in every meal, veg in main meals, and suits breakfast and snacks', () => {
    const ctx = make();
    const likes = ['chicken_c', 'salmon_r', 'eggs', 'yog', 'oats', 'rice_c', 'potato_c', 'banana', 'broccoli_c', 'almonds', 'avocado'];
    const plan = R.mealsFromLikes(ctx.s, likes, ['Breakfast', 'Lunch', 'Snack', 'Dinner']);
    const role = (id: string) => R.food(ctx.s, id)!.role;
    plan.forEach(m => { expect(m.map(role)).toContain('protein'); expect(m.map(role)).toContain('carb'); m.forEach(id => expect(likes).toContain(id)); });
    expect(['eggs', 'yog']).toContain(plan[0].find(id => role(id) === 'protein'));
    expect(plan[0]).toContain('oats');
    expect(plan[1]).toContain('broccoli_c'); expect(plan[3]).toContain('broccoli_c');
    expect(plan[1].find(id => role(id) === 'protein')).not.toBe(plan[3].find(id => role(id) === 'protein'));
  });
});

describe('automatic amounts', () => {
  it('a swap replaces the food and works the whole meal out again (nothing fixed)', () => {
    const ctx = make();
    R.setMealFoods(ctx, [['oats', 'yog'], ['chicken_c', 'rice_c'], [], []]);
    const m = R.getDay(ctx, TODAY).meals[1]; const chicken = m.items.find(x => x.foodId === 'chicken_c')!;
    expect(R.swapFood(ctx, TODAY, 1, chicken.key!, 'salmon_r')).toBe(true);
    const it = R.getDay(ctx, TODAY).meals[1].items.find(x => x.key === chicken.key)!;
    expect(it.foodId).toBe('salmon_r'); expect(it.locked).toBe(false);
    const t = R.dayMealTargets(ctx, TODAY)[1]; const sum = R.sumM(ctx.s, R.getDay(ctx, TODAY).meals[1].items);
    expect(Math.abs(sum.p - t.p)).toBeLessThan(8);
  });

  it('a typed amount stays fixed while the other foods adjust, and Auto undoes it', () => {
    const ctx = make();
    R.setMealFoods(ctx, [['oats', 'yog'], ['chicken_c', 'rice_c', 'potato_c'], [], []]);
    const get = (id: string) => R.getDay(ctx, TODAY).meals[1].items.find(x => x.foodId === id)!;
    const potato0 = get('potato_c').g;
    R.setAmount(ctx, TODAY, 1, get('rice_c').key!, 20);
    expect(get('rice_c').g).toBe(20); expect(get('rice_c').locked).toBe(true);
    expect(get('potato_c').g).toBeGreaterThan(potato0); // the other carb makes up for less rice
    R.autoAmount(ctx, TODAY, 1, get('rice_c').key!);
    expect(get('rice_c').locked).toBe(false); expect(get('rice_c').g).not.toBe(20);
  });

  it('"always use this instead" updates the saved foods for that meal from today on', () => {
    const ctx = make();
    R.setMealFoods(ctx, [['oats', 'yog'], ['chicken_c', 'rice_c'], [], []]);
    R.rememberSwap(ctx, 1, 'chicken_c', 'tofu');
    expect(ctx.s.profile.mealFoods![1]).toEqual(['tofu', 'rice_c']);
    expect(ids(ctx, R.add(TODAY, 1), 1)).toEqual(['rice_c', 'tofu']);
    expect(ctx.s.profile.mealFoods![0]).toEqual(['oats', 'yog']);
  });
});
