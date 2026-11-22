/* Swap a food (opened from a meal's Swap button). One list of foods of the same kind: tap one and it replaces the
   food, the whole meal's grams are worked out again, and you're back in the meal. */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRG } from '@/store/rg';
import { useUI } from '@/store/store';
import { Btn, Card, Chip, H, Icon, Muted, NotMedical, Row, T, Tap } from '@/ui/kit';
import { C, R } from '@/ui/theme';
import { Screen } from './Shell';

/** Context passed by the meal: RG.go('alternatives', { date, meal, key, foodId, g }). */
type AltCtx = { date: string; meal: number; key: string; foodId: string; g: number };
const isCtx = (p: unknown): p is AltCtx => !!p && typeof p === 'object' && typeof (p as AltCtx).key === 'string' && typeof (p as AltCtx).date === 'string';

const TAGS: [string, string][] = [['', 'All'], ['Dairy-free', 'Dairy-free'], ['Vegan', 'Vegan'], ['Gluten-free', 'Gluten-free']];
const KIND: Record<string, string> = { protein: 'proteins', carb: 'carbs', fat: 'fats', veg: 'fruit and veg' };

export default function AlternativesScreen() {
  const RG = useRG();
  const rp = useUI(u => u.routeParam);
  const [ctx, setCtx] = useState<AltCtx | null>(() => (isCtx(rp) ? rp : null));
  const [tag, setTag] = useState('');
  const [done, setDone] = useState<{ from: string; to: string; name: string } | null>(null);
  useEffect(() => { if (isCtx(rp)) { setCtx(rp); setDone(null); } }, [rp]);
  // Swaps only make sense from a meal. Opened any other way, go to Meals.
  useEffect(() => { if (!ctx) RG.go('meals'); }, [ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ctx) return null;

  const f = RG.food(ctx.foodId);
  const t = RG.mealTargets(RG.getDay(ctx.date).type)[ctx.meal];
  // Raw and cooked versions of the same food share a name; show each food once (best match first).
  const list = RG.alternatives(ctx.foodId, ctx.g, { tag }).filter((a, i, all) => all.findIndex(b => b.food.name === a.food.name) === i)
    // foods people usually eat at this meal first (yogurt or eggs at breakfast, not turkey), best match within each group
    .map((a, i) => ({ a, i, fit: t && RG.suitsMeal(a.food.id, t.label) ? 0 : 1 })).sort((x, y) => x.fit - y.fit || x.i - y.i).map(x => x.a).slice(0, 10);
  const back = () => RG.go('meals', { date: ctx.date, meal: ctx.meal });
  const use = (id: string, name: string) => {
    if (!RG.swapFood(ctx.date, ctx.meal, ctx.key, id)) return RG.toast('That food is no longer in the meal. Go back to the meal and try again.');
    setDone({ from: ctx.foodId, to: id, name: name.split(',')[0] });
  };

  // After the swap: confirm, and offer to make it the usual choice for this meal.
  if (done) return (
    <Screen>
      <Card gap={12} pad={[20, 20]}>
        <Row gap={8}><Icon name="check-circle" fill size={20} color={C.accent} /><T size={18} w={600}>{`Swapped in ${done.name}`}</T></Row>
        <Muted size={13}>The grams for the whole meal were worked out again, so it still hits its target.</Muted>
        <T size={14}>{`Always use ${done.name} instead of ${(f?.name || 'the old food').split(',')[0]} in ${t?.label?.toLowerCase() || 'this meal'}?`}</T>
        <Row gap={8} wrap>
          <Btn variant="primary" title="Yes, always" onPress={() => { RG.rememberSwap(ctx.meal, done.from, done.to); RG.toast(`${t?.label || 'This meal'} will use ${done.name} from now on.`, false); back(); }} />
          <Btn title="Just this once" onPress={back} />
        </Row>
      </Card>
    </Screen>
  );

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Muted>{`${t?.label || 'Meal'} · ${ctx.date === RG.TODAY ? 'today' : RG.fmtD(ctx.date)}`}</Muted>
        <H size={28}>{`Swap ${(f?.name || 'this food').split(',')[0]} for…`}</H>
        <Muted size={13}>{`Other ${KIND[f?.role || ''] || 'foods'} that fit this meal. Tap one: the amount is worked out for you.`}</Muted>
      </View>
      <Row gap={6} wrap>
        {TAGS.map(([v, l]) => <Chip key={v || 'all'} label={l} on={tag === v} onPress={() => setTag(v)} />)}
      </Row>

      <View style={{ gap: 8 }}>
        {list.map(a => (
          <Tap key={a.food.id} onPress={() => use(a.food.id, a.food.name)} label={`Use ${a.food.name}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: R.lg, borderWidth: 1, borderColor: C.n800, backgroundColor: C.surface }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={15} w={500}>{a.food.name}</T>
              <Muted size={12}>{`About ${a.g} g · ${Math.round(a.m.kcal)} kcal · ${RG.r1(a.m.p)} g protein`}</Muted>
            </View>
            <Icon name="caret-right" size={16} color={C.n500} />
          </Tap>
        ))}
        {!list.length && <Card><Muted size={13}>Nothing matches this filter. Try All.</Muted></Card>}
      </View>
      <Row><Btn icon="arrow-left" title="Back to meal" onPress={back} /></Row>
      <NotMedical />
    </Screen>
  );
}
