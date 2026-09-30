/* 10. Meal Planner — port of prototype/FitMeals.dc.html */
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import type { DayPlan, DistributionMode, Food, Meal, State } from '@/domain/types';
import { searchUsda, usdaEnabled } from '@/lib/foodApi';
import { RG as RGS, useRG } from '@/store/rg';
import { useUI } from '@/store/store';
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

export default function MealsScreen() {
  const RG = useRG();
  const { width } = useLayout();
  const rp = useUI(u => u.routeParam);
  const [dateSt, setDate] = useState<string | null>(() => (isMealParam(rp) ? rp.date : null));
  const [mealSt, setMeal] = useState<number>(() => (isMealParam(rp) ? rp.meal || 0 : 0));
  const [q, setQ] = useState('');
  const [usda, setUsda] = useState<{ q: string; foods: Food[]; loading: boolean; error: string | null }>({ q: '', foods: [], loading: false, error: null });
  const [favName, setFavName] = useState<string | null>(null);
  const [listW, setListW] = useState(0);
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

  const S = RG.s, P = S.profile; const date = dateSt || RG.TODAY; const day = RG.getDay(date);
  const tgs = RG.mealTargets(day.type); const n = tgs.length; const DT = RG.dayTargets(day.type);
  const mi = Math.max(0, Math.min(mealSt, Math.min(day.meals.length, n) - 1)); const meal: Meal | undefined = day.meals[mi]; const tg = tgs[mi];
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
  const matchNote = (gap <= 3 ? `Close match: every macro is within 3 g of the meal target (largest remaining gap ${RG.r1(gap)} g). ` : `Closest practical combination with these foods. The largest remaining gap is ${RG.r1(gap)} g. Add, swap or unlock a food to close it; an exact match isn't always possible.`)
    + (cooked && raw ? ' Mixed bases: weigh cooked items after cooking and raw items before.' : cooked ? ' Weigh these foods after cooking.' : raw ? ' Weigh these foods raw, before cooking.' : '');

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
    upM(mm => { mm.items.push({ key: RG.uid(), foodId: f.id, g: f.serving ? f.serving.g : 100, locked: false }); });
    if (fromUsda) RG.update(s => { s.customFoods[f.id] = f; });
    setQ('');
  };

  const saved = S.savedMeals.filter(s => s.items.length).map(s => ({ value: s.id, label: s.name }));
  const loadSaved = (id: string) => {
    const sm = S.savedMeals.find(x => x.id === id); if (!sm) return;
    upM(mm => { mm.items = sm.items.map(x => ({ ...x, key: RG.uid(), locked: false })); });
    RG.toast(`Loaded ${sm.name}. Recalculate to fit this meal's target.`);
  };
  const openFav = () => { if (!meal || !tg) return; setFavName(`${tg.label} · ${meal.items.map(i => (RG.food(i.foodId)?.name || 'Item').split(',')[0]).join(', ')}`); };
  const saveFav = () => {
    const name = (favName || '').trim(); if (!name || !meal) return;
    RG.update(s => { s.savedMeals.push({ id: 'sm' + RG.uid(), name, items: meal.items.map(i => ({ foodId: i.foodId, g: i.g, ...(i.estimate ? { estimate: i.estimate } : {}) })), fav: true, uses: 0 }); });
    setFavName(null); RG.toast('Saved to Recipes & Saved Meals.');
  };

  const stack = listW > 0 && listW < 640;
  const tableW = isCustom ? 640 : 560;

  return (
    <Screen>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ marginRight: 'auto' }}>
          <Muted>Exact portions from your targets · weights in grams</Muted>
          <H size={28} style={{ marginTop: 2 }}>Meal Planner</H>
        </View>
        <Row gap={4}>
          <Btn iconOnly icon="caret-left" label="Previous day" onPress={() => setDate(RG.add(date, -1))} />
          <T size={14} center style={{ minWidth: 110 }}>{date === RG.TODAY ? 'Today' : RG.fmtD(date)}</T>
          <Btn iconOnly icon="caret-right" label="Next day" onPress={() => setDate(RG.add(date, 1))} />
        </Row>
        <Seg style={{ alignSelf: 'flex-end' }} value={day.type} onChange={v => RG.update(s => { s.days[date].type = v; })} options={[{ value: 'training', label: 'Training day' }, { value: 'rest', label: 'Rest day' }]} />
      </View>

      {/* per-meal targets */}
      <Card gap={12}>
        <Row gap={10} wrap>
          <CardTitle style={{ marginRight: 'auto' }}>{`Daily targets split across ${n} meals`}</CardTitle>
          <Select title="Distribution" value={mode} options={MODES} onChange={v => RG.update(s => { s.distribution.mode = v; })} style={{ width: 'auto', minWidth: 230 }} />
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flexGrow: 1, minWidth: tableW }}>
            <TRow head>
              <Th flex={2.2}>Meal</Th>{isCustom && <Th>Share %</Th>}<Th>Protein g</Th><Th>Carbs g</Th><Th>Fat g</Th><Th>kcal</Th>
            </TRow>
            {tgs.map((t, i) => (
              <TRow key={i} onPress={() => setMeal(i)} style={i === mi ? { backgroundColor: alpha(C.accent, 0.08) } : undefined}>
                <Cell flex={2.2}><T size={14}>{t.name}</T><Muted size={11}>{`${t.label} · ${t.time}`}</Muted></Cell>
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
      </Card>

      {/* meal tabs */}
      <Row gap={6} wrap>
        {tgs.map((t, i) => {
          const mm = day.meals[i]; if (!mm) return null; const on = i === mi;
          return (
            <Tap key={i} onPress={() => setMeal(i)} label={`${t.name} · ${t.label}`}
              style={{ gap: 2, paddingVertical: 8, paddingHorizontal: 14, borderRadius: R.md, borderWidth: 1, borderColor: on ? C.accent : C.n800, backgroundColor: on ? C.a900 : 'transparent' }}>
              <T size={13} w={500} color={on ? C.a100 : C.n300}>{`${t.name} · ${t.label}`}</T>
              <T size={11} color={on ? C.a100 : C.n300} style={{ opacity: 0.75 }}>{`${mm.logged ? 'Logged' : mm.prepped ? 'Prepped' : 'Planned'} · ${RG.num(RG.sumM(mm.items).kcal)} kcal`}</T>
            </Tap>
          );
        })}
      </Row>

      {meal && tg ? (
        <Card gap={14} pad={[18, 20]} style={{ boxShadow: SHADOW.md, zIndex: 2 }}>
          <Row gap={12} wrap align="flex-start">
            <View style={{ flex: 1, minWidth: 220 }}>
              <Kicker>{`${tg.name} · ${tg.label} · ${tg.time} · target`}</Kicker>
              <T size={22} tab lh={1.3} style={{ marginTop: 4 }}>{`${tg.p} P · ${tg.c} C · ${tg.f} F · ${RG.num(tg.kcal)} kcal`}</T>
            </View>
            <Row gap={6} wrap style={{ flexShrink: 1, maxWidth: '100%' }}>
              <Btn variant="primary" icon="calculator" title="Calculate portions" onPress={() => { upM(mm => { mm.items = RG.solve(mm.items, tg); }); RG.toast('Portions recalculated around locked foods.'); }} />
              <Btn icon="check-circle" iconFill={meal.logged} title={meal.logged ? 'Logged' : 'Mark as eaten'} onPress={() => upM(mm => { mm.logged = !mm.logged; })} />
              <Btn icon="package" title={meal.prepped ? 'Prepped' : 'Mark prepped'} onPress={() => upM(mm => { mm.prepped = !mm.prepped; })} />
            </Row>
          </Row>

          {/* food rows */}
          <View onLayout={e => setListW(e.nativeEvent.layout.width)}>
            {!stack && (
              <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 6 }}>
                <ColLabel style={{ flex: 1.6 }}>Food · weight basis</ColLabel><ColLabel style={{ width: 110 }}>Amount (g)</ColLabel><ColLabel style={{ width: 44 }}>Lock</ColLabel>
                <ColLabel style={{ flex: 1.3 }}>kcal · P · C · F</ColLabel><View style={{ width: 132 }} />
              </View>
            )}
            {items.map(i => {
              const name = (
                <View style={{ flex: stack ? undefined : 1.6, minWidth: 0 }}>
                  <T size={14}>{i.name}</T>
                  <Row gap={6} wrap>
                    <View style={{ paddingVertical: 1, paddingHorizontal: 6, borderRadius: 4, backgroundColor: i.f?.basis === 'raw' ? C.n800 : i.f?.basis === 'cooked' ? C.a800 : C.n900 }}>
                      <T size={10} upper lh={1.4} color={i.f?.basis === 'cooked' ? C.a100 : C.n300} style={{ letterSpacing: 0.5 }}>{i.basis}</T>
                    </View>
                    {!!i.serving && <Muted size={11}>{i.serving}</Muted>}
                  </Row>
                </View>
              );
              const controls = (
                <>
                  {i.it.estimate ? <View style={{ width: 110 }}><Muted>estimate</Muted></View> : (
                    <NumInput value={Math.round(i.it.g)} onValue={v => upM(mm => { mm.items[i.ii].g = Math.max(0, v ?? 0); })} size={16} height={40}
                      style={{ width: 110, textAlign: 'right', fontVariant: ['tabular-nums'] }} accessibilityLabel={`${i.name} grams`} />
                  )}
                  <Tap onPress={() => upM(mm => { mm.items[i.ii].locked = !mm.items[i.ii].locked; })} label={i.it.locked ? 'Locked — stays fixed when recalculating' : 'Lock this amount'}
                    style={{ width: 40, height: 36, marginHorizontal: 2, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: i.it.locked ? C.accent : C.n800, backgroundColor: i.it.locked ? alpha(C.accent, 0.14) : 'transparent' }}>
                    <Icon name={i.it.locked ? 'lock-simple' : 'lock-simple-open'} fill={i.it.locked} size={16} color={i.it.locked ? C.accent : C.n500} />
                  </Tap>
                  {stack ? <View style={{ flex: 1 }} /> : <T size={12} tab color={C.n300} style={{ flex: 1.3, minWidth: 0 }}>{i.macro}</T>}
                  <Row gap={2}>
                    {!i.it.estimate && <Btn variant="ghost" size="sm" title="Alternatives" onPress={() => RG.go('alternatives', { date, meal: mi, key: i.it.key, foodId: i.it.foodId, g: i.it.g })} />}
                    <Btn variant="ghost" iconOnly icon="x" color={C.n500} label={`Remove ${i.name}`} style={{ width: 30, height: 30 }} onPress={() => upM(mm => { mm.items.splice(i.ii, 1); })} />
                  </Row>
                </>
              );
              return (
                <View key={i.key} style={{ paddingVertical: 8 }}>
                  <Rule style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
                  {stack
                    ? <View style={{ gap: 8 }}>{name}<Row gap={8}>{controls}</Row><T size={12} tab color={C.n300}>{`kcal · P · C · F  ${i.macro}`}</T></View>
                    : <Row gap={10}>{name}{controls}</Row>}
                </View>
              );
            })}
            {!items.length && <RuledEmpty />}
          </View>

          {/* food search */}
          <View style={{ zIndex: 10 }}>
            <Input value={q} onChange={setQ} placeholder="Add a food — search the database" accessibilityLabel="Search foods" />
            {showDrop && (
              <View style={{ position: 'absolute', zIndex: 10, left: 0, right: 0, top: '100%', marginTop: 4, maxHeight: 320, padding: 4, borderRadius: R.md, backgroundColor: C.surface, boxShadow: SHADOW.lg }}>
                <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {results.map(f => <FoodResult key={f.id} f={f} onPress={() => addFood(f)} />)}
                  {usdaEnabled() && (
                    <>
                      <ColLabel style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 2 }}>{`USDA FoodData Central${usda.loading ? ' · searching…' : ql.length < 3 ? ' · type 3+ letters' : ''}`}</ColLabel>
                      {usda.error ? <Muted style={{ paddingHorizontal: 10, paddingVertical: 6 }}>{`Online food search isn't available right now. The foods above still work. (${usda.error})`}</Muted>
                        : !usda.loading && !usdaRes.length && ql.length >= 3 ? <Muted style={{ paddingHorizontal: 10, paddingVertical: 6 }}>No USDA matches.</Muted> : null}
                      {usdaRes.map(f => <FoodResult key={f.id} f={f} onPress={() => addFood(f, true)} />)}
                    </>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* totals vs target */}
          <View style={{ padding: 12, borderRadius: R.md, backgroundColor: C.n900 }}>
            <Grid min={130} gap={10}>
              {totals.map(t => (
                <View key={t.k}>
                  <Muted size={11}>{t.k}</Muted>
                  <T size={20} tab lh={1.3}>{t.v}<T size={12} color={C.n500}> / {t.t}</T></T>
                  <T size={12} tab color={t.color}>{t.d}</T>
                </View>
              ))}
            </Grid>
          </View>
          <T size={12} color={C.n400}>{matchNote}</T>
          <NotMedical />
          <Row gap={6} wrap>
            <Btn variant="ghost" icon="star" title="Save as favourite meal" onPress={openFav} />
            <Select title="Load a saved meal" value={null as string | null} placeholder="Load a saved meal…" options={saved} onChange={loadSaved} style={{ width: 'auto', minWidth: 200 }} />
            <View style={{ flex: 1 }} />
            <Muted size={11} color={C.n600}>Nutrition: USDA FoodData Central unless marked custom · values per 100 g of the stated basis</Muted>
          </Row>
        </Card>
      ) : (
        <Card><Muted size={13}>No meals set up for this day. Set meals per day in Settings → Nutrition.</Muted></Card>
      )}

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
      <Muted size={13}>No foods in this meal yet. Search below to add one, or load a saved meal.</Muted>
    </View>
  );
}
