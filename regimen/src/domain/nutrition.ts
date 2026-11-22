/* Nutrition engine — port of prototype/store.js (macros, reconcile, mealTargets, solve, getDay, alternatives). */
import { FOODS } from './data/foods';
import type { Ctx, DayExtra, DayPlan, DayType, DistributionMode, Food, ISODate, MacroTargets, Macros, MealItem, Profile, State } from './types';
import { sum, uid } from './util';

export const food = (s: State, id: string): Food | undefined => FOODS[id] || s.customFoods[id];
export const allFoods = (s: State): Food[] => Object.values(FOODS).concat(Object.values(s.customFoods));

const ZERO: Macros = { kcal: 0, p: 0, c: 0, f: 0 };

export const macros = (s: State, foodId: string, g: number): Macros => {
  const f = food(s, foodId); if (!f) return { ...ZERO };
  const k = g / 100; return { kcal: f.kcal * k, p: f.p * k, c: f.c * k, f: f.f * k };
};

export const sumM = (s: State, items: MealItem[]): Macros => items.reduce((a, i) => {
  const m = i.estimate ? i.estimate : macros(s, i.foodId, i.g);
  return { kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f };
}, { ...ZERO });

/** Macros of the unplanned food logged on a day ("Log something else"). */
export const extraMacros = (s: State, x: DayExtra): Macros => x.estimate ? x.estimate : x.foodId ? macros(s, x.foodId, x.g) : { ...ZERO };
export const sumExtras = (s: State, day: DayPlan): Macros => (day.extras || []).reduce((a, x) => {
  const m = extraMacros(s, x); return { kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f };
}, { ...ZERO });

/** Integer largest-remainder rounding: the parts always sum exactly to `total`. */
export function reconcile(total: number, weights: number[]): number[] {
  const W = sum(weights) || 1; const raw = weights.map(w => total * w / W); const fl = raw.map(Math.floor); let rem = total - sum(fl);
  raw.map((r, i) => [r - fl[i], i] as [number, number]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rem > 0) { fl[i]++; rem--; } });
  return fl;
}

/** Daily targets for a day type: rest days use restTargets when set, otherwise the training-day targets. */
export const dayTargets = (P: Profile, type: DayType): MacroTargets =>
  type === 'rest' && P.restTargets ? P.restTargets : { kcal: P.kcal, protein: P.protein, carbs: P.carbs, fat: P.fat };

export const dayType = ({ s }: Ctx, d: ISODate): DayType =>
  s.days[d] && s.days[d].type ? s.days[d].type : (s.schedule.some(e => e.date === d && (e.status === 'planned' || e.status === 'done')) ? 'training' : 'rest');

export interface MealTarget { name: string; label: string; time: string; p: number; c: number; f: number; kcal: number }

export function mealTargets({ s }: Ctx, type: DayType, mode?: DistributionMode): MealTarget[] {
  const P = s.profile, n = P.mealsPerDay, dist = s.distribution; mode = mode || dist.mode;
  const slots = (s.mealSlots[type] || s.mealSlots.training).slice(0, n);
  while (slots.length < n) slots.push({ name: 'Meal ' + (slots.length + 1), label: 'Meal', time: '' });
  let wp = Array(n).fill(1), wc = Array(n).fill(1), wf = Array(n).fill(1);
  if (mode === 'custom') { wp = wc = wf = dist.custom.slice(0, n).concat(Array(Math.max(0, n - dist.custom.length)).fill(0)); }
  if (mode === 'prepost' && type === 'training') {
    wc = wc.map((_, i) => i === dist.preIdx ? 1.3 : i === dist.postIdx ? 1.25 : 0.8);
    wf = wf.map((_, i) => i === dist.preIdx ? 0.6 : i === dist.postIdx ? 0.9 : 1.15);
  }
  if (mode === 'protein') wp = wp.map((_, i) => dist.proteinIdx.includes(i) ? 1.4 : 0.8);
  const T = dayTargets(P, type);
  let p = reconcile(T.protein, wp), c = reconcile(T.carbs, wc), f = reconcile(T.fat, wf);
  if (mode === 'manual' && dist.manual && dist.manual.length === n) { p = dist.manual.map(m => m.p); c = dist.manual.map(m => m.c); f = dist.manual.map(m => m.f); }
  return slots.map((sl, i) => ({ ...sl, p: p[i], c: c[i], f: f[i], kcal: p[i] * 4 + c[i] * 4 + f[i] * 9 }));
}

/** Meal targets for a specific date. Once unplanned food has been logged that day, the meals not yet eaten share
    what's left of the daily target (after eaten meals and the extras), in the same proportions as before, so the day
    still lands on target. Without extras this is just mealTargets(). */
export function dayMealTargets(ctx: Ctx, d: ISODate): MealTarget[] {
  const day = getDay(ctx, d); const tgs = mealTargets(ctx, day.type);
  if (!day.extras?.length) return tgs;
  const T = dayTargets(ctx.s.profile, day.type);
  const eatenMeals = sumM(ctx.s, day.meals.filter(m => m.logged).flatMap(m => m.items)); const ex = sumExtras(ctx.s, day);
  const open = tgs.map((_, i) => i).filter(i => !day.meals[i]?.logged);
  const share = (k: 'p' | 'c' | 'f', total: number, eaten: number) => {
    const left = Math.max(0, Math.round(total - eaten)); const w = open.map(i => tgs[i][k]);
    return reconcile(left, w.some(x => x > 0) ? w : w.map(() => 1));
  };
  const p = share('p', T.protein, eatenMeals.p + ex.p), c = share('c', T.carbs, eatenMeals.c + ex.c), f = share('f', T.fat, eatenMeals.f + ex.f);
  return tgs.map((t, i) => {
    const j = open.indexOf(i); if (j < 0) return t;
    return { ...t, p: p[j], c: c[j], f: f[j], kcal: p[j] * 4 + c[j] * 4 + f[j] * 9 };
  });
}

/** Re-portion the meals not yet eaten (and not prepped) on a date to dayMealTargets(); locked foods stay as they are. */
export function refitDay(ctx: Ctx, d: ISODate) {
  const day = getDay(ctx, d); const tgs = dayMealTargets(ctx, d);
  day.meals.forEach((m, i) => { if (!m.logged && !m.prepped && m.items.length && tgs[i]) m.items = solve(ctx.s, m.items, tgs[i]); });
}

/** Portion solver: non-negative weighted least squares on P/C/F (coordinate descent, 600 iterations).
    Locked items are fixed and subtracted from the target first. Vegetables keep their amount (as when a day's meals are
    built) unless they are the only foods left to adjust, so the solver can't hit a carb target with 600 g of broccoli.
    Every food the user added keeps at least a small portion (15 g, 5 g for >50% fat foods) instead of dropping to 0.
    Bounds 0–700 g; rounded to 5 g (1 g for >50% fat foods).
    The UI must always show the remaining difference — never claim an exact match. */
export function solve(s: State, items: MealItem[], target: { p: number; c: number; f: number }): MealItem[] {
  const adjustable = items.filter(i => !i.locked && !i.estimate);
  const nonVeg = adjustable.filter(i => food(s, i.foodId)?.role !== 'veg');
  const fixedVeg = new Set(nonVeg.length ? adjustable.filter(i => food(s, i.foodId)?.role === 'veg') : []);
  const free = adjustable.filter(i => !fixedVeg.has(i));
  const lk = sumM(s, items.filter(i => i.locked || fixedVeg.has(i)));
  const t = [target.p - lk.p, target.c - lk.c, target.f - lk.f]; const w = [1.3, 1, 4];
  const A = free.map(i => { const f = food(s, i.foodId)!; return [f.p / 100, f.c / 100, f.f / 100]; });
  const lo = free.map(i => (food(s, i.foodId)!.f > 50 ? 5 : 15));
  const x = free.map(i => Math.max(10, i.g || 100));
  for (let it = 0; it < 600; it++) {
    for (let j = 0; j < x.length; j++) {
      const r = [0, 1, 2].map(k => sum(x.map((xi, q) => xi * A[q][k])) - t[k]);
      const g = sum([0, 1, 2].map(k => w[k] * A[j][k] * r[k])); const h = sum([0, 1, 2].map(k => w[k] * A[j][k] * A[j][k])) + 1e-6;
      x[j] = Math.min(700, Math.max(lo[j], x[j] - g / h));
    }
  }
  const out = items.map(i => ({ ...i })); let j = 0;
  items.forEach((i, idx) => { if (i.locked || i.estimate || fixedVeg.has(i)) return; const f = food(s, i.foodId)!; const step = f.f > 50 ? 1 : 5; out[idx].g = Math.round(x[j++] / step) * step; });
  return out;
}

/** Foods for meals 5 and 6 (snacks) when someone eats more than four meals a day. */
const EXTRA_MEALS = [['yog', 'blueb', 'almonds'], ['cottage', 'banana']];

/** Change meals per day (2–6) and keep the plan usable: new meals get a time after the last one and a snack to start
    from, and every meal from today on that isn't logged or prepped is re-portioned to its new (smaller or larger)
    share of the day's targets. Past days, logged meals and prepped meals are left as they are. */
export function setMealsPerDay(ctx: Ctx, n: number) {
  const { s } = ctx; const v = Math.min(6, Math.max(2, Math.round(n)));
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const hm = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  s.profile.mealsPerDay = v;
  (['training', 'rest'] as DayType[]).forEach(t => {
    const slots = s.mealSlots[t];
    while (slots.length < v) {
      const last = [...slots].reverse().find(x => /^\d{1,2}:\d{2}$/.test(x.time || ''));
      const at = last ? Math.min(toMin(last.time) + 120, 21 * 60 + 30) : -1;
      const time = last && at > toMin(last.time) ? hm(at) : '';
      slots.push({ name: 'Meal ' + (slots.length + 1), label: time && at >= 20 * 60 ? 'Evening snack' : 'Snack', time });
    }
  });
  if (s.distribution.custom.length !== v) { s.distribution.custom = Array(v).fill(Math.round(100 / v)); s.distribution.manual = null; }
  rebalanceMeals(ctx, true);
}

/** Everything that decides each meal's target: daily targets (training and rest), meal count and how the day is split. */
export const targetsSignature = (s: State) => {
  const P = s.profile, D = s.distribution;
  return JSON.stringify([P.kcal, P.protein, P.carbs, P.fat, P.restTargets, P.mealsPerDay, D.mode, D.custom, D.manual, D.preIdx, D.postIdx, D.proteinIdx]);
};

/** Re-portion every meal from today on that isn't logged or prepped to its current target (locked foods stay as they
    are). Run when targets change, so planned meals never sit on old portions. `fillEmpty` gives empty meals a snack. */
export function rebalanceMeals(ctx: Ctx, fillEmpty = false) {
  const { s } = ctx;
  for (const d of Object.keys(s.days)) {
    if (d < ctx.today) continue;
    const day = getDay(ctx, d); const tg = dayMealTargets(ctx, d);
    day.meals.forEach((m, i) => {
      if (m.logged || m.prepped || !tg[i]) return;
      if (!m.items.length) { if (!fillEmpty) return; m.items = (EXTRA_MEALS[i - 4] || EXTRA_MEALS[0]).map(foodId => ({ key: uid(), foodId, g: 100, locked: false })); }
      m.items = solve(s, m.items, tg[i]);
    });
  }
}

/** Turn a list of foods into portions for a meal target. Vegetables are held at 100 g while the rest is solved. */
function portion(s: State, raw: { foodId: string; g: number; estimate?: MealItem['estimate'] }[], t: { p: number; c: number; f: number }): MealItem[] {
  let items: MealItem[] = raw.map(q => ({ ...q, key: uid(), locked: false }));
  const veg = items.find(q => food(s, q.foodId)?.role === 'veg'); if (veg) { veg.g = 100; veg.locked = true; }
  items = solve(s, items, t);
  items.forEach(q => { if (food(s, q.foodId)?.role === 'veg') q.locked = false; });
  return items;
}

/** Foods that suit each kind of meal, in order of preference. Anything the user likes can still end up anywhere
    through "Change foods"; these lists only decide the starting plan. */
const FIT: Record<'breakfast' | 'snack' | 'main', Partial<Record<Food['role'], string[]>>> = {
  breakfast: { protein: ['yog', 'eggs', 'cottage', 'eggw', 'soyog', 'whey', 'tofu'], carb: ['oats', 'bread', 'banana', 'blueb', 'tortilla'], fat: ['pb', 'almonds', 'avocado', 'cheddar'] },
  snack: { protein: ['yog', 'cottage', 'whey', 'soyog', 'eggs', 'tuna', 'turkey', 'tofu'], carb: ['banana', 'blueb', 'oats', 'bread', 'tortilla'], fat: ['almonds', 'pb', 'hummus', 'cheddar', 'avocado'] },
  main: { protein: ['chicken_c', 'salmon_r', 'beef_c', 'turkey', 'cod_c', 'tuna', 'tofu', 'eggs', 'lentils', 'chick'], carb: ['rice_c', 'potato_c', 'sweet_c', 'pasta_c', 'quinoa_c', 'tortilla', 'bread', 'potato_r', 'lentils', 'chick'], veg: ['broccoli_c', 'peppers', 'spinach', 'greens', 'broccoli_r'], fat: ['avocado', 'oil', 'feta', 'cheddar', 'hummus'] },
};
/** Whether a food is a usual choice for this kind of meal (eggs at breakfast, rice at dinner…). */
export const suitsMeal = (foodId: string, label: string) => Object.values(FIT[mealKind(label)]).some(l => l?.includes(foodId));
export const mealKind = (label: string): 'breakfast' | 'snack' | 'main' => /breakfast/i.test(label) ? 'breakfast' : /snack|pre-workout/i.test(label) ? 'snack' : 'main';

/** Build a starting plan (food ids per meal) from the foods someone likes: a protein and a carb in every meal, a
    vegetable in main meals and a fat where one fits. Main meals take turns so lunch and dinner differ. */
export function mealsFromLikes(s: State, likes: string[], labels: string[]): string[][] {
  const liked = likes.filter(id => !!food(s, id));
  const turn: Record<string, number> = {};
  const pick = (kind: 'breakfast' | 'snack' | 'main', role: Food['role'], used: string[]) => {
    const fits = (FIT[kind][role] || []).filter(id => liked.includes(id));
    const any = liked.filter(id => food(s, id)?.role === role);
    const pool = (fits.length ? fits : role === 'protein' || role === 'carb' ? any : []).filter(id => !used.includes(id));
    if (!pool.length) return null;
    const k = `${kind === 'main' ? 'main' : 'light'}:${role}`; const i = turn[k] || 0; turn[k] = i + 1;
    return pool[i % pool.length];
  };
  return labels.map(label => {
    const kind = mealKind(label); const out: string[] = [];
    for (const role of (kind === 'main' ? ['protein', 'carb', 'veg', 'fat'] : ['protein', 'carb', 'fat']) as Food['role'][]) {
      // A fatty protein (eggs, salmon, beef) already covers the meal's fat, so no separate fat is added.
      if (role === 'fat' && out.some(id => { const f = food(s, id); return f?.role === 'protein' && f.f >= 8; })) continue;
      const id = pick(kind, role, out); if (id) out.push(id);
    }
    return out;
  });
}

/** Save the foods picked for each meal and rebuild every meal from today on that isn't eaten or prepped.
    `only` limits the rebuild to one meal slot (changing a single meal). */
export function setMealFoods(ctx: Ctx, foods: string[][], only?: number) {
  const { s } = ctx;
  s.profile.mealFoods = foods.map(l => l.filter(id => !!food(s, id)));
  for (const d of Object.keys(s.days)) {
    if (d < ctx.today) continue;
    const day = getDay(ctx, d); const tg = dayMealTargets(ctx, d);
    day.meals.forEach((m, i) => {
      if (only != null && i !== only) return;
      const ids = s.profile.mealFoods?.[i];
      if (m.logged || m.prepped || !tg[i] || !ids?.length) return;
      m.items = portion(s, ids.map(foodId => ({ foodId, g: 100 })), tg[i]);
    });
  }
}

/** Re-portion one meal to its target. Amounts the user typed (locked) stay; everything else is worked out. */
export function refitMeal(ctx: Ctx, d: ISODate, i: number) {
  const m = getDay(ctx, d).meals[i]; const t = dayMealTargets(ctx, d)[i];
  if (m && t && m.items.length) m.items = solve(ctx.s, m.items, t);
}
/** Swap one food for another. The new food's amount is worked out with the rest of the meal (not fixed). */
export function swapFood(ctx: Ctx, d: ISODate, i: number, key: string, foodId: string) {
  const it = getDay(ctx, d).meals[i]?.items.find(x => x.key === key); if (!it) return false;
  it.foodId = foodId; it.locked = false; delete it.estimate;
  refitMeal(ctx, d, i); return true;
}
/** The user typed an amount: keep it fixed and fit the other foods around it. */
export function setAmount(ctx: Ctx, d: ISODate, i: number, key: string, g: number) {
  const it = getDay(ctx, d).meals[i]?.items.find(x => x.key === key); if (!it) return;
  it.g = Math.max(0, Math.round(g)); it.locked = true; refitMeal(ctx, d, i);
}
/** Undo a typed amount: the food goes back to being worked out automatically. */
export function autoAmount(ctx: Ctx, d: ISODate, i: number, key: string) {
  const it = getDay(ctx, d).meals[i]?.items.find(x => x.key === key); if (!it) return;
  it.locked = false; refitMeal(ctx, d, i);
}
/** "Always use this instead": put the swap into the saved food choices for that meal, from today on. */
export function rememberSwap(ctx: Ctx, i: number, fromId: string, toId: string) {
  const { s } = ctx; const day = getDay(ctx, ctx.today);
  const base = s.profile.mealFoods?.length ? s.profile.mealFoods.map(l => [...l]) : day.meals.map(m => m.items.filter(x => !x.estimate).map(x => x.foodId));
  while (base.length <= i) base.push([]);
  const l = base[i]; const at = l.indexOf(fromId);
  if (at >= 0) l[at] = toId; else if (!l.includes(toId)) l.push(toId);
  base[i] = l.filter((x, k) => l.indexOf(x) === k);
  setMealFoods(ctx, base, i);
}

/** Get (creating from the default template if needed) the meal plan for a date. */
export function getDay(ctx: Ctx, d: ISODate): DayPlan {
  const { s } = ctx;
  if (!s.days[d]) {
    const type = dayType(ctx, d); const tg = mealTargets(ctx, type);
    const tpl = type === 'training'
      ? [['sm2'], ['chicken_c', 'rice_c', 'avocado'], ['turkey', 'tortilla', 'banana'], ['salmon_r', 'potato_r', 'broccoli_c']]
      : [['eggs', 'bread', 'blueb'], ['tuna', 'quinoa_c', 'avocado'], ['cottage', 'blueb', 'almonds'], ['chicken_c', 'sweet_c', 'broccoli_c']];
    const fallback: Record<string, string[]> = { sm2: ['yog', 'oats', 'blueb'] };
    const mine = s.profile.mealFoods;
    const meals = tg.map((t, i) => {
      const ids = mine?.[i]?.length ? mine[i] : (tpl[i] || EXTRA_MEALS[i - tpl.length] || ['chicken_c', 'rice_c', 'oil']);
      const items: MealItem[] = ids.flatMap(x => {
        if (!x.startsWith('sm')) return [{ foodId: x, g: 100 }];
        const sm = s.savedMeals.find(m => m.id === x);
        return sm ? sm.items.map(q => ({ ...q })) : (fallback[x] || []).map(foodId => ({ foodId, g: 100 }));
      });
      return { key: uid(), items: portion(s, items, t), logged: false, prepped: false };
    });
    s.days[d] = { type, meals, water: 0 };
    if (d === ctx.today && s.sample && meals.length >= 3) { meals[0].logged = true; meals[1].logged = true; meals[1].prepped = true; meals[2].prepped = true; s.days[d].water = 1250; }
  }
  const dd = s.days[d]; const nM = Math.min(6, Math.max(1, Number(s.profile.mealsPerDay) || 4));
  while (dd.meals.length < nM) dd.meals.push({ key: uid(), items: [], logged: false, prepped: false });
  while (dd.meals.length > nM && !dd.meals[dd.meals.length - 1].logged) dd.meals.pop();
  return dd;
}

export function dayTotals(ctx: Ctx, d: ISODate) {
  const day = getDay(ctx, d);
  const ex = sumExtras(ctx.s, day); const add = (m: Macros): Macros => ({ kcal: m.kcal + ex.kcal, p: m.p + ex.p, c: m.c + ex.c, f: m.f + ex.f });
  // Unplanned food counts as both planned and eaten.
  return { planned: add(sumM(ctx.s, day.meals.flatMap(m => m.items))), logged: add(sumM(ctx.s, day.meals.filter(m => m.logged).flatMap(m => m.items))) };
}

export interface Alternative { food: Food; g: number; m: Macros; d: Macros; score: number }

/** Ranked substitutes matched on the source food's primary nutrient. A protein, carb or fat is only swapped for a food
    of the same type (your custom foods included); vegetables and other foods can match any type. */
export function alternatives(s: State, foodId: string, g: number, opts: { tag?: string; lower?: boolean; higher?: boolean } = {}): Alternative[] {
  const src = food(s, foodId); if (!src) return [];
  const m0 = macros(s, foodId, g); const P = s.profile;
  const key: 'p' | 'c' | 'f' | 'kcal' = src.role === 'protein' ? 'p' : src.role === 'carb' ? 'c' : src.role === 'fat' ? 'f' : 'kcal';
  return allFoods(s)
    .filter(f => f.id !== foodId && f.name !== src.name
      && !(P.exclude || []).some(x => f.name.toLowerCase().includes(x.toLowerCase()))
      && !(P.allergies || []).some(a => f.name.toLowerCase().includes(a.toLowerCase())))
    .filter(f => !opts.tag || f.tags.includes(opts.tag))
    .filter(f => !['protein', 'carb', 'fat'].includes(src.role) || f.role === src.role)
    .map(f => {
      const per = key === 'kcal' ? f.kcal : f[key]; if (!per || per < (key === 'kcal' ? 5 : 1)) return null;
      let sg = m0[key] / per * 100; sg = Math.round(sg / 5) * 5 || 5; const m = macros(s, f.id, sg);
      const d = { kcal: m.kcal - m0.kcal, p: m.p - m0.p, c: m.c - m0.c, f: m.f - m0.f };
      const dist = Math.abs(d.p) * 1.2 + Math.abs(d.c) + Math.abs(d.f) * 2.2; const role = f.role === src.role ? 0 : 25; const cal = Math.abs(d.kcal) / 12;
      const pref = (P.dietPrefs || []).filter(t => f.tags.includes(t)).length * -4; const silly = sg > 600 ? 40 : 0;
      return { food: f, g: sg, m, d, score: dist + role + cal + pref + silly };
    })
    .filter((a): a is Alternative => !!a)
    .filter(a => !opts.lower || a.d.kcal < -10).filter(a => !opts.higher || a.d.kcal > 10)
    .sort((a, b) => a.score - b.score);
}
