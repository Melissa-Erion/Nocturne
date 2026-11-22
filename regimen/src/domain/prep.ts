/* Meal prep and grocery — port of prototype/store.js (prepCalc, recipeNutrition, groceryList).
   For cooked-basis foods, raw purchase = cooked ÷ yield and is flagged as an estimated yield. */
import { food, getDay, mealTargets, sumM } from './nutrition';
import { add } from './dates';
import type { Ctx, ISODate, Macros, PrepPlan, Recipe, SavedMeal, State } from './types';
import { makeUnits } from './units';
import { sum } from './util';

export const prepSource = (s: State, p: PrepPlan): Recipe | SavedMeal | undefined =>
  p.kind === 'recipe' ? s.recipes.find(r => r.id === p.mealId) : s.savedMeals.find(m => m.id === p.mealId);

export function recipeNutrition(s: State, r: Recipe) {
  const tot = sumM(s, r.ingredients); const raw = sum(r.ingredients.map(i => i.g)); const cw = r.cookedWeight || raw;
  return {
    tot, raw, cooked: cw,
    perServing: { kcal: tot.kcal / r.servings, p: tot.p / r.servings, c: tot.c / r.servings, f: tot.f / r.servings },
    servingG: cw / r.servings,
    per100: { kcal: tot.kcal / cw * 100, p: tot.p / cw * 100, c: tot.c / cw * 100, f: tot.f / cw * 100 },
  };
}

export interface PrepLine {
  foodId: string; name: string; basis: string; buyG: number; perG: number | null; est: boolean;
  rawId?: string; rawBasis?: string; expected?: number | null; actual?: number | null; perBasis?: string; yld?: number;
}
export interface PrepResult { name: string; n: number; lines: PrepLine[]; perContainer: Macros; estimated: boolean; batchG?: number; perContainerG?: number }

export function prepCalc(s: State, p: PrepPlan): PrepResult | null {
  const src = prepSource(s, p); if (!src) return null; const n = p.containers * (p.people || 1);
  if (p.kind === 'recipe') {
    const r = src as Recipe; const rn = recipeNutrition(s, r); const scale = n / r.servings;
    const actual = p.actual.total; const cw = actual || rn.cooked * scale;
    return {
      name: r.name, n,
      lines: r.ingredients.map(i => { const f = food(s, i.foodId)!; return { foodId: i.foodId, name: f.name, basis: f.basis, buyG: i.g * scale, perG: null, est: false }; }),
      perContainer: { kcal: rn.tot.kcal * scale / n, p: rn.tot.p * scale / n, c: rn.tot.c * scale / n, f: rn.tot.f * scale / n },
      batchG: cw, perContainerG: cw / n, estimated: !actual,
    };
  }
  const m = src as SavedMeal;
  const lines = m.items.filter(i => !i.estimate && food(s, i.foodId)).map(i => {
    const f = food(s, i.foodId)!; const totalAsListed = i.g * n; let rawF = f, buyG = totalAsListed, est = false, expected: number | null = null;
    if (f.basis === 'cooked' && f.rawId) { rawF = food(s, f.rawId)!; buyG = totalAsListed / f.yld!; est = true; expected = totalAsListed; }
    else if (f.basis === 'raw' && f.cookedId) { expected = totalAsListed * f.yld!; est = true; }
    const act = p.actual[i.foodId];
    const perG = f.basis === 'cooked' ? (act ? act / n : i.g) : (f.cookedId ? (act ? act / n : i.g * f.yld!) : i.g);
    return { foodId: i.foodId, name: f.name, basis: f.basis, rawId: rawF.id, rawBasis: rawF.basis, buyG, expected, actual: act || null, perG, perBasis: f.cookedId || f.basis === 'cooked' ? 'cooked' : f.basis, est: est && !act, yld: f.yld };
  });
  const per = sumM(s, m.items);
  return { name: m.name, n, lines, perContainer: per, estimated: lines.some(l => l.est) };
}

export interface GroceryRow { id: string; name: string; basis: string; cat: string; g: number; est: boolean; from: string[]; buy: string }

/** Combines raw ingredients across prep plans, converts to purchase units and groups by category. */
/** What to buy for a food as listed in a meal: cooked foods are bought raw (cooked ÷ yield, an estimate). */
function toBuy(s: State, foodId: string, g: number) {
  const f = food(s, foodId); if (!f) return null;
  if (f.basis === 'cooked' && f.rawId && f.yld) return { id: f.rawId, g: g / f.yld, est: true };
  return { id: f.id, g, est: false };
}

/** Planned (not yet eaten) meals from today for `days` days, optionally only some meal slots. */
export function planMeals(ctx: Ctx, days: number, slots?: number[]) {
  const out: { date: ISODate; slot: number; label: string; items: { foodId: string; g: number }[] }[] = [];
  for (let k = 0; k < days; k++) {
    const d = add(ctx.today, k); const day = getDay(ctx, d); const tg = mealTargets(ctx, day.type);
    day.meals.forEach((m, i) => {
      if (m.logged || (slots && !slots.includes(i))) return;
      out.push({ date: d, slot: i, label: tg[i]?.label || `Meal ${i + 1}`, items: m.items.filter(x => !x.estimate && food(ctx.s, x.foodId)).map(x => ({ foodId: x.foodId, g: x.g })) });
    });
  }
  return out;
}

export interface PlanPrep {
  /** Per food: total as listed in the meals (cooked weight for cooked foods) and what to buy. */
  cook: { foodId: string; name: string; basis: string; g: number; buyId: string; buyName: string; buyBasis: string; buyG: number; est: boolean }[];
  /** One container per planned meal. */
  boxes: { date: ISODate; label: string; items: { foodId: string; name: string; basis: string; g: number }[] }[];
}

/** Batch-cook from the meal plan: totals to cook and buy, and what goes in each container. */
export function prepFromPlan(ctx: Ctx, days: number, slots: number[]): PlanPrep {
  const { s } = ctx; const meals = planMeals(ctx, days, slots);
  const tot: Record<string, number> = {};
  meals.forEach(m => m.items.forEach(i => { tot[i.foodId] = (tot[i.foodId] || 0) + i.g; }));
  const cook = Object.entries(tot).map(([id, g]) => {
    const f = food(s, id)!; const b = toBuy(s, id, g)!; const bf = food(s, b.id)!;
    return { foodId: id, name: f.name, basis: f.basis, g, buyId: b.id, buyName: bf.name, buyBasis: bf.basis, buyG: b.g, est: b.est };
  }).sort((a, b) => b.g - a.g);
  const boxes = meals.map(m => ({ date: m.date, label: m.label, items: m.items.map(i => { const f = food(s, i.foodId)!; return { foodId: i.foodId, name: f.name, basis: f.basis, g: i.g }; }) }));
  return { cook, boxes };
}

/** Shopping list for the next `days` days of the meal plan plus any recipe/meal prep plans (manual items are separate).
    Removed items are left out. */
export function shoppingList(ctx: Ctx, days: number): GroceryRow[] {
  const { s } = ctx;
  const extra: Record<string, Omit<GroceryRow, 'buy'>> = {};
  planMeals(ctx, days).forEach(m => m.items.forEach(i => {
    const b = toBuy(s, i.foodId, i.g); if (!b) return; const f = food(s, b.id)!;
    if (!extra[b.id]) extra[b.id] = { id: b.id, name: f.name, basis: f.basis, cat: f.cat, g: 0, est: false, from: [] };
    extra[b.id].g += b.g; extra[b.id].est = extra[b.id].est || b.est;
    if (!extra[b.id].from.includes('Meal plan')) extra[b.id].from.push('Meal plan');
  }));
  return groceryList(s, extra).filter(r => !s.grocery.removed?.[r.id]);
}

export function groceryList(s: State, extra: Record<string, Omit<GroceryRow, 'buy'>> = {}): GroceryRow[] {
  const U = makeUnits(s);
  const agg: Record<string, Omit<GroceryRow, 'buy'>> = Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, { ...v, from: [...v.from] }]));
  s.prep.forEach(p => {
    const c = prepCalc(s, p); if (!c) return;
    c.lines.forEach(l => {
      const id = l.rawId || l.foodId; const f = food(s, id); if (!f) return;
      if (!agg[id]) agg[id] = { id, name: f.name, basis: f.basis, cat: f.cat, g: 0, est: false, from: [] };
      agg[id].g += l.buyG; agg[id].est = agg[id].est || l.est || (food(s, l.foodId)?.basis === 'cooked'); agg[id].from.push(c.name);
    });
  });
  return Object.values(agg).map(a => {
    const b = food(s, a.id)!.buy; let buy: string;
    if (b) { const q = Math.max(1, Math.ceil(a.g / b.g - 0.05)); buy = `${q} × ${b.unit}${b.g ? ` (${U.g(b.g)})` : ''}`; }
    else buy = U.g(Math.ceil(a.g / 50) * 50);
    return { ...a, buy, from: [...new Set(a.from)] };
  }).sort((a, b) => a.cat < b.cat ? -1 : a.cat > b.cat ? 1 : a.name < b.name ? -1 : 1);
}
