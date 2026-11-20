/* "Log something else": food eaten that wasn't in the plan (a coffee, a restaurant meal, a snack).
   Pick a food from the library (with grams) or enter a quick estimate. The day's remaining meals are then re-portioned so
   the day still lands on target (RG.logExtra). */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Food } from '@/domain/types';
import { searchUsda, usdaEnabled } from '@/lib/foodApi';
import { useRG } from '@/store/rg';
import { Btn, Dialog, Field, Input, Muted, NumInput, Row, Seg, T, Tap } from '@/ui/kit';
import { alpha, C, R } from '@/ui/theme';

type Mode = 'food' | 'estimate';

export function LogExtraDialog({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const RG = useRG();
  const [mode, setMode] = useState<Mode>('food');
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<Food | null>(null);
  const [g, setG] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState<number | null>(null);
  const [p, setP] = useState<number | null>(null);
  const [c, setC] = useState<number | null>(null);
  const [f, setF] = useState<number | null>(null);
  const [usda, setUsda] = useState<{ q: string; foods: Food[]; loading: boolean }>({ q: '', foods: [], loading: false });
  useEffect(() => { if (open) { setMode('food'); setQ(''); setPick(null); setG(null); setName(''); setKcal(null); setP(null); setC(null); setF(null); } }, [open]);

  const ql = q.trim().toLowerCase();
  // Online USDA search alongside the built-in list (as in Eat › Meals), debounced.
  useEffect(() => {
    if (!usdaEnabled() || ql.length < 3) { setUsda({ q: '', foods: [], loading: false }); return; }
    let live = true; setUsda(u => ({ ...u, loading: true }));
    const t = setTimeout(() => {
      searchUsda(ql, 6).then(foods => { if (live) setUsda({ q: ql, foods, loading: false }); }).catch(() => { if (live) setUsda({ q: ql, foods: [], loading: false }); });
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [ql]);
  const online = usda.q === ql ? usda.foods.filter(x => !RG.food(x.id)) : [];
  const results = ql.length > 1 ? (() => {
    const all = RG.allFoods(); const nm = (x: Food) => x.name.toLowerCase();
    const starts = all.filter(x => nm(x).split(/[\s,(-]+/).some(w => w.startsWith(ql)));
    const has = all.filter(x => !starts.includes(x) && nm(x).includes(ql));
    return [...starts, ...has].slice(0, 8);
  })() : [];

  // Quick estimate: when only calories are known, assume a typical mixed split (15% protein, 50% carbs, 35% fat).
  const est = kcal != null && kcal > 0 ? {
    kcal,
    p: p ?? Math.round(kcal * 0.15 / 4), c: c ?? Math.round(kcal * 0.5 / 4), f: f ?? Math.round(kcal * 0.35 / 9),
  } : null;
  const foodM = pick && g ? RG.macros(pick.id, g) : null;
  const ready = mode === 'food' ? !!(pick && g && g > 0) : !!(est && name.trim());

  const save = () => {
    if (!ready) return;
    const open0 = RG.getDay(date).meals.filter(m => !m.logged).flatMap(m => m.items);
    const before = RG.sumM(open0).kcal;
    const label = mode === 'food' ? pick!.name.split(',')[0] : name.trim();
    if (mode === 'food') { if (!RG.food(pick!.id)) RG.update(s => { s.customFoods[pick!.id] = pick!; }); RG.logExtra(date, { name: label, foodId: pick!.id, g: g! }); }
    else RG.logExtra(date, { name: label, g: 0, estimate: est! });
    const after = RG.sumM(RG.getDay(date).meals.filter(m => !m.logged).flatMap(m => m.items)).kcal;
    const eaten = Math.round(mode === 'food' ? foodM!.kcal : est!.kcal); const drop = Math.round(before - after);
    RG.toast(`${label} logged (${RG.num(eaten)} kcal).${drop > 5 ? ` Your remaining meals were trimmed by ${RG.num(drop)} kcal to keep today on target.` : ''}`, false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} width={480} title="Log something else"
      body="Ate something that wasn't in your plan? Log it here. Regimen trims the meals you haven't eaten yet so today still lands on target."
      actions={<><Btn title="Cancel" onPress={onClose} /><Btn variant="primary" title="Log it" disabled={!ready} onPress={save} /></>}>
      <Seg<Mode> value={mode} onChange={setMode} options={[{ value: 'food', label: 'Find a food' }, { value: 'estimate', label: 'Quick estimate' }]} />
      {mode === 'food' ? (
        <View style={{ gap: 10 }}>
          {pick ? (
            <View style={{ gap: 8 }}>
              <Row gap={8}>
                <T size={15} w={600} style={{ flex: 1 }}>{pick.name}</T>
                <Btn variant="ghost" size="sm" title="Change" onPress={() => { setPick(null); setG(null); }} />
              </Row>
              <Field label="How much (grams)">
                <NumInput value={g} onValue={setG} autoFocus accessibilityLabel="Grams eaten" />
              </Field>
              {!!pick.serving && <Row gap={6} wrap>
                {[0.5, 1, 2].map(k => <Btn key={k} size="sm" title={`${k} ${pick.serving!.label}`} onPress={() => setG(Math.round(pick.serving!.g * k))} />)}
              </Row>}
              {foodM && <Muted>{`${RG.num(Math.round(foodM.kcal))} kcal · ${Math.round(foodM.p)} g protein · ${Math.round(foodM.c)} g carbs · ${Math.round(foodM.f)} g fat`}</Muted>}
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              <Input value={q} onChange={setQ} placeholder="Search foods, e.g. banana, latte, pizza" accessibilityLabel="Search foods to log" autoFocus />
              {results.map(x => (
                <Tap key={x.id} onPress={() => { setPick(x); setG(x.serving ? x.serving.g : 100); }} label={`Pick ${x.name}`}
                  style={(st: { hovered?: boolean }) => ({ paddingVertical: 8, paddingHorizontal: 10, borderRadius: R.md, backgroundColor: st.hovered ? alpha(C.accent, 0.1) : 'transparent' })}>
                  <T size={14}>{x.name}</T>
                  <Muted size={11}>{`per 100 g: ${Math.round(x.kcal)} kcal · ${RG.r1(x.p)} g protein`}</Muted>
                </Tap>
              ))}
              {online.map(x => (
                <Tap key={x.id} onPress={() => { setPick(x); setG(x.serving ? x.serving.g : 100); }} label={`Pick ${x.name}`}
                  style={(st: { hovered?: boolean }) => ({ paddingVertical: 8, paddingHorizontal: 10, borderRadius: R.md, backgroundColor: st.hovered ? alpha(C.accent, 0.1) : 'transparent' })}>
                  <T size={14}>{x.name}</T>
                  <Muted size={11}>{`USDA · per 100 g: ${Math.round(x.kcal)} kcal · ${RG.r1(x.p)} g protein`}</Muted>
                </Tap>
              ))}
              {usda.loading && <Muted size={12}>Searching the USDA food database…</Muted>}
              {ql.length > 1 && !results.length && !online.length && !usda.loading && (
                <Row gap={6} wrap><Muted>Not in the food list.</Muted><Btn variant="ghost" size="sm" title="Use a quick estimate instead" onPress={() => { setMode('estimate'); setName(q.trim()); }} /></Row>
              )}
            </View>
          )}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Field label="What was it?"><Input value={name} onChange={setName} placeholder="e.g. Restaurant burger" maxLength={120} accessibilityLabel="What you ate" /></Field>
          <Field label="Calories (kcal)"><NumInput value={kcal} onValue={setKcal} accessibilityLabel="Calories" /></Field>
          <Row gap={8}>
            <Field label="Protein g" style={{ flex: 1 }}><NumInput value={p} onValue={setP} accessibilityLabel="Protein grams" /></Field>
            <Field label="Carbs g" style={{ flex: 1 }}><NumInput value={c} onValue={setC} accessibilityLabel="Carb grams" /></Field>
            <Field label="Fat g" style={{ flex: 1 }}><NumInput value={f} onValue={setF} accessibilityLabel="Fat grams" /></Field>
          </Row>
          <Muted size={12}>Protein, carbs and fat are optional. Only know the calories? Regimen assumes a typical mix.</Muted>
        </View>
      )}
    </Dialog>
  );
}

/** The day's unplanned food, with a remove button for each (removing one re-portions the meals back up). */
export function ExtrasList({ date }: { date: string }) {
  const RG = useRG();
  const extras = RG.getDay(date).extras || [];
  if (!extras.length) return null;
  return (
    <View style={{ gap: 4 }}>
      {extras.map(x => {
        const m = RG.extraMacros(x);
        return (
          <Row key={x.key} gap={8}>
            <T size={14} style={{ flex: 1 }} numberOfLines={1}>{x.name}{x.foodId ? <T size={14} color={C.n400}>{` · ${Math.round(x.g)} g`}</T> : null}</T>
            <Muted size={12}>{`${RG.num(Math.round(m.kcal))} kcal`}</Muted>
            <Btn variant="ghost" iconOnly icon="x" color={C.n500} label={`Remove ${x.name}`} style={{ width: 30, height: 30 }}
              onPress={() => { RG.removeExtra(date, x.key); RG.toast(`${x.name} removed. Your remaining meals were re-portioned.`, false); }} />
          </Row>
        );
      })}
    </View>
  );
}
