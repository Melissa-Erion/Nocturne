/* 12. Recipes & Saved Meals — port of prototype/FitRecipes.dc.html */
import { useState } from 'react';
import { View } from 'react-native';
import type { Basis, Food, FoodRole, Recipe } from '@/domain/types';
import { lookupBarcode } from '@/lib/foodApi';
import { useRG } from '@/store/rg';
import {
  Btn, Card, CardTitle, Dialog, Empty, Field, H, Icon, Input, Muted, NotMedical, NumInput, Row, Seg, Select, T, Tag, Tap, useLayout,
} from '@/ui/kit';
import { alpha, C, R } from '@/ui/theme';
import { BarcodeScanner } from './recipes/BarcodeScanner';
import { Grid } from './prep/ui';
import { Screen } from './Shell';

type Tab = 'recipes' | 'meals' | 'foods';
type N = number | null;
interface Est { name: string; kcal: N; p: N; c: N; f: N }
interface CF { name: string; basis: Basis; serving: N; kcal: N; p: N; c: N; f: N; role: FoodRole; cat: string; src?: string }
const EST0: Est = { name: '', kcal: null, p: null, c: null, f: null };
const CF0: CF = { name: '', basis: 'prepared', serving: 100, kcal: null, p: null, c: null, f: null, role: 'protein', cat: 'Pantry' };
const BASIS_OPTS: { value: Basis; label: string }[] = [
  { value: 'prepared', label: 'As sold / prepared' }, { value: 'raw', label: 'Raw' }, { value: 'cooked', label: 'Cooked' }, { value: 'drained', label: 'Drained' }, { value: 'edible', label: 'Edible portion' },
];
const ROLE_OPTS: { value: FoodRole; label: string }[] = [{ value: 'protein', label: 'Protein' }, { value: 'carb', label: 'Carbohydrate' }, { value: 'fat', label: 'Fat' }, { value: 'veg', label: 'Vegetable' }];
const CATS = ['Meat & fish', 'Dairy & eggs', 'Grains & starches', 'Produce', 'Pantry', 'Frozen'];

export default function RecipesScreen() {
  const RG = useRG();
  const S = RG.s;
  const [tab, setTab] = useState<Tab>('recipes');
  const [rid, setRid] = useState<string | null>(null);
  const [est, setEst] = useState<Est>(EST0);
  const [cf, setCf] = useState<CF>(CF0);
  const [scan, setScan] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; run: () => void }>(null);
  const { width, wide } = useLayout();

  /* recipes */
  const r = S.recipes.find(x => x.id === rid) || S.recipes[0];
  const upR = (fn: (x: Recipe) => void) => RG.update(s => { const x = r && s.recipes.find(y => y.id === r.id); if (x) fn(x); });
  const rn = r ? RG.recipeNutrition(r) : null;
  const foodOpts = RG.allFoods().map(f => ({ value: f.id, label: `${f.name} · ${f.basis}` })).sort((a, b) => a.label < b.label ? -1 : 1);
  const newRecipe = () => { const id = 'rc' + RG.uid(); RG.update(s => { s.recipes.push({ id, name: 'New recipe', ingredients: [{ foodId: 'chicken_r', g: 500 }], cookedWeight: 400, servings: 4, byWeight: false, fav: false }); }); setRid(id); };
  const dupRecipe = () => { if (!r) return; const c: Recipe = JSON.parse(JSON.stringify(r)); c.id = 'rc' + RG.uid(); c.name += ' (copy)'; RG.update(s => { s.recipes.push(c); }); setRid(c.id); };
  const delRecipe = () => r && setConfirm({
    title: `Delete "${r.name}"?`, body: 'Meal-prep plans using it will be removed too.',
    run: () => { RG.update(s => { s.recipes = s.recipes.filter(x => x.id !== r.id); s.prep = s.prep.filter(p => !(p.kind === 'recipe' && p.mealId === r.id)); }); setRid(null); },
  });
  const servingW = r ? (r.servingG || Math.round(r.cookedWeight / (r.servings || 1))) : null;
  const m3 = (m: { p: number; c: number; f: number }) => `${RG.r1(m.p)} P · ${RG.r1(m.c)} C · ${RG.r1(m.f)} F`;

  /* saved meals */
  const T0 = RG.TODAY; const today = RG.getDay(T0); const tgs = RG.mealTargets(today.type);
  const slotOpts = tgs.map((t, i) => ({ value: i, label: `${t.name} · ${t.label}` }));
  const addTo = (mid: string, i: number) => {
    RG.update(s => {
      const m = s.savedMeals.find(x => x.id === mid); const day = s.days[T0] || RG.getDay(T0); const mm = day?.meals[i]; if (!m || !mm) return;
      if (m.items.length) mm.items = m.items.map(x => ({ ...x, key: RG.uid(), locked: false }));
      else if (m.estimate) {
        const id = 'est' + m.id;
        s.customFoods[id] = { id, name: m.name + ' — 1 portion = 100 g', basis: 'prepared', kcal: m.estimate.kcal, p: m.estimate.p, c: m.estimate.c, f: m.estimate.f, role: 'protein', cat: 'Other', tags: [], src: 'Restaurant estimate', est: true };
        mm.items = [{ key: RG.uid(), foodId: id, g: 100, locked: true }];
      }
      m.uses = (m.uses || 0) + 1;
    });
    RG.toast(`Added to ${tgs[i]?.name || 'meal'}.`);
  };
  const saveEst = () => {
    if (!est.name || !est.kcal) return RG.toast('Add a name and calories.');
    RG.update(s => { s.savedMeals.push({ id: 'sm' + RG.uid(), name: 'Restaurant: ' + est.name + ' (estimate)', items: [], estimate: { kcal: est.kcal!, p: est.p || 0, c: est.c || 0, f: est.f || 0 }, fav: false, uses: 0 }); });
    setEst(EST0); RG.toast('Estimate saved.');
  };

  /* custom foods */
  const cfK = (cf.p || 0) * 4 + (cf.c || 0) * 4 + (cf.f || 0) * 9;
  const cfCheck = cf.kcal ? `Label check: macros add up to ${Math.round(cfK)} kcal vs ${cf.kcal} on the label${Math.abs(cfK - cf.kcal) > cf.kcal * 0.12 ? ', a large gap, so double-check the numbers (fibre or rounding can explain small gaps)' : ', consistent'}.` : 'Enter values exactly as printed per serving.';
  const saveCf = () => {
    const sv = cf.serving || 100; if (!cf.name || cf.kcal == null) return RG.toast('Name and calories are required.');
    const k = 100 / sv; const id = RG.lid('cf_');
    RG.update(s => { s.customFoods[id] = { id, name: cf.name, basis: cf.basis, kcal: RG.r1(cf.kcal! * k), p: RG.r1((cf.p || 0) * k), c: RG.r1((cf.c || 0) * k), f: RG.r1((cf.f || 0) * k), role: cf.role, cat: cf.cat, tags: [], src: cf.src || 'Custom · product label', est: false, custom: true, serving: { label: 'serving', g: sv } }; });
    setCf(x => ({ ...x, name: '', kcal: null, p: null, c: null, f: null, src: undefined })); RG.toast('Custom food saved. It is available in the meal planner.');
  };
  const onCode = async (code: string) => {
    setScan(false); RG.toast(`Looking up barcode ${code}…`);
    let f: Food | null = null;
    try { f = await lookupBarcode(code); } catch { return RG.toast('Barcode lookup failed. Check your connection, or enter the label manually.'); }
    if (!f) return RG.toast(`No match for barcode ${code}. Enter the label manually.`);
    const sv = f.serving?.g || 100; const k = sv / 100; const r1 = RG.r1;
    setCf({ name: f.name, basis: f.basis, serving: sv, kcal: Math.round(f.kcal * k), p: r1(f.p * k), c: r1(f.c * k), f: r1(f.f * k), role: f.role, cat: CATS.includes(f.cat) ? f.cat : 'Pantry', src: f.src });
    setTab('foods');
    RG.toast(`Match found: ${f.name}. Check the values against the label before saving${f.est ? ' — some values were missing' : ''}.`);
  };
  const customs = Object.values(S.customFoods);
  const setC = <K extends keyof CF>(k: K) => (v: CF[K]) => setCf(x => ({ ...x, [k]: v }));
  const setE = <K extends keyof Est>(k: K) => (v: Est[K]) => setEst(x => ({ ...x, [k]: v }));

  const side = Math.min(width - (wide ? 236 + 56 : 28), 1320) >= 260 * 3 + 32; // the prototype's auto-fit 260 px grid with the editor spanning two columns

  return (
    <Screen>
      <Row gap={12} wrap align="flex-end">
        <View style={{ marginRight: 'auto' }}>
          <Muted>Recipes, favourites, custom foods and estimates</Muted>
          <H size={28} style={{ marginTop: 2 }}>Recipes &amp; Saved Meals</H>
        </View>
        <Seg<Tab> value={tab} onChange={setTab} options={[{ value: 'recipes', label: 'Recipes' }, { value: 'meals', label: 'Saved meals' }, { value: 'foods', label: 'Custom foods' }]} />
      </Row>

      <View>
        {tab === 'recipes' && (
          <View style={{ flexDirection: side ? 'row' : 'column', gap: 16, alignItems: side ? 'flex-start' : 'stretch' }}>
            <Card gap={4} pad={[10, 10]} style={side ? { flex: 1 } : undefined}>
              {S.recipes.map(x => {
                const on = !!r && x.id === r.id;
                return (
                  <Tap key={x.id} onPress={() => setRid(x.id)} label={x.name}
                    style={st => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 10, minHeight: 40, borderRadius: 6, backgroundColor: on ? alpha(C.accent, 0.12) : st.hovered ? alpha(C.text, 0.05) : 'transparent' })}>
                    <Icon name="star" fill={x.fav} size={14} color={C.accent} />
                    <T size={13} style={{ flex: 1 }} numberOfLines={1}>{x.name}</T>
                    <Muted size={11}>{`${x.servings} servings`}</Muted>
                  </Tap>
                );
              })}
              <Btn variant="ghost" icon="plus" title="New recipe" onPress={newRecipe} />
            </Card>

            <Card gap={12} style={side ? { flex: 2 } : undefined}>
              {!r || !rn ? (
                <Empty icon="book-open" title="No recipes yet" body="Create a recipe from ingredients by weight. Nutrition is spread over the cooked weight, so it works for batch cooking and meal prep." action={<Btn variant="primary" icon="plus" title="New recipe" onPress={newRecipe} />} />
              ) : (
                <>
                  <Row gap={8} wrap>
                    <Input value={r.name} onChange={v => upR(x => { x.name = v; })} size={18} height={40} style={{ flex: 1, minWidth: 200, width: undefined }} />
                    <Btn variant="ghost" iconOnly icon="star" iconFill={r.fav} iconSize={18} label="Favourite" onPress={() => upR(x => { x.fav = !x.fav; })} />
                    <Btn variant="ghost" icon="copy" title="Duplicate" onPress={dupRecipe} />
                    <Btn variant="ghost" iconOnly icon="trash" color={C.n500} label="Delete recipe" onPress={delRecipe} />
                  </Row>
                  <T size={11} upper color={C.n500} style={{ letterSpacing: 0.9 }}>Ingredients, by weight</T>
                  {r.ingredients.map((i, ii) => {
                    const m = RG.macros(i.foodId, i.g);
                    return (
                      <Row key={ii} gap={8} wrap>
                        <Select value={i.foodId} options={foodOpts} onChange={v => upR(x => { x.ingredients[ii].foodId = v; })} title="Ingredient" style={{ flexGrow: 1, flexBasis: 260, width: undefined }} />
                        <NumInput value={i.g} onValue={v => upR(x => { x.ingredients[ii].g = v || 0; })} style={{ width: 100, textAlign: 'right' }} />
                        <T size={12} color={C.n400} tab style={{ flexGrow: 1, flexBasis: 120, flexShrink: 1 }}>{`${Math.round(m.kcal)} kcal · ${RG.r1(m.p)}P ${RG.r1(m.c)}C ${RG.r1(m.f)}F`}</T>
                        <Btn variant="ghost" iconOnly icon="x" color={C.n500} label="Remove ingredient" style={{ width: 30, height: 30 }} onPress={() => upR(x => { x.ingredients.splice(ii, 1); })} />
                      </Row>
                    );
                  })}
                  <Row><Btn variant="ghost" icon="plus" title="Add ingredient" onPress={() => upR(x => { x.ingredients.push({ foodId: 'oil', g: 10 }); })} /></Row>
                  <Grid min={160} gap={10}>
                    <Field label="Total cooked weight (g)"><NumInput value={r.cookedWeight} onValue={v => upR(x => { x.cookedWeight = v || 0; })} /></Field>
                    <Field label="Divide by">
                      <Seg<'count' | 'weight'> value={r.byWeight ? 'weight' : 'count'} options={[{ value: 'count', label: 'Servings' }, { value: 'weight', label: 'Serving weight' }]}
                        onChange={v => upR(x => { if (v === 'count') x.byWeight = false; else { x.byWeight = true; x.servingG = x.servingG || Math.round(x.cookedWeight / (x.servings || 1)); } })} />
                    </Field>
                    {r.byWeight
                      ? <Field label="Serving weight (g, cooked)"><NumInput value={servingW} onValue={v => { if (v == null) return; const g = Math.max(1, v); upR(x => { x.servingG = g; x.servings = RG.r1(x.cookedWeight / g) || 1; }); }} /></Field>
                      : <Field label="Servings"><NumInput value={r.servings} onValue={v => { if (v == null) return; upR(x => { x.servings = Math.max(1, v); }); }} /></Field>}
                  </Grid>
                  <View style={{ padding: 12, borderRadius: R.md, backgroundColor: C.n900 }}>
                    <Grid min={150} gap={10}>
                      <View>
                        <Muted size={11}>{`Per serving · ${Math.round(rn.servingG)} g cooked`}</Muted>
                        <T size={22} tab lh={1.3}>{RG.num(rn.perServing.kcal)} kcal</T>
                        <T size={12} color={C.n400}>{m3(rn.perServing)}</T>
                      </View>
                      <View>
                        <Muted size={11}>Per 100 g cooked</Muted>
                        <T size={22} tab lh={1.3}>{RG.num(rn.per100.kcal)} kcal</T>
                        <T size={12} color={C.n400}>{m3(rn.per100)}</T>
                      </View>
                      <View>
                        <Muted size={11}>Whole recipe</Muted>
                        <T size={22} tab lh={1.3}>{RG.num(rn.tot.kcal)} kcal</T>
                        <T size={12} color={C.n400}>{`${Math.round(rn.raw)} g raw → ${r.cookedWeight} g cooked`}</T>
                      </View>
                    </Grid>
                  </View>
                  <Muted size={12}>Nutrition is calculated from every ingredient, then spread over the actual cooked weight, so water lost or gained in cooking is accounted for.</Muted>
                  <NotMedical />
                </>
              )}
            </Card>
          </View>
        )}

        {tab === 'meals' && (
          <View style={{ gap: 16 }}>
            {S.savedMeals.length ? (
              <Grid min={300} gap={12}>
                {S.savedMeals.map(m => {
                  const t = m.estimate || RG.sumM(m.items);
                  const foods = m.items.length ? m.items.map(i => { const f = RG.food(i.foodId); return f ? `${f.name.split(',')[0]} ${i.g} g ${f.basis}` : ''; }).filter(Boolean).join(' · ') : 'Restaurant estimate — no ingredient breakdown';
                  return (
                    <Card key={m.id} gap={8} pad={[14, 16]}>
                      <Row gap={8}>
                        <T size={15} style={{ flex: 1 }}>{m.name}</T>
                        <Btn variant="ghost" iconOnly icon="star" iconFill={m.fav} color={C.accent} label="Favourite" onPress={() => RG.update(s => { const x = s.savedMeals.find(y => y.id === m.id); if (x) x.fav = !x.fav; })} />
                      </Row>
                      <Muted>{foods}</Muted>
                      <Row gap={6} wrap>
                        <T size={13} tab>{`${RG.num(t.kcal)} kcal · ${Math.round(t.p)}P ${Math.round(t.c)}C ${Math.round(t.f)}F`}</T>
                        {!!m.estimate && <Tag>Estimate</Tag>}
                      </Row>
                      <Row gap={4} wrap>
                        <Select<number> value={null} options={slotOpts} onChange={i => addTo(m.id, i)} placeholder="Add to today…" title="Add to today's meal" height={30} style={{ width: undefined, minWidth: 150 }} />
                        <Btn variant="ghost" size="sm" title="Duplicate" onPress={() => RG.update(s => { s.savedMeals.push({ ...JSON.parse(JSON.stringify(m)), id: 'sm' + RG.uid(), name: m.name + ' (copy)', uses: 0 }); })} />
                        <Btn variant="ghost" size="sm" title="Delete" color={C.n500} onPress={() => setConfirm({ title: `Delete saved meal "${m.name}"?`, body: 'Meals already planned on your days keep their foods.', run: () => RG.update(s => { s.savedMeals = s.savedMeals.filter(x => x.id !== m.id); }) })} />
                        <View style={{ flex: 1 }} />
                        <Muted size={11} color={C.n600}>{`used ${m.uses || 0}×`}</Muted>
                      </Row>
                    </Card>
                  );
                })}
              </Grid>
            ) : (
              <Card><Empty icon="fork-knife" title="No saved meals yet" body="Save a meal from the Meal Planner, or add a restaurant estimate below." action={<Btn title="Open meal planner" onPress={() => RG.go('meals')} />} /></Card>
            )}
            <Card gap={10} style={{ maxWidth: 640 }}>
              <CardTitle>Save a restaurant meal as an estimate</CardTitle>
              <Field label="Name"><Input value={est.name} onChange={setE('name')} placeholder="e.g. Burrito bowl, no cheese" /></Field>
              <Grid min={90} gap={8}>
                <Field label="kcal"><NumInput value={est.kcal} onValue={setE('kcal')} /></Field>
                <Field label="Protein g"><NumInput value={est.p} onValue={setE('p')} /></Field>
                <Field label="Carbs g"><NumInput value={est.c} onValue={setE('c')} /></Field>
                <Field label="Fat g"><NumInput value={est.f} onValue={setE('f')} /></Field>
              </Grid>
              <Row gap={8} wrap>
                <Muted size={12} style={{ flex: 1, minWidth: 200 }}>Restaurant values are labelled as estimates wherever they appear.</Muted>
                <Btn variant="primary" title="Save estimate" onPress={saveEst} />
              </Row>
            </Card>
          </View>
        )}

        {tab === 'foods' && (
          <Grid min={340} top>
            <Card gap={10}>
              <CardTitle>Custom food from a nutrition label</CardTitle>
              {!!cf.src && <Row gap={6}><Icon name="barcode" size={13} color={C.a300} /><T size={12} color={C.a300} style={{ flex: 1 }}>{`Prefilled from ${cf.src}. Check against the label before saving.`}</T></Row>}
              <Field label="Name"><Input value={cf.name} onChange={setC('name')} placeholder="Brand + product" /></Field>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[
                  <Field key="b" label="Weight basis"><Select<Basis> value={cf.basis} options={BASIS_OPTS} onChange={setC('basis')} title="Weight basis" /></Field>,
                  <Field key="s" label="Serving size (g)"><NumInput value={cf.serving} onValue={setC('serving')} /></Field>,
                  <Field key="k" label="kcal per serving"><NumInput value={cf.kcal} onValue={setC('kcal')} /></Field>,
                  <Field key="p" label="Protein g"><NumInput value={cf.p} onValue={setC('p')} /></Field>,
                  <Field key="c" label="Carbs g"><NumInput value={cf.c} onValue={setC('c')} /></Field>,
                  <Field key="f" label="Fat g"><NumInput value={cf.f} onValue={setC('f')} /></Field>,
                  <Field key="r" label="Role"><Select<FoodRole> value={cf.role} options={ROLE_OPTS} onChange={setC('role')} title="Role" /></Field>,
                  <Field key="cat" label="Category"><Select value={cf.cat} options={CATS} onChange={setC('cat')} title="Category" /></Field>,
                ].map(el => <View key={el.key} style={{ width: '48%', flexGrow: 1 }}>{el}</View>)}
              </View>
              <T size={12} color={C.n400}>{cfCheck}</T>
              <Row gap={8} wrap>
                <Btn icon="barcode" title="Scan barcode" onPress={() => setScan(true)} />
                <View style={{ flex: 1 }} />
                <Btn variant="primary" title="Save food" onPress={saveCf} />
              </Row>
            </Card>
            <Card gap={4} pad={[12, 18]}>
              <CardTitle>Your custom foods</CardTitle>
              {customs.map(c => (
                <Row key={c.id} gap={10} style={{ paddingVertical: 6 }}>
                  <T size={13} style={{ flex: 1 }}>{c.name} <T size={13} color={C.n500}>· {c.basis}</T></T>
                  <T size={12} color={C.n400} tab>{`per 100 g: ${c.kcal} kcal · ${c.p}P ${c.c}C ${c.f}F`}</T>
                  <Btn variant="ghost" iconOnly icon="x" color={C.n500} label={`Delete ${c.name}`} style={{ width: 28, height: 28 }} onPress={() => RG.update(s => { delete s.customFoods[c.id]; })} />
                </Row>
              ))}
              {!customs.length && <Muted size={13}>None yet. Values from a label are stored per 100 g of the basis you choose.</Muted>}
            </Card>
          </Grid>
        )}
      </View>

      <BarcodeScanner open={scan} onClose={() => setScan(false)} onCode={onCode} />
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title} body={confirm?.body}
        actions={<><Btn title="Cancel" onPress={() => setConfirm(null)} /><Btn variant="primary" icon="trash" title="Delete" onPress={() => { confirm?.run(); setConfirm(null); }} /></>} />
    </Screen>
  );
}
