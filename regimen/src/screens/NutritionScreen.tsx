/* 9. Nutrition Dashboard — port of prototype/FitNutrition.dc.html */
import { useState } from 'react';
import { View } from 'react-native';
import type { DayPlan } from '@/domain/types';
import { useRG } from '@/store/rg';
import { Bar, Btn, Card, CardTitle, Grid, H, Icon, Muted, NotMedical, Num, Row, RuledRow, T, Tag, Tap, useLayout } from '@/ui/kit';
import { C } from '@/ui/theme';
import { Screen } from './Shell';

export default function NutritionScreen() {
  const RG = useRG();
  const { width } = useLayout();
  const [dateSt, setDate] = useState<string | null>(null);
  const S = RG.s, P = S.profile; const date = dateSt || RG.TODAY;
  const day = RG.getDay(date); const tot = RG.dayTotals(date); const tgs = RG.mealTargets(day.type);
  const DT = RG.dayTargets(date); const tLabel = day.type === 'rest' ? (P.restTargets ? 'Rest day targets' : 'Rest day targets (same as training days)') : 'Training day targets';
  const up = (fn: (d: DayPlan) => void) => RG.update(s => fn(s.days[date]));

  const cards = ([['Calories', DT.kcal, tot.planned.kcal, tot.logged.kcal, 'kcal'], ['Protein', DT.protein, tot.planned.p, tot.logged.p, 'g'], ['Carbohydrates', DT.carbs, tot.planned.c, tot.logged.c, 'g'], ['Fat', DT.fat, tot.planned.f, tot.logged.f, 'g']] as [string, number, number, number, string][])
    .map(([k, t, pl, lg, u]) => ({ k, target: `${RG.num(t)} ${u}`, remaining: RG.num(Math.abs(t - lg)), remLabel: (u === 'g' ? 'g ' : 'kcal ') + (t - lg >= 0 ? 'remaining' : 'over'), logged: RG.num(lg), planned: RG.num(pl), pl: t ? pl / t * 100 : 0, lg: t ? lg / t * 100 : 0 }));

  const meals = day.meals.map((m, i) => {
    const t = tgs[i] || { name: 'Meal ' + (i + 1), label: 'Meal', time: '', p: 0, c: 0, f: 0 }; const sm = RG.sumM(m.items);
    return { key: m.key, i, name: t.name, label: t.label, time: t.time, macro: `${RG.num(sm.kcal)} kcal · ${Math.round(sm.p)}P ${Math.round(sm.c)}C ${Math.round(sm.f)}F`, target: `${t.p}/${t.c}/${t.f}`, prepped: m.prepped, logged: m.logged };
  });
  const wt = P.waterMl || 1, wv = day.water || 0;
  const diffK = tot.planned.kcal - DT.kcal;
  const narrow = width < 520;

  return (
    <Screen>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ marginRight: 'auto' }}>
          <Muted>{`${day.type === 'training' ? 'Training day' : 'Rest day'} · ${tgs.length} meals · ${tLabel}`}</Muted>
          <H size={28} style={{ marginTop: 2 }}>Nutrition Dashboard</H>
        </View>
        <Row gap={4}>
          <Btn iconOnly icon="caret-left" label="Previous day" onPress={() => setDate(RG.add(date, -1))} />
          <T size={14} center style={{ minWidth: 110 }}>{date === RG.TODAY ? 'Today' : RG.fmtD(date)}</T>
          <Btn iconOnly icon="caret-right" label="Next day" onPress={() => setDate(RG.add(date, 1))} />
        </Row>
        <Btn icon="shopping-cart" title="Grocery list" onPress={() => RG.go('grocery')} />
        <Btn variant="primary" icon="fork-knife" title="Open meal planner" onPress={() => RG.go('meals', { date, meal: 0 })} />
      </View>

      <Grid min={210} gap={12}>
        {cards.map(c => (
          <Card key={c.k} gap={8} pad={[14, 16]}>
            <Row style={{ alignItems: 'baseline' }}><T size={13} style={{ flex: 1 }}>{c.k}</T><Muted size={11}>target {c.target}</Muted></Row>
            <Num size={36}>{c.remaining}<T size={13} color={C.n500}> {c.remLabel}</T></Num>
            <Bar fills={[{ pct: c.pl, color: C.n700 }, { pct: c.lg, color: C.accent }]} />
            <Row><T size={12} tab color={C.a300} style={{ flex: 1 }}>Logged {c.logged}</T><T size={12} tab color={C.n400}>Planned {c.planned}</T></Row>
          </Card>
        ))}
      </Grid>

      <Grid min={420}>
        <Card gap={6}>
          <Row style={{ alignItems: 'baseline' }}><CardTitle style={{ flex: 1 }}>Meals planned</CardTitle><Muted>{`${day.meals.filter(m => m.prepped).length} of ${day.meals.length} prepped`}</Muted></Row>
          {meals.map(m => (
            <RuledRow key={m.key} style={{ flexDirection: 'row', flexWrap: narrow ? 'wrap' : 'nowrap', gap: 10, alignItems: 'center', paddingVertical: 10 }}>
              <Muted tab style={{ width: 66 }}>{RG.clock(m.time)}</Muted>
              <Tap onPress={() => RG.go('meals', { date, meal: m.i })} label={`Open ${m.name} in the meal planner`} style={{ flex: 1, minWidth: narrow ? 180 : 0 }}>
                <T size={14}>{m.name} <T size={14} color={C.n500}>· {m.label}</T></T>
                <Muted tab>{`${m.macro} · target ${m.target}`}</Muted>
              </Tap>
              <Row gap={10} style={narrow ? { marginLeft: 54 } : undefined}>
                <Tag variant={m.prepped ? 'outline' : 'neutral'}>{m.prepped ? 'Prepped' : 'Not prepped'}</Tag>
                <Tap onPress={() => up(d => { d.meals[m.i].logged = !d.meals[m.i].logged; })} label={m.logged ? 'Mark not logged' : 'Log meal'}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, minHeight: 32, borderRadius: 6, borderWidth: 1, borderColor: m.logged ? C.a800 : C.accent, backgroundColor: m.logged ? C.a800 : 'transparent' }}>
                  <Icon name={m.logged ? 'check-circle' : 'plus-circle'} fill={m.logged} size={13} color={m.logged ? C.a100 : C.accent} />
                  <T size={12} color={m.logged ? C.a100 : C.accent}>{m.logged ? 'Logged' : 'Log'}</T>
                </Tap>
              </Row>
            </RuledRow>
          ))}
          {!meals.length && <Muted size={13}>No meals planned for this day.</Muted>}
        </Card>
        <View style={{ gap: 16 }}>
          {P.water && (
            <Card gap={10}>
              <Row style={{ alignItems: 'baseline' }}><CardTitle style={{ flex: 1 }}>Water</CardTitle><Muted>target {RG.imp() ? Math.round(wt / 29.57) + ' fl oz' : (wt / 1000).toFixed(1) + ' L'}</Muted></Row>
              <Num size={32}>{RG.imp() ? Math.round(wv / 29.57) + ' fl oz' : (wv / 1000).toFixed(2) + ' L'}</Num>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {Array.from({ length: 10 }, (_, i) => <View key={i} style={{ flex: 1, height: 18, borderRadius: 3, backgroundColor: (i + 1) / 10 <= wv / wt ? C.accent : C.n900 }} />)}
              </View>
              <Row gap={6}>
                <Btn title="+250 ml" onPress={() => up(d => { d.water = (d.water || 0) + 250; })} />
                <Btn title="+500 ml" onPress={() => up(d => { d.water = (d.water || 0) + 500; })} />
                <Btn variant="ghost" title="Undo" onPress={() => up(d => { d.water = Math.max(0, (d.water || 0) - 250); })} />
              </Row>
            </Card>
          )}
          <Card gap={8}>
            <CardTitle>Planned vs logged</CardTitle>
            <T size={13} color={C.n300}>Planned is what's in today's meal plan. Logged counts only meals you've marked as eaten. Remaining = target − logged.</T>
            <Muted>{`${date === RG.TODAY ? "Today's" : 'This day\'s'} plan comes to ${RG.num(tot.planned.kcal)} kcal, ${Math.abs(Math.round(diffK))} kcal ${diffK >= 0 ? 'above' : 'below'} your calorie target, because portions are rounded to 5 g and targets are calculated from macros.`}</Muted>
            <NotMedical />
            <Row gap={6} wrap>
              <Btn variant="ghost" icon="cooking-pot" title="Meal-prep calculator" onPress={() => RG.go('prep')} />
              <Btn variant="ghost" icon="book-open" title="Recipes & saved meals" onPress={() => RG.go('recipes')} />
            </Row>
          </Card>
        </View>
      </Grid>
    </Screen>
  );
}
