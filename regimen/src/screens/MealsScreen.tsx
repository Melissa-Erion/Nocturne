/* Eat › Meals: step 1 "Choose my foods" (until done), then one card per meal (the open one shows foods with exact grams,
   Swap, Mark as eaten), unplanned food, plan ahead, and the per-meal target split under Advanced. */
import { useEffect, useState, type ReactNode } from 'react';
import { track } from '@/lib/track';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import type { DayPlan, DistributionMode, Food, Meal, State } from '@/domain/types';
import { searchUsda, usdaEnabled } from '@/lib/foodApi';
import { RG as RGS, useRG } from '@/store/rg';
import { useUI } from '@/store/store';
import { useAccess } from '@/store/access';
import { ExtrasList, LogExtraDialog } from './eat/LogExtra';
import { ChooseFoods } from './eat/ChooseFoods';
import {
  Btn, Card, CardTitle, ColLabel, Dialog, Field, Grid, H, Icon, Input, Kicker, Muted, NotMedical, NumInput, Row, Rule, Seg, Select, T, Tap, useLayout,
} from '@/ui/kit';
import { alpha, C, R, SHADOW } from '@/ui/theme';
import { Screen } from './Shell';

type MealParam = { date: string; meal?: number };
const isMealParam = (p: unknown): p is MealParam => !!p && typeof p === 'object' && typeof (p as MealParam).date === 'string';

const MODES: { value: DistributionMode; label: string }[] = [
  { value: 'equal', label: 'Equal distribution' }, { value: 'custom', label: 'Custom percentages' }, { value: 'prepost', label: 'More carbs pre/post-workout' },
  { value: 'protein', label: 'Higher-protein meals' }, { value: 'manual', label: 'Enter targets per meal' },
];

/** Table row with the faint fading rule along its bottom edge (.table tbody tr). */
function TRow({ children, style, onPress, head }: { children?: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; head?: boolean }) {
  const body = (
    <View style={[{ flexDirection: 'row', alignItems: 'center', minHeight: head ? 30 : 42 }, style]}>
      {children}
      <Rule color={head ? C.divider : alpha(C.text, 0.08)} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} />
    </View>
  );
  return onPress ? <Tap onPress={onPress}>{body}</Tap> : body;
}
const Cell = ({ children, flex = 1, style }: { children?: ReactNode; flex?: number; style?: StyleProp<ViewStyle> }) =>
  <View style={[{ flex, paddingHorizontal: 8.4, paddingVertical: 8.4, minWidth: 0 }, style]}>{children}</View>;
const Th = ({ children, flex }: { children?: ReactNode; flex?: number }) =>
  <Cell flex={flex} style={{ paddingVertical: 6 }}><T size={11} upper color={alpha(C.text, 0.6)} style={{ letterSpacing: 0.88 }}>{children}</T></Cell>;

/** Common foods offered as one-tap buttons when a meal is empty. */
const QUICK: [string, string[]][] = [
  ['protein', ['chicken_c', 'eggs', 'yog', 'tuna', 'salmon_r', 'tofu']],
  ['carb', ['rice_c', 'oats', 'potato_r', 'bread', 'sweet_c', 'banana']],
  ['veg', ['broccoli_c', 'spinach', 'greens']],
  ['fat', ['avocado', 'almonds', 'oil', 'pb']],
];

export default function MealsScreen() {
  const RG = useRG();
  const { width } = useLayout();
  const { full } = useAccess();
  const locked = (what: string) => useUI.setState({ lockPrompt: what });
  const rp = useUI(u => u.routeParam);
  const [dateSt, setDate] = useState<string | null>(() => (isMealParam(rp) ? rp.date : null));
  const [mealSt, setMeal] = useState<number>(() => {
    if (isMealParam(rp)) return rp.meal || 0;
    const i = RGS.getDay(RGS.TODAY).meals.findIndex(m => !m.logged); return i < 0 ? 0 : i;
  });
  const [showSplit, setShowSplit] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [q, setQ] = useState('');
  const [usda, setUsda] = useState<{ q: string; foods: Food[]; loading: boolean; error: string | null }>({ q: '', foods: [], loading: false, error: null });
  const [favName, setFavName] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [choose, setChoose] = useState<{ start: number; single: boolean } | null>(null);
  useEffect(() => { if (isMealParam(rp)) { setDate(rp.date); setMeal(rp.meal || 0); } }, [rp]);

  // live USDA search (debounced) alongside the local library
  const qq = q.trim();
  useEffect(() => {
    if (!usdaEnabled() || qq.length < 3) { setUsda({ q: '', foods: [], loading: false, error: null }); return; }
    let live = true; setUsda(u => ({ ...u, loading: true, error: null }));
    const t = setTimeout(() => {
      searchUsda(qq, 8).then(foods => { if (live) setUsda({ q: qq, foods, loading: false, error: null }); })
        .catch(e => { if (live) setUsda({ q: qq, foods: [], loading: false, error: e instanceof Error ? e.message : 'USDA search failed' }); });
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [qq]);

  const S = RG.s, P = S.profile; const date = full ? dateSt || RG.TODAY : RG.TODAY; /* free version: today only */ const day = RG.getDay(date);
  const tgs = RG.mealTargets(day.type); const n = tgs.length; const DT = RG.dayTargets(day.type);
  const mi = Math.max(0, Math.min(mealSt, Math.min(day.meals.length, n) - 1)); const meal: Meal | undefined = day.meals[mi];
  // Open meals shrink when unplanned food was logged today ("Log something else").
  const adj = RG.dayMealTargets(date); const tg = adj[mi] || tgs[mi]; const adjusted = !!day.extras?.length && !!tg && !!tgs[mi] && tg.kcal !== tgs[mi].kcal;
  const upM = (fn: (m: Meal, d: DayPlan) => void) => RG.update(s => { const d = s.days[date]; if (d && d.meals[mi]) fn(d.meals[mi], d); });
  const mode = S.distribution.mode;
  const sumOf = (k: 'p' | 'c' | 'f' | 'kcal') => RG.sum(tgs.map(t => t[k]));
  const sumCell = (k: 'p' | 'c' | 'f', d: number) => { const v = sumOf(k); return { v, color: v === d ? C.text : C.a300 }; };
  const pctSum = RG.sum(S.distribution.custom.slice(0, n));
  const ensureManual = (s: State) => { if (!s.distribution.manual || s.distribution.manual.length !== n) s.distribution.manual = tgs.map(t => ({ p: t.p, c: t.c, f: t.f })); };
  const setManual = (i: number, k: 'p' | 'c' | 'f', v: number | null) => RG.update(s => { ensureManual(s); s.distribution.manual![i][k] = v ?? 0; });
  const off = (['p', 'c', 'f'] as const).map(k => sumOf(k) - ({ p: DT.protein, c: DT.carbs, f: DT.fat })[k]);
  const macroKcal = sumOf('kcal'); const dk = macroKcal - DT.kcal;
  const reconcileNote = mode === 'manual' ? (off.every(x => x === 0) ? 'Your per-meal targets add up exactly to the daily target.' : `Per-meal targets differ from the daily target by ${off.map((x, i) => `${['P', 'C', 'F'][i]} ${x > 0 ? '+' : ''}${x} g`).join(', ')}. Adjust a meal to reconcile.`)
    : mode === 'custom' && pctSum !== 100 ? `Shares add up to ${pctSum}%. Grams are still scaled so meals sum to the daily target; set shares to 100% to make that explicit.`
    : `Meal grams are whole numbers. Rounding remainders go to the meals with the largest fractions, so every column adds up exactly to the daily target. kcal is calculated from macros (4/4/9), so it can differ slightly from the ${RG.num(DT.kcal)} kcal target.`;
  const kcalNote = Math.abs(dk) > 0 ? ` Your macros add up to ${RG.num(macroKcal)} kcal, ${RG.num(Math.abs(dk))} kcal ${dk > 0 ? 'above' : 'below'} the ${RG.num(DT.kcal)} kcal calorie target.` : '';
  const isCustom = mode === 'custom', isManual = mode === 'manual';
  const allEmpty = day.meals.every(m => !m.items.length);

  // food rows
  const items = (meal?.items || []).map((it, ii) => {
    const f = RG.food(it.foodId); const m = it.estimate || RG.macros(it.foodId, it.g);
    return {
      key: it.key || String(ii), ii, it, f, name: f ? f.name : it.estimate ? 'Estimated item' : 'Unknown food',
      basis: f ? (f.basis === 'edible' ? 'edible portion' : f.basis) : 'estimate',
      serving: f ? (f.serving ? `1 ${f.serving.label} = ${f.serving.g} g · ${Math.round(it.g / f.serving.g * 10) / 10} servings` : (f.src !== 'USDA FoodData Central' ? f.src : '')) : '',
      macro: `${Math.round(m.kcal)} · ${RG.r1(m.p)} · ${RG.r1(m.c)} · ${RG.r1(m.f)}`,
    };
  });
  const tot = RG.sumM(meal?.items || []);
  // Always show the remaining difference — never claim an exact match.
  const dd = (v: number, t: number, kc: boolean) => { const x = v - t; const a = kc ? Math.round(Math.abs(x)) : RG.r1(Math.abs(x)); return { d: (a === 0 ? '±0' : (x > 0 ? '+' : '−') + a) + (kc ? ' kcal' : ' g'), color: Math.abs(x) <= (kc ? 25 : 3) ? C.a300 : C.n300 }; };
  const totals = tg ? ([['Calories', tot.kcal, tg.kcal, true], ['Protein', tot.p, tg.p, false], ['Carbs', tot.c, tg.c, false], ['Fat', tot.f, tg.f, false]] as [string, number, number, boolean][])
    .map(([k, v, t, kc]) => ({ k, v: kc ? RG.num(v) : String(RG.r1(v)), t: kc ? RG.num(t) : t + ' g', ...dd(v, t, kc) })) : [];
  const gap = tg ? Math.max(Math.abs(tot.p - tg.p), Math.abs(tot.c - tg.c), Math.abs(tot.f - tg.f)) : 0;
  const bases = (meal?.items || []).map(i => RG.food(i.foodId)?.basis);
  const cooked = bases.filter(b => b === 'cooked').length, raw = bases.filter(b => b === 'raw').length;

  const ql = qq.toLowerCase();
  // Name matches first (starting with the text, then containing it); category matches only fill the rest.
  const results = ql.length > 1 ? (() => {
    const all = RG.allFoods(); const n = (f: Food) => f.name.toLowerCase();
    const starts = all.filter(f => n(f).startsWith(ql) || n(f).split(/[\s,(-]+/).some(w => w.startsWith(ql)));
    const has = all.filter(f => !starts.includes(f) && n(f).includes(ql));
    const cat = all.filter(f => !starts.includes(f) && !has.includes(f) && f.cat.toLowerCase().includes(ql));
    return [...starts, ...has, ...cat].slice(0, 10);
  })() : [];
  const usdaRes = usda.q && usda.q.toLowerCase() === ql ? usda.foods : [];
  const showDrop = ql.length > 1 && (results.length > 0 || usdaEnabled());
  const addFood = (f: Food, fromUsda?: boolean) => {
    if (fromUsda) RG.update(s => { s.customFoods[f.id] = f; });
    upM(mm => { mm.items.push({ key: RG.uid(), foodId: f.id, g: f.serving ? f.serving.g : 100, locked: false }); if (tg) mm.items = RG.solve(mm.items, tg); });
    setQ(''); RG.toast(`${f.name.split(',')[0]} added. Portions updated to fit this meal.`); track('food_added', { source: fromUsda ? 'usda' : 'library' });
  };

  const saved = S.savedMeals.filter(s => s.items.length).map(s => ({ value: s.id, label: s.name }));
  const loadSaved = (id: string) => {
    const sm = S.savedMeals.find(x => x.id === id); if (!sm) return;
    upM(mm => { mm.items = sm.items.map(x => ({ ...x, key: RG.uid(), locked: false })); if (tg) mm.items = RG.solve(mm.items, tg); });
    RG.toast(`Loaded ${sm.name}, portioned to fit this meal.`);
  };
  const openFav = () => { if (!meal || !tg) return; setFavName(`${tg.label} · ${meal.items.map(i => (RG.food(i.foodId)?.name || 'Item').split(',')[0]).join(', ')}`); };
  const saveFav = () => {
    const name = (favName || '').trim(); if (!name || !meal) return;
    RG.update(s => { s.savedMeals.push({ id: 'sm' + RG.uid(), name, items: meal.items.map(i => ({ foodId: i.foodId, g: i.g, ...(i.estimate ? { estimate: i.estimate } : {}) })), fav: true, uses: 0 }); });
    setFavName(null); RG.toast('Saved to Recipes & Saved Meals.');
  };

  const tableW = isCustom ? 640 : 560;
  const done = day.meals.filter(m => m.logged).length;
  const chosen = !!P.mealFoods?.some(l => l.length);
  const mealTitle = (i: number) => { const t = tgs[i]; return t ? `${t.label}${t.time ? ' · ' + RG.clock(t.time) : ''}` : `Meal ${i + 1}`; };
  const statusOf = (i: number) => {
    const mm = day.meals[i]; if (!mm) return { text: '', tone: C.n400 };
    if (mm.logged) return { text: 'Eaten', tone: C.a300 };
    if (!mm.items.length) return { text: 'No foods yet', tone: C.n400 };
    const t = adj[i] || tgs[i]; const m = RG.sumM(mm.items);
    const g = t ? Math.max(Math.abs(m.p - t.p), Math.abs(m.c - t.c), Math.abs(m.f - t.f)) : 0;
    return g <= 5 ? { text: 'On target', tone: C.a300 } : { text: 'Close to target', tone: C.n300 };
  };
  // Friendly one-liner instead of macro arithmetic. Only the biggest miss is named.
  const worst = tg ? (([['protein', tot.p - tg.p], ['carbs', tot.c - tg.c], ['fat', tot.f - tg.f]] as [string, number][]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]) : null;
  const weigh = cooked && raw ? 'Weigh cooked foods after cooking and raw foods before.' : cooked ? 'Weigh these foods after cooking.' : raw ? 'Weigh these foods raw, before cooking.' : '';
  const statusLine = !items.length ? '' : gap <= 5 ? `On target for this meal. ${weigh}`
    : `Close: ${worst![0]} is ${RG.r1(Math.abs(worst![1]))} g ${worst![1] > 0 ? 'over' : 'under'}. Tap Refit portions, or add or swap a food. ${weigh}`;

  const Section = ({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) => (
    <View style={{ gap: 10, marginTop: 6 }}>
      <View style={{ gap: 2 }}>
        <H size={21}>{title}</H>
        {!!sub && <Muted size={13}>{sub}</Muted>}
      </View>
      {children}
    </View>
  );

  return (
    <Screen>
      {/* header */}
      <View style={{ gap: 4 }}>
        <H size={28}>{date === RG.TODAY ? "Today's meals" : `Meals · ${RG.fmtD(date)}`}</H>
        <Muted size={13}>{`Portioned to hit ${RG.num(DT.kcal)} kcal and ${DT.protein} g protein${day.type === 'rest' ? ' (rest day)' : ''}. ${done} of ${day.meals.length} meals eaten.`}</Muted>
        <Row gap={4} style={{ marginTop: 4 }}>
          <Btn iconOnly icon="caret-left" label="Previous day" onPress={() => full ? setDate(RG.add(date, -1)) : locked('mealsWeek')} />
          <T size={14} center style={{ minWidth: 110 }}>{date === RG.TODAY ? 'Today' : RG.fmtD(date)}</T>
          <Btn iconOnly icon={full ? 'caret-right' : 'lock-simple'} label={full ? 'Next day' : 'Next day (Regimen Pro)'} onPress={() => full ? setDate(RG.add(date, 1)) : locked('mealsWeek')} />
        </Row>
      </View>

      {/* step 1: choose foods (until the user has done it), then a slim reminder */}
      {!chosen ? (
        <Card gap={10} pad={[18, 20]} style={{ borderWidth: 1, borderColor: C.a700 }}>
          <Kicker>Start here · step 1 of 2</Kicker>
          <T size={18} w={600}>Choose foods you like for each meal</T>
          <Muted size={13}>Takes about a minute. Tap what you'd eat for breakfast, lunch and so on, and Regimen works out exactly how much of each to eat. Until then, the meals below are samples.</Muted>
          <Row><Btn variant="primary" size="lg" icon="fork-knife" title="Choose my foods" onPress={() => setChoose({ start: 0, single: false })} /></Row>
        </Card>
      ) : (
        <Card gap={6} pad={[12, 16]}>
          <Row gap={10} wrap>
            <View style={{ flex: 1, minWidth: 220 }}>
              <T size={14} w={600}>How to use your meals</T>
              <Muted size={12}>Open a meal, weigh each food to the grams shown, then tap Mark as eaten.</Muted>
            </View>
            <Btn icon="fork-knife" title="Change my foods" onPress={() => setChoose({ start: 0, single: false })} />
          </Row>
        </Card>
      )}

      <Section title={chosen ? 'Your meals' : 'Step 2 · Your meals'} sub="Tap a meal to open it.">
        {tgs.map((t, i) => {
          const mm = day.meals[i]; if (!mm) return null;
          const st = statusOf(i);
          if (i !== mi) return (
            <Tap key={i} onPress={() => setMeal(i)} label={`Open ${t.label}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: R.lg, borderWidth: 1, borderColor: C.n800, backgroundColor: C.surface }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={15} w={600}>{mealTitle(i)}</T>
                <Muted size={12} numberOfLines={1}>{mm.items.length ? mm.items.map(x => (RG.food(x.foodId)?.name || 'Item').split(',')[0]).join(', ') : 'No foods yet'}</Muted>
              </View>
              <T size={12} color={st.tone}>{st.text}</T>
              <Icon name="caret-right" size={16} color={C.n500} />
            </Tap>
          );
          if (!meal || !tg) return null;
          return (
            <Card key={i} gap={12} pad={[16, 18]} style={{ boxShadow: SHADOW.md, zIndex: 2, borderWidth: 1, borderColor: C.a700 }}>
              <Row gap={10} align="flex-start">
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Kicker>{`Meal ${i + 1} of ${tgs.length}`}</Kicker>
                  <T size={20} w={600} lh={1.3}>{mealTitle(i)}</T>
                  <Muted size={12}>{`${RG.num(tg.kcal)} kcal · ${tg.p} g protein`}</Muted>
                  {adjusted && <Muted size={12}>{`Trimmed from ${RG.num(tgs[mi].kcal)} kcal for the unplanned food you logged today.`}</Muted>}
                </View>
                <T size={12} color={st.tone} style={{ paddingTop: 2 }}>{st.text}</T>
              </Row>

              {/* foods: name and grams, nothing else */}
              <View>
                {items.map(it => (
                  <View key={it.key} style={{ paddingVertical: 10, gap: 6 }}>
                    <Rule style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
                    <Row gap={10}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T size={15}>{it.name}</T>
                        {!!it.serving && <Muted size={11}>{it.serving}</Muted>}
                      </View>
                      {it.it.estimate ? <Muted>estimate</Muted> : (
                        <Row gap={4}>
                          <NumInput value={Math.round(it.it.g)} onValue={v => upM(mm => { mm.items[it.ii].g = Math.max(0, v ?? 0); mm.items[it.ii].locked = true; })} size={17} height={42}
                            style={{ width: 84, textAlign: 'right', fontVariant: ['tabular-nums'] }} accessibilityLabel={`${it.name} grams`} />
                          <T size={14} color={C.n400}>g</T>
                        </Row>
                      )}
                    </Row>
                    <Row gap={2}>
                      {!it.it.estimate && <Btn variant="ghost" size="sm" icon={full ? 'swap' : 'lock-simple'} title="Swap" onPress={() => RG.go('alternatives', { date, meal: mi, key: it.it.key, foodId: it.it.foodId, g: it.it.g })} />}
                      <Btn variant="ghost" size="sm" icon="x" color={C.n400} title="Remove" label={`Remove ${it.name}`} onPress={() => upM(mm => { mm.items.splice(it.ii, 1); if (tg && mm.items.length) mm.items = RG.solve(mm.items, tg); })} />
                      {more && <T size={11} tab color={C.n500} style={{ marginLeft: 'auto' }}>{`${it.macro.split(' · ')[0]} kcal`}</T>}
                    </Row>
                  </View>
                ))}
                {!items.length && <RuledEmpty />}
                {items.length < 2 && (
                  <View style={{ gap: 8, paddingTop: 10 }}>
                    {QUICK.map(([role, ids]) => (
                      <Row key={role} gap={6} wrap>
                        <T size={12} color={C.n400} style={{ width: 92 }}>{`Add ${role === 'veg' ? 'veg' : 'a ' + role}`}</T>
                        {ids.map(id => RG.food(id)).filter((x): x is Food => !!x).map(fd => (
                          <Tap key={fd.id} onPress={() => addFood(fd)} label={`Add ${fd.name}`}
                            style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: C.n700 }}>
                            <T size={12}>{fd.name.split(',')[0]}</T>
                          </Tap>
                        ))}
                      </Row>
                    ))}
                  </View>
                )}
              </View>

              {!!statusLine && <T size={13} color={gap <= 5 ? C.a300 : C.n300}>{statusLine}</T>}
              {gap > 5 && !!items.length && <Row><Btn icon="calculator" title="Refit portions" onPress={() => { upM(mm => { mm.items = RG.solve(mm.items, tg); }); RG.toast('Portions refitted around the amounts you typed.'); }} /></Row>}

              {/* the one main action, then the less common ones */}
              <Row gap={6} wrap>
                <Btn variant={meal.logged ? 'secondary' : 'primary'} icon="check-circle" iconFill={meal.logged} title={meal.logged ? 'Eaten · undo' : 'Mark as eaten'}
                  onPress={() => { if (!meal.logged) { track('meal_eaten', { from: 'meals' }); const nx = day.meals.findIndex((m, k) => k > mi && !m.logged); upM(mm => { mm.logged = true; }); if (nx >= 0) setMeal(nx); } else upM(mm => { mm.logged = false; }); }} />
                <Btn icon="fork-knife" title="Change foods" onPress={() => setChoose({ start: mi, single: true })} />
                <Btn variant="ghost" icon={more ? 'caret-down' : 'caret-right'} title={more ? 'Fewer options' : 'More options'} onPress={() => setMore(v => !v)} />
              </Row>

              {/* add any food */}
              <View style={{ zIndex: 10 }}>
                <Input value={q} onChange={setQ} placeholder="Add a food to this meal" accessibilityLabel="Search foods" />
                {showDrop && (
                  <View style={{ position: 'absolute', zIndex: 10, left: 0, right: 0, top: '100%', marginTop: 4, maxHeight: 320, padding: 4, borderRadius: R.md, backgroundColor: C.surface, boxShadow: SHADOW.lg }}>
                    <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {results.map(f => <FoodResult key={f.id} f={f} onPress={() => addFood(f)} />)}
                      {usdaEnabled() && (
                        <>
                          <ColLabel style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 2 }}>{`More foods${usda.loading ? ' · searching…' : ql.length < 3 ? ' · type 3+ letters' : ''}`}</ColLabel>
                          {usda.error ? <Muted style={{ paddingHorizontal: 10, paddingVertical: 6 }}>{`Online food search isn't available right now. The foods above still work.`}</Muted>
                            : !usda.loading && !usdaRes.length && ql.length >= 3 ? <Muted style={{ paddingHorizontal: 10, paddingVertical: 6 }}>No more matches.</Muted> : null}
                          {usdaRes.map(f => <FoodResult key={f.id} f={f} onPress={() => addFood(f, true)} />)}
                        </>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              {more && (
                <View style={{ gap: 12, paddingTop: 4 }}>
                  <Rule />
                  <ColLabel>This meal vs its target</ColLabel>
                  <View style={{ padding: 12, borderRadius: R.md, backgroundColor: C.n900 }}>
                    <Grid min={130} gap={10}>
                      {totals.map(x => (
                        <View key={x.k}>
                          <Muted size={11}>{x.k}</Muted>
                          <T size={18} tab lh={1.3}>{x.v}<T size={12} color={C.n500}> / {x.t}</T></T>
                          <T size={12} tab color={x.color}>{x.d}</T>
                        </View>
                      ))}
                    </Grid>
                  </View>
                  <Muted size={11}>Typing an amount keeps it fixed; Refit portions then adjusts the other foods around it.</Muted>
                  <Row gap={6} wrap>
                    <Btn variant="ghost" icon="package" title={meal.prepped ? 'Prepped · undo' : 'Mark prepped'} onPress={() => upM(mm => { mm.prepped = !mm.prepped; })} />
                    <Btn variant="ghost" icon={full ? 'star' : 'lock-simple'} title="Save as favourite meal" onPress={() => full ? openFav() : locked('favourites')} />
                    <Select title="Load a saved meal" value={null as string | null} placeholder="Load a saved meal…" options={saved} onChange={id => full ? loadSaved(id) : locked('favourites')} style={{ width: 'auto', minWidth: 200 }} />
                  </Row>
                  <NotMedical />
                </View>
              )}
            </Card>
          );
        })}
        {!meal && <Card><Muted size={13}>No meals set up for this day. Set meals per day in Me › Settings › Nutrition.</Muted></Card>}
      </Section>

      <Section title="Ate something else?" sub="Log food that wasn't in your plan. Meals you haven't eaten yet shrink so the day still lands on target.">
        <Card gap={8} pad={[14, 16]}>
          <Row><Btn icon="plus-circle" title="Log something else" onPress={() => setExtraOpen(true)} /></Row>
          <ExtrasList date={date} />
        </Card>
      </Section>
      <LogExtraDialog open={extraOpen} onClose={() => setExtraOpen(false)} date={date} />

      <Section title="Plan ahead">
        <Row gap={8} wrap>
          <Btn icon={full ? 'calendar-blank' : 'lock-simple'} title={date === RG.TODAY ? 'Plan tomorrow' : 'Next day'} onPress={() => full ? setDate(RG.add(date, 1)) : locked('mealsWeek')} />
          <Btn icon="cooking-pot" title="Batch-cook it (Prep)" onPress={() => RG.go('prep')} />
          <Btn icon="shopping-cart" title="Grocery list" onPress={() => RG.go('grocery')} />
        </Row>
      </Section>

      {/* advanced: day type and how the daily targets are split per meal (collapsed by default) */}
      <Card gap={12} style={{ marginTop: 6 }}>
        <Tap onPress={() => setShowSplit(v => !v)} label={showSplit ? 'Hide how targets are split' : 'Show how targets are split'} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={showSplit ? 'caret-down' : 'caret-right'} size={16} color={C.n400} />
          <View style={{ flex: 1 }}>
            <CardTitle>Advanced: targets per meal</CardTitle>
            <Muted size={12}>{`How your ${RG.num(DT.kcal)} kcal is split across ${n} meals, and training vs rest days.`}</Muted>
          </View>
        </Tap>
        {showSplit && <>
        <Row gap={10} wrap>
          <Seg value={day.type} onChange={v => full ? RG.update(s => { s.days[date].type = v; }) : locked('mealsWeek')} options={[{ value: 'training', label: 'Training day' }, { value: 'rest', label: 'Rest day' }]} />
          <Select title="Distribution" value={mode} options={MODES} onChange={v => RG.update(s => { s.distribution.mode = v; })} style={{ width: 'auto', minWidth: 230 }} />
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flexGrow: 1, minWidth: tableW }}>
            <TRow head>
              <Th flex={2.2}>Meal</Th>{isCustom && <Th>Share %</Th>}<Th>Protein g</Th><Th>Carbs g</Th><Th>Fat g</Th><Th>kcal</Th>
            </TRow>
            {tgs.map((t, i) => (
              <TRow key={i} onPress={() => setMeal(i)} style={i === mi ? { backgroundColor: alpha(C.accent, 0.08) } : undefined}>
                <Cell flex={2.2}><T size={14}>{t.label}</T><Muted size={11}>{`${t.name}${t.time ? ' · ' + RG.clock(t.time) : ''}`}</Muted></Cell>
                {isCustom && <Cell><NumInput value={S.distribution.custom[i] ?? 0} onValue={v => RG.update(s => { s.distribution.custom[i] = v ?? 0; })} style={{ width: 64 }} /></Cell>}
                {isManual
                  ? (['p', 'c', 'f'] as const).map(k => <Cell key={k}><NumInput value={t[k]} onValue={v => setManual(i, k, v)} style={{ width: 64 }} /></Cell>)
                  : (['p', 'c', 'f'] as const).map(k => <Cell key={k}><T size={14} tab>{t[k]}</T></Cell>)}
                <Cell><T size={14} tab color={C.n400}>{RG.num(t.kcal)}</T></Cell>
              </TRow>
            ))}
            <TRow>
              <Cell flex={2.2}><T size={14} w={500}>Sum of meals</T></Cell>
              {isCustom && <Cell><T size={14} w={500} tab color={pctSum === 100 ? C.text : C.a300}>{pctSum}%</T></Cell>}
              {([['p', DT.protein], ['c', DT.carbs], ['f', DT.fat]] as const).map(([k, d]) => { const c = sumCell(k, d); return <Cell key={k}><T size={14} w={500} tab color={c.color}>{c.v}</T></Cell>; })}
              <Cell><T size={14} tab color={dk ? C.a300 : C.n400}>{RG.num(macroKcal)}</T></Cell>
            </TRow>
            <TRow>
              <Cell flex={2.2}><T size={14} color={C.n500}>Daily target</T>{!!P.restTargets && <Muted size={11}>{day.type === 'rest' ? 'Rest day targets' : 'Training day targets'}</Muted>}</Cell>
              {isCustom && <Cell><T size={14} color={C.n500}>100%</T></Cell>}
              <Cell><T size={14} tab color={C.n500}>{DT.protein}</T></Cell><Cell><T size={14} tab color={C.n500}>{DT.carbs}</T></Cell><Cell><T size={14} tab color={C.n500}>{DT.fat}</T></Cell>
              <Cell><T size={14} tab color={C.n500}>{RG.num(DT.kcal)}</T></Cell>
            </TRow>
          </View>
        </ScrollView>
        <Muted>{reconcileNote + kcalNote}</Muted>
        </>}
      </Card>

      <ChooseFoods open={!!choose} onClose={() => setChoose(null)} start={choose?.start ?? 0} single={!!choose?.single} />
      <Dialog open={favName != null} onClose={() => setFavName(null)} title="Save as favourite meal"
        body="Saved meals appear in Recipes & Saved Meals and can be loaded into any meal slot."
        actions={<><Btn title="Cancel" onPress={() => setFavName(null)} /><Btn variant="primary" title="Save" disabled={!favName?.trim()} onPress={saveFav} /></>}>
        <Field label="Name this meal"><Input value={favName} onChange={setFavName} autoFocus onSubmitEditing={saveFav} /></Field>
      </Dialog>
    </Screen>
  );
}

function FoodResult({ f, onPress }: { f: Food; onPress: () => void }) {
  return (
    <Tap onPress={onPress} label={`Add ${f.name}`}
      style={st => ({ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'baseline', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, minHeight: 36, backgroundColor: st.hovered ? alpha(C.accent, 0.1) : 'transparent' })}>
      <T size={13} style={{ flex: 1, minWidth: 160 }}>{f.name} <T size={13} color={C.n500}>· {f.basis}</T></T>
      <Muted size={11} tab>{`per 100 g: ${Math.round(f.kcal)} kcal · ${RGS.r1(f.p)}P ${RGS.r1(f.c)}C ${RGS.r1(f.f)}F`}</Muted>
    </Tap>
  );
}

function RuledEmpty() {
  return (
    <View style={{ paddingVertical: 14 }}>
      <Rule style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
      <Muted size={13}>No foods in this meal yet. Tap a food below, or search for any food. Regimen works out the grams.</Muted>
    </View>
  );
}
