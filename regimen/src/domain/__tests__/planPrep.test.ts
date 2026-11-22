/* Grocery list and meal prep built from the meal plan. */
jest.mock('@/lib/supabase', () => ({ supabase: null, PHOTO_BUCKET: 'progress-photos' }));
import * as R from '../index';
import { fromTables, TABLES } from '@/store/mapping';
import type { Ctx } from '../types';

const TODAY = '2026-11-16';
const make = (): Ctx => { const s = R.sampleState(TODAY); s.sample = false; s.prep = []; const ctx = { s, today: TODAY }; R.getDay(ctx, TODAY); R.setMealFoods(ctx, [['oats', 'yog'], ['chicken_c', 'rice_c', 'broccoli_c'], ['cottage', 'banana'], ['salmon_r', 'potato_c']]); return ctx; };

describe('shopping list from the meal plan', () => {
  it('adds up the next N days, buys cooked foods raw, and skips eaten meals', () => {
    const ctx = make();
    const one = R.shoppingList(ctx, 1); const three = R.shoppingList(ctx, 3);
    const chicken = (l: R.GroceryRow[]) => l.find(r => r.id === 'chicken_r')!;
    expect(chicken(one)).toBeTruthy();             // cooked chicken in the plan → raw chicken to buy
    expect(chicken(one).est).toBe(true);
    expect(one.find(r => r.id === 'chicken_c')).toBeUndefined();
    expect(chicken(three).g).toBeGreaterThan(chicken(one).g * 2.5);
    R.getDay(ctx, TODAY).meals[1].logged = true;   // lunch eaten
    expect(R.shoppingList(ctx, 1).find(r => r.id === 'chicken_r')).toBeUndefined();
  });

  it('removed items stay off the list', () => {
    const ctx = make();
    ctx.s.grocery.removed = { oats: true };
    expect(R.shoppingList(ctx, 3).find(r => r.id === 'oats')).toBeUndefined();
    expect(R.shoppingList(ctx, 3).find(r => r.id === 'yog')).toBeTruthy();
  });
});

describe('prep from the meal plan', () => {
  it('one container per chosen meal per day, with totals to cook and buy', () => {
    const ctx = make();
    const p = R.prepFromPlan(ctx, 5, [1, 3]);
    expect(p.boxes.length).toBe(10);
    expect(new Set(p.boxes.map(b => b.label))).toEqual(new Set([R.getDay(ctx, TODAY) && R.mealTargets(ctx, R.getDay(ctx, TODAY).type)[1].label, R.mealTargets(ctx, R.getDay(ctx, TODAY).type)[3].label]));
    const ch = p.cook.find(c => c.foodId === 'chicken_c')!;
    const sumBoxes = p.boxes.flatMap(b => b.items).filter(i => i.foodId === 'chicken_c').reduce((a, i) => a + i.g, 0);
    expect(ch.g).toBeCloseTo(sumBoxes);
    expect(ch.buyId).toBe('chicken_r'); expect(ch.buyG).toBeGreaterThan(ch.g);
    expect(p.cook.find(c => c.foodId === 'oats')).toBeUndefined(); // breakfast not chosen
  });
});

it('removed grocery items and prep/shop settings round-trip through the database mapping', () => {
  const ctx = make();
  ctx.s.grocery.removed = { oats: true }; ctx.s.grocery.checked = { yog: true };
  ctx.s.profile.shopDays = 5; ctx.s.profile.prepDays = 4; ctx.s.profile.prepMeals = [1, 3];
  const back = fromTables(Object.fromEntries(TABLES.map(t => [t.table, t.rows(ctx.s)])) as never, TODAY)!;
  expect(back.grocery.removed).toEqual({ oats: true }); expect(back.grocery.checked).toEqual({ yog: true });
  expect([back.profile.shopDays, back.profile.prepDays, back.profile.prepMeals]).toEqual([5, 4, [1, 3]]);
});
