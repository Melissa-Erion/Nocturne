/* 11. Meal-Prep Calculator — port of prototype/FitPrep.dc.html */
import { View } from 'react-native';
import type { DayType, PrepPlan, Recipe, SavedMeal } from '@/domain/types';
import { useRG } from '@/store/rg';
import { Btn, Card, Field, H, Icon, Muted, NotMedical, Num, NumInput, Row, Select, Seg, T } from '@/ui/kit';
import { alpha, C, R } from '@/ui/theme';
import { Grid, Table } from './prep/ui';
import { Screen } from './Shell';

export default function PrepScreen() {
  const RG = useRG();
  const S = RG.s;
  const srcOpts = S.recipes.map(r => ({ value: 'recipe:' + r.id, label: 'Recipe · ' + r.name }))
    .concat(S.savedMeals.filter(m => m.items.length).map(m => ({ value: 'meal:' + m.id, label: 'Meal · ' + m.name })));

  const addPlan = () => RG.update(s => {
    const first = s.savedMeals.find(m => m.items.length) || null; const rec = s.recipes[0] || null;
    const pick = first ? { kind: 'meal' as const, mealId: first.id } : rec ? { kind: 'recipe' as const, mealId: rec.id } : { kind: 'meal' as const, mealId: 'sm1' };
    s.prep.push({ id: 'pp' + RG.uid(), ...pick, containers: 5, people: 1, days: 5, version: 'training', actual: {} });
  });

  return (
    <Screen>
      <Row gap={12} wrap align="flex-end">
        <View style={{ marginRight: 'auto' }}>
          <Muted>Batch cook, then divide by actual cooked weight</Muted>
          <H size={28} style={{ marginTop: 2 }}>Meal-Prep Calculator</H>
        </View>
        <Btn icon="plus" title="Add prep" onPress={addPlan} />
        <Btn variant="primary" icon="shopping-cart" title="Grocery list" onPress={() => RG.go('grocery')} />
      </Row>

      {!S.prep.length && (
        <Card>
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 22 }}>
            <Icon name="cooking-pot" size={26} color={C.n600} />
            <T size={15} w={500} center>No prep plans yet</T>
            <Muted size={13} style={{ textAlign: 'center', maxWidth: 420 }}>{srcOpts.length ? 'Add a prep plan for a saved meal or recipe to get raw buy amounts and per-container portions.' : 'Save a meal in the Meal Planner or create a recipe first, then add a prep plan for it.'}</Muted>
            <Row gap={6}>
              {srcOpts.length ? <Btn icon="plus" title="Add prep" onPress={addPlan} /> : <Btn icon="book-open" title="Recipes & saved meals" onPress={() => RG.go('recipes')} />}
            </Row>
          </View>
        </Card>
      )}

      {S.prep.map((p, pi) => <PrepCard key={p.id} p={p} pi={pi} srcOpts={srcOpts} />)}
      {S.prep.length > 0 && <NotMedical />}
    </Screen>
  );
}

function PrepCard({ p, pi, srcOpts }: { p: PrepPlan; pi: number; srcOpts: { value: string; label: string }[] }) {
  const RG = useRG();
  const c = RG.prepCalc(p) || { lines: [], perContainer: { kcal: 0, p: 0, c: 0, f: 0 }, n: 0, estimated: false, perContainerG: 0 };
  const up = (fn: (pp: PrepPlan) => void) => RG.update(s => { const pp = s.prep.find(x => x.id === p.id) || s.prep[pi]; if (pp) fn(pp); });
  const isR = p.kind === 'recipe';
  const src = RG.prepSource(p);
  const missing = !src;

  const lines = c.lines.map(l => {
    const f = RG.food(l.foodId);
    const item = !isR && src ? (src as SavedMeal).items.find(i => i.foodId === l.foodId) : undefined;
    const canActual = !isR && !!f && (f.basis === 'cooked' || !!f.cookedId);
    return {
      key: l.foodId, name: f?.name || l.name,
      listed: isR ? `${c.n ? Math.round(l.buyG / c.n) : 0} g raw per serving in recipe` : `${Math.round(item?.g || 0)} g ${f?.basis || l.basis} per meal`,
      buy: RG.g(l.buyG), buyBasis: isR ? 'raw, total' : (l.rawBasis || f?.basis || l.basis) + ', total',
      expected: l.expected ? RG.g(l.expected) + ' cooked' : isR ? '—' : 'no cooking change', est: !!l.est && !isR,
      canActual, actual: l.actual || null,
      per: isR || l.perG == null ? '—' : RG.g(l.perG), perBasis: isR ? '' : (l.perBasis || '') + (l.actual ? ' · from actual batch' : f && (f.basis === 'cooked' || f.cookedId) ? ' · target' : ''),
    };
  });

  const rn = isR && src ? RG.recipeNutrition(src as Recipe) : null;
  const perContainerG = Math.round(c.perContainerG || 0);
  const totalPh = rn && src ? `est. ${Math.round(rn.cooked * c.n / ((src as Recipe).servings || 1))} g` : '';
  const note = isR
    ? (p.actual.total ? `Divided by your weighed batch (${RG.g(p.actual.total)}): portion each container to ${perContainerG} g. Macros come from the full ingredient list.` : 'Weigh the finished batch and enter it above. Containers are then divided by actual weight, not an estimate.')
    : (c.estimated ? 'Raw purchase amounts use estimated cooking yields (USDA retention averages), which vary with method and time. Enter each actual cooked batch weight to divide containers precisely.' : 'All quantities come from your weighed batches.');

  const setSrc = (v: string) => { const [k, id] = v.split(':'); up(pp => { pp.kind = k as PrepPlan['kind']; pp.mealId = id; pp.actual = {}; }); };

  return (
    <Card gap={14}>
      <Row gap={10} wrap align="flex-end">
        <Field label="Recipe or meal" style={{ flex: 1, minWidth: 220 }}>
          <Select value={p.kind + ':' + p.mealId} options={srcOpts} onChange={setSrc} title="Recipe or meal" placeholder={missing ? 'Source removed — choose one' : 'Choose…'} />
        </Field>
        <Field label="Meals / days" style={{ width: 100 }}>
          <NumInput value={p.containers} onValue={v => { if (v != null) up(pp => { pp.containers = Math.max(1, Math.round(v)); }); }} />
        </Field>
        <Field label="People" style={{ width: 90 }}>
          <NumInput value={p.people} onValue={v => { if (v != null) up(pp => { pp.people = Math.max(1, Math.round(v)); }); }} />
        </Field>
        <Field label="Version">
          <Seg<DayType> value={p.version} onChange={v => up(pp => { pp.version = v; })} options={[{ value: 'training', label: 'Training' }, { value: 'rest', label: 'Rest' }]} />
        </Field>
        <Btn variant="ghost" iconOnly icon="trash" color={C.n500} label="Remove" onPress={() => RG.update(s => { s.prep.splice(pi, 1); })} />
      </Row>

      <View style={{ padding: 12, borderRadius: R.md, backgroundColor: C.n900 }}>
        <Grid min={140} gap={10}>
          <View>
            <Muted size={11}>Containers</Muted>
            <Num size={28}>{c.n}</Num>
          </View>
          <View>
            <Muted size={11}>Per container</Muted>
            <Num size={28}>{RG.num(c.perContainer.kcal)}<T size={12} color={C.n500}> kcal</T></Num>
            <T size={12} color={C.n400}>{`${RG.r1(c.perContainer.p)} P · ${RG.r1(c.perContainer.c)} C · ${RG.r1(c.perContainer.f)} F`}</T>
          </View>
          {isR && (
            <View>
              <Muted size={11}>Cooked per container</Muted>
              <Num size={28}>{perContainerG}<T size={12} color={C.n500}> g</T></Num>
            </View>
          )}
        </Grid>
      </View>

      <Table
        cols={[{ label: 'Ingredient', flex: 1.5 }, { label: 'Buy / weigh raw', flex: 1 }, { label: 'Expected cooked yield', flex: 1.1 }, { label: 'Actual cooked batch (g)', flex: 1.2 }, { label: 'Per container', flex: 1 }]}
        rows={lines.map(l => ({
          key: l.key,
          cells: [
            <View key="n"><T size={14}>{l.name}</T><Muted size={11}>{l.listed}</Muted></View>,
            <View key="b"><T size={14} tab>{l.buy}</T><Muted size={11}>{l.buyBasis}</Muted></View>,
            <View key="e">
              <T size={14} tab>{l.expected}</T>
              {l.est && <Row gap={4}><Icon name="warning" size={11} color={C.a300} /><T size={11} color={C.a300}>estimated yield</T></Row>}
            </View>,
            l.canActual ? (
              <NumInput key="a" value={l.actual} placeholder="weigh after cooking" style={{ width: 150 }}
                onValue={v => up(pp => { if (v == null) delete pp.actual[l.key]; else pp.actual[l.key] = v; })} />
            ) : <View key="a" />,
            <View key="p"><T size={15} tab>{l.per}</T>{!!l.perBasis && <Muted size={11}>{l.perBasis}</Muted>}</View>,
          ],
        }))}
      />
      {missing && <Muted size={13}>This plan's recipe or meal no longer exists. Choose another source above.</Muted>}

      {isR && (
        <Field label="Actual total cooked weight of the batch (g)" style={{ maxWidth: 280 }}>
          <NumInput value={p.actual.total ?? null} placeholder={totalPh} onValue={v => up(pp => { if (v == null) delete pp.actual.total; else pp.actual.total = v; })} />
        </Field>
      )}
      <Muted size={12}>{note}</Muted>
    </Card>
  );
}
