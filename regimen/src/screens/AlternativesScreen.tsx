/* 13. Food Alternatives — port of prototype/FitAlternatives.dc.html */
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useRG } from '@/store/rg';
import { useUI } from '@/store/store';
import { Btn, Card, Chip, Field, H, Icon, Muted, NotMedical, NumInput, Row, Select, T, useLayout } from '@/ui/kit';
import { C, R, SHADOW } from '@/ui/theme';
import { Screen } from './Shell';

/** Context passed by the Meal Planner: RG.go('alternatives', { date, meal, key, foodId, g }). */
type AltCtx = { date: string; meal: number; key: string; foodId: string; g: number };
const isCtx = (p: unknown): p is AltCtx => !!p && typeof p === 'object' && typeof (p as AltCtx).key === 'string' && typeof (p as AltCtx).date === 'string';

const TAGS: [string, string][] = [['', 'All'], ['Dairy-free', 'Dairy-free'], ['Vegan', 'Vegan'], ['Gluten-free', 'Gluten-free'], ['lower', 'Lower calorie'], ['higher', 'Higher calorie']];

const MiniTag = ({ children, outline }: { children?: ReactNode; outline?: boolean }) => (
  <View style={{ paddingVertical: 1, paddingHorizontal: 6, borderRadius: 4, backgroundColor: outline ? 'transparent' : C.n800, borderWidth: outline ? 1 : 0, borderColor: C.accent }}>
    <T size={10} lh={1.4} color={outline ? C.accent : C.n100}>{children}</T>
  </View>
);

export default function AlternativesScreen() {
  const RG = useRG();
  const { width, wide } = useLayout();
  const rp = useUI(u => u.routeParam);
  const [ctx, setCtx] = useState<AltCtx | null>(() => (isCtx(rp) ? rp : null));
  const [foodIdSt, setFoodId] = useState<string | null>(() => (isCtx(rp) ? rp.foodId : null));
  const [gSt, setG] = useState<number | null>(() => (isCtx(rp) ? rp.g : null));
  const [tag, setTag] = useState('');
  const [swapped, setSwapped] = useState<string | null>(null);
  useEffect(() => { if (isCtx(rp)) { setCtx(rp); setFoodId(rp.foodId); setG(rp.g); setSwapped(null); } }, [rp]);

  const foodId = foodIdSt && RG.food(foodIdSt) ? foodIdSt : 'chicken_c'; const g = gSt ?? 145;
  const f = RG.food(foodId); const m0 = RG.macros(foodId, g);
  const list = RG.alternatives(foodId, g, { tag: tag && tag !== 'lower' && tag !== 'higher' ? tag : '', lower: tag === 'lower', higher: tag === 'higher' }).slice(0, 12);
  const sg = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±') + RG.r1(Math.abs(v));
  const cell = (k: string, v: number, d: number, kc?: boolean) => ({ k, v: kc ? Math.round(v) : RG.r1(v), d: Math.abs(d) < 0.5 ? 'same' : kc ? sg(Math.round(d)) : sg(d), color: Math.abs(d) < (kc ? 20 : 2) ? C.n500 : C.a300 });

  const day = ctx ? RG.getDay(ctx.date) : null; const meal = day ? day.meals[ctx!.meal] : undefined;
  const tg = ctx && day ? RG.mealTargets(day.type)[ctx.meal] : undefined;
  const key = f ? ({ protein: 'protein', carb: 'carbohydrate', fat: 'fat', veg: 'calories' } as Record<string, string>)[f.role] || 'calories' : 'calories';
  let swapNote = '';
  if (swapped && meal && tg) { const tot = RG.sumM(meal.items); swapNote = `Swapped in ${ctx?.g ?? ''} g ${RG.food(swapped)?.name || 'the substitute'}. Meal is now ${RG.num(tot.kcal)} kcal · ${RG.r1(tot.p)}P ${RG.r1(tot.c)}C ${RG.r1(tot.f)}F vs target ${tg.p}/${tg.c}/${tg.f}. Rebalance adjusts the other foods and keeps ${RG.food(swapped)?.name || 'the substitute'} locked.`; }
  const afterSwap = !!swapped && !!meal && !!tg;

  const foodOpts = RG.allFoods().map(x => ({ value: x.id, label: `${x.name} · ${x.basis}` })).sort((a, b) => (a.label < b.label ? -1 : 1));
  const use = (altId: string, altG: number, _altName: string) => {
    if (!ctx) return;
    let ok = false;
    RG.update(s => { const it = s.days[ctx.date]?.meals[ctx.meal]?.items.find(x => x.key === ctx.key); if (it) { it.foodId = altId; it.g = altG; it.locked = true; ok = true; } });
    if (!ok) return RG.toast('That food is no longer in the meal. Go back to the meal and try again.');
    setFoodId(altId); setG(altG); setSwapped(altId); setCtx({ ...ctx, foodId: altId, g: altG });
  };
  const rebalance = () => {
    if (!ctx || !tg) return;
    RG.update(s => { const mm = s.days[ctx.date].meals[ctx.meal]; mm.items = RG.solve(mm.items, tg); });
    RG.go('meals', { date: ctx.date, meal: ctx.meal });
    RG.toast('Meal rebalanced around the substitute.');
  };
  const stack = width < (wide ? 1000 : 700);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <View style={{ marginRight: 'auto' }}>
            <Muted>{ctx && day && tg ? `Swapping in ${tg.name} · ${ctx.date === RG.TODAY ? 'today' : RG.fmtD(ctx.date)}` : 'Browse substitutes for any food'}</Muted>
            <H size={28} style={{ marginTop: 2 }}>Food Alternatives</H>
          </View>
          {ctx && <Btn icon="arrow-left" title="Back to meal" onPress={() => RG.go('meals', { date: ctx.date, meal: ctx.meal })} />}
        </View>

        <Card gap={12}>
          <Row gap={10} wrap align="flex-end">
            <Field label="Original food" style={{ flex: 1, minWidth: 220 }}>
              <Select title="Original food" value={foodId} options={foodOpts} onChange={v => { setFoodId(v); setSwapped(null); }} />
            </Field>
            <Field label="Amount (g)" style={{ width: 120 }}>
              <NumInput value={g} onValue={v => setG(v == null ? 0 : Math.max(0, v))} accessibilityLabel="Amount in grams" />
            </Field>
          </Row>
          <Row gap={18} wrap>
            <T size={13} tab color={C.n400}>{`${g} g ${f?.basis || ''}`}</T>
            <T size={13} tab>{`${Math.round(m0.kcal)} kcal · ${RG.r1(m0.p)}P · ${RG.r1(m0.c)}C · ${RG.r1(m0.f)}F`}</T>
            <T size={13} color={C.n500}>{`Role: ${f?.role || '—'} · matched on ${key}`}</T>
          </Row>
          <Row gap={6} wrap>
            {TAGS.map(([v, l]) => <Chip key={v || 'all'} label={l} on={tag === v} onPress={() => setTag(v)} style={{ borderRadius: 6 }} />)}
          </Row>
        </Card>

        <Muted>Ranked by closest macro match, then same food role, similar calories and your dietary preferences. Substitute weights match the main nutrient. Other macros will differ, and every difference is shown. No two foods are nutritionally identical.</Muted>

        <View style={{ gap: 8 }}>
          {list.map((a, i) => {
            const cells = [cell('kcal', a.m.kcal, a.d.kcal, true), cell('Protein', a.m.p, a.d.p), cell('Carbs', a.m.c, a.d.c), cell('Fat', a.m.f, a.d.f)];
            const name = (
              <View style={{ flex: stack ? undefined : 1.4, minWidth: 0 }}>
                <Row gap={6}><T size={11} color={C.n600}>#{i + 1}</T><T size={14} style={{ flexShrink: 1 }}>{a.food.name}</T></Row>
                <Row gap={4} wrap style={{ marginTop: 3 }}><MiniTag>{a.food.basis}</MiniTag>{a.food.tags.slice(0, 3).map(t => <MiniTag key={t} outline>{t}</MiniTag>)}</Row>
              </View>
            );
            const rest = (
              <>
                <T size={20} tab style={{ width: stack ? 76 : 90 }}>{a.g}<T size={12} color={C.n500}> g</T></T>
                <View style={{ flex: stack ? 1 : 1.6, flexDirection: 'row', gap: 6, minWidth: 0 }}>
                  {cells.map(c => (
                    <View key={c.k} style={{ flex: 1, minWidth: 0 }}>
                      <T size={10} color={C.n500}>{c.k}</T>
                      <T size={12} tab>{c.v}</T>
                      <T size={11} tab color={c.color}>{c.d}</T>
                    </View>
                  ))}
                </View>
                {ctx && <Btn variant="primary" size="sm" title="Use" onPress={() => use(a.food.id, a.g, a.food.name)} label={`Use ${a.g} g ${a.food.name}`} />}
              </>
            );
            return (
              <Card key={a.food.id} gap={8} pad={[12, 16]}>
                {stack ? <>{name}<Row gap={12}>{rest}</Row></> : <Row gap={12}>{name}{rest}</Row>}
              </Card>
            );
          })}
          {!list.length && <Card><Muted size={13}>No alternatives match this filter. Try another filter or a different food.</Muted></Card>}
        </View>
        <NotMedical />
        {afterSwap && <View style={{ height: 72 }} />}
      </Screen>

      {afterSwap && (
        <View style={{ position: 'absolute', left: wide ? 28 : 14, right: wide ? 28 : 14, bottom: 12, alignItems: 'center', pointerEvents: 'box-none' }}>
          <View style={{ width: '100%', maxWidth: 1264, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingVertical: 12, paddingHorizontal: 16, borderRadius: R.md, backgroundColor: C.surface, boxShadow: SHADOW.lg }}>
            <Icon name="scales" size={20} color={C.accent} />
            <T size={13} style={{ flex: 1, minWidth: 200 }}>{swapNote}</T>
            <Btn variant="primary" title="Rebalance meal" onPress={rebalance} />
          </View>
        </View>
      )}
    </View>
  );
}
