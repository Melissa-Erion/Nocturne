/* Same-type food alternatives, and changing meals per day without leaving blank meals. */
import * as R from '../index';
import type { Ctx, Food } from '../types';

const TODAY = '2026-09-29';

test('a fat is only swapped for fats, even when a custom protein is a close macro match', () => {
  const s = R.newUserState(TODAY);
  const salmonish: Food = { id: 'cf_fatty_protein', name: 'My fatty fish', basis: 'cooked', kcal: 250, p: 22, c: 0, f: 18, role: 'protein', cat: 'Meat & fish', tags: [], src: 'Custom', est: false };
  s.customFoods[salmonish.id] = salmonish;
  const alts = R.alternatives(s, 'oil', 10);
  expect(alts.length).toBeGreaterThan(0);
  expect(alts.every(a => a.food.role === 'fat')).toBe(true);
  expect(R.alternatives(s, 'chicken_c', 150).every(a => a.food.role === 'protein')).toBe(true);
});

describe('setMealsPerDay', () => {
  const make = (): Ctx => { const ctx = { s: R.sampleState(TODAY), today: TODAY }; R.ensureFuture(ctx); return ctx; };

  test('4 → 5: the new meal has a time after the last one, food in it, and today adds up to the targets again', () => {
    const ctx = make();
    const tomorrow = R.add(TODAY, 1); R.getDay(ctx, tomorrow);
    R.setMealsPerDay(ctx, 5);
    expect(ctx.s.profile.mealsPerDay).toBe(5);
    const slot = ctx.s.mealSlots.training[4];
    expect(slot.time > ctx.s.mealSlots.training[3].time).toBe(true);
    const day = R.getDay(ctx, tomorrow);
    expect(day.meals).toHaveLength(5);
    expect(day.meals[4].items.length).toBeGreaterThan(0);
    // Unlogged meals are re-portioned to the new, smaller per-meal targets: the day's protein lands near the target.
    const T = R.dayTargets(ctx.s.profile, day.type);
    const p = R.sum(day.meals.flatMap(m => m.items).map(i => R.macros(ctx.s, i.foodId, i.g).p));
    expect(Math.abs(p - T.protein)).toBeLessThan(T.protein * 0.12);
  });

  test('past days and logged meals are left alone', () => {
    const ctx = make();
    const before = JSON.stringify(ctx.s.days['2026-09-20'] ?? null);
    const todayDay = R.getDay(ctx, TODAY); const logged = JSON.stringify(todayDay.meals.filter(m => m.logged));
    R.setMealsPerDay(ctx, 5);
    expect(JSON.stringify(ctx.s.days['2026-09-20'] ?? null)).toBe(before);
    expect(JSON.stringify(R.getDay(ctx, TODAY).meals.filter(m => m.logged))).toBe(logged);
  });

  test('stays between 2 and 6 meals', () => {
    const ctx = make();
    R.setMealsPerDay(ctx, 9); expect(ctx.s.profile.mealsPerDay).toBe(6);
    expect(ctx.s.mealSlots.rest.length).toBeGreaterThanOrEqual(6);
    R.setMealsPerDay(ctx, 1); expect(ctx.s.profile.mealsPerDay).toBe(2);
  });
});

describe('rebalanceMeals', () => {
  test('after targets change, planned meals are re-portioned to their new targets (logged and prepped stay)', () => {
    const ctx: Ctx = { s: R.sampleState(TODAY), today: TODAY }; R.ensureFuture(ctx);
    const d = R.add(TODAY, 1); const day = R.getDay(ctx, d);
    const sig = R.targetsSignature(ctx.s);
    ctx.s.profile.carbs += 60; ctx.s.profile.kcal += 240; // e.g. the user raises their carbs
    expect(R.targetsSignature(ctx.s)).not.toBe(sig);
    day.meals[0].prepped = true; const prepped = JSON.stringify(day.meals[0].items);
    R.rebalanceMeals(ctx);
    const tg = R.mealTargets(ctx, day.type);
    day.meals.forEach((m, i) => {
      if (i === 0) return expect(JSON.stringify(m.items)).toBe(prepped);
      const c = R.sum(m.items.map(it => R.macros(ctx.s, it.foodId, it.g).c));
      expect(Math.abs(c - tg[i].c)).toBeLessThan(6);
    });
  });
});
