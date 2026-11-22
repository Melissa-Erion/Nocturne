/* Picking foods. Portions are never entered here: Regimen works out the grams.
   - FoodLikes: tap the foods you like (grouped chips + search). Used in setup and in "Choose my foods".
   - ChooseFoodsDialog: "Choose my foods" on Eat › Meals. Builds every meal from the likes (RG.mealsFromLikes).
   - MealFoodsDialog: "Change foods" on one meal. Picks exactly what goes in that meal. */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Food } from '@/domain/types';
import { useRG } from '@/store/rg';
import { Btn, Dialog, Input, Muted, Row, T, Tap } from '@/ui/kit';
import { C } from '@/ui/theme';

/** Common foods, grouped the way people think about a plate. */
const GROUPS: [string, string, string[]][] = [
  ['protein', 'Protein', ['chicken_c', 'gchicken_c', 'gturkey_c', 'eggs', 'yog', 'turkey', 'beef_c', 'salmon_r', 'tuna', 'cod_c', 'tofu', 'cottage', 'eggw', 'whey']],
  ['carb', 'Carbs', ['oats', 'rice_c', 'potato_c', 'sweet_c', 'pasta_c', 'quinoa_c', 'bread', 'tortilla', 'lentils', 'chick']],
  ['veg', 'Fruit & veg', ['banana', 'blueb', 'broccoli_c', 'spinach', 'greens', 'peppers']],
  ['fat', 'Fats', ['avocado', 'almonds', 'pb', 'oil', 'cheddar', 'feta', 'hummus']],
];
const short = (f: Food) => f.name.split(',')[0];

/** Grouped food chips plus a search for anything else. */
export function FoodLikes({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const RG = useRG();
  const [q, setQ] = useState('');
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  const listed = new Set(GROUPS.flatMap(g => g[2]));
  const ql = q.trim().toLowerCase();
  const results = ql.length > 1 ? RG.allFoods().filter(f => f.name.toLowerCase().includes(ql)).slice(0, 8) : [];
  const extra = value.filter(id => !listed.has(id)).map(id => RG.food(id)).filter((f): f is Food => !!f);
  const chip = (f: Food) => {
    const on = value.includes(f.id);
    return (
      <Tap key={f.id} onPress={() => toggle(f.id)} label={`${on ? 'Remove' : 'Add'} ${f.name}`}
        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: on ? C.accent : C.n700, backgroundColor: on ? C.a800 : 'transparent' }}>
        <T size={13} color={on ? C.a100 : C.text}>{(on ? '✓ ' : '') + short(f)}</T>
      </Tap>
    );
  };
  return (
    <View style={{ gap: 14 }}>
      {GROUPS.map(([role, label, ids]) => (
        <View key={role} style={{ gap: 6 }}>
          <T size={13} w={600} color={C.n300}>{label}</T>
          <Row gap={6} wrap>{ids.map(id => RG.food(id)).filter((f): f is Food => !!f).map(chip)}</Row>
        </View>
      ))}
      {!!extra.length && (
        <View style={{ gap: 6 }}>
          <T size={13} w={600} color={C.n300}>Also picked</T>
          <Row gap={6} wrap>{extra.map(chip)}</Row>
        </View>
      )}
      <View style={{ gap: 6 }}>
        <Input value={q} onChange={setQ} placeholder="Something else? Search all foods" accessibilityLabel="Search all foods" />
        {!!results.length && <Row gap={6} wrap>{results.map(chip)}</Row>}
      </View>
    </View>
  );
}

/** Why the current picks can't build a plan yet (or '' if they can). */
export function likesProblem(RG: ReturnType<typeof useRG>, likes: string[]) {
  const roles = likes.map(id => RG.food(id)?.role);
  if (!roles.includes('protein')) return 'Pick at least one protein.';
  if (!roles.includes('carb')) return 'Pick at least one carb.';
  return '';
}

/** "Choose my foods": tap what you like, Regimen builds every meal from it. */
export function ChooseFoodsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const RG = useRG();
  const P = RG.s.profile;
  const day = RG.getDay(RG.TODAY);
  const tgs = RG.mealTargets(day.type);
  const initial = () => {
    const from = P.mealFoods?.some(l => l.length) ? P.mealFoods.flat() : [];
    return from.filter((x, i) => from.indexOf(x) === i);
  };
  const [likes, setLikes] = useState<string[]>(initial);
  useEffect(() => { if (open) setLikes(initial()); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const problem = likesProblem(RG, likes);
  const build = () => {
    RG.setMealFoods(RG.mealsFromLikes(likes, tgs.map(t => t.label)));
    RG.toast('Your meals are built from the foods you like. The grams are worked out for you.', false);
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} width={560} title="What do you like to eat?"
      body="Tap every food you'd happily eat. Regimen builds your meals from them and works out the grams to hit your targets. You can fine-tune any meal afterwards."
      actions={<><Btn title="Cancel" onPress={onClose} /><Btn variant="primary" title="Build my meals" disabled={!!problem} onPress={build} /></>}>
      <FoodLikes value={likes} onChange={setLikes} />
      <Muted size={12}>{problem || `${likes.length} foods picked.`}</Muted>
    </Dialog>
  );
}

/** "Change foods" on one meal: pick exactly what goes in it. */
export function MealFoodsDialog({ open, onClose, meal }: { open: boolean; onClose: () => void; meal: number }) {
  const RG = useRG();
  const P = RG.s.profile;
  const day = RG.getDay(RG.TODAY);
  const t = RG.mealTargets(day.type)[meal];
  const initial = () => P.mealFoods?.[meal]?.length ? [...P.mealFoods[meal]] : (day.meals[meal]?.items || []).filter(x => !x.estimate).map(x => x.foodId);
  const [picks, setPicks] = useState<string[]>(initial);
  useEffect(() => { if (open) setPicks(initial()); }, [open, meal]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => {
    const all = Array.from({ length: Math.max(meal + 1, day.meals.length) }, (_, i) =>
      i === meal ? picks : P.mealFoods?.[i]?.length ? P.mealFoods[i] : (day.meals[i]?.items || []).filter(x => !x.estimate).map(x => x.foodId));
    RG.setMealFoods(all, meal);
    RG.toast(`${t?.label || 'Meal'} updated from today on. The grams are worked out for you.`, false);
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} width={560} title={`Change ${t?.label?.toLowerCase() || 'this meal'}`}
      body="Tap the foods for this meal. You don't need amounts: Regimen works out the grams. This changes this meal from today on."
      actions={<><Btn title="Cancel" onPress={onClose} /><Btn variant="primary" title="Save meal" disabled={!picks.length} onPress={save} /></>}>
      <FoodLikes value={picks} onChange={setPicks} />
      <Muted size={12}>{picks.length ? picks.map(id => RG.food(id)).filter((f): f is Food => !!f).map(short).join(', ') : 'Nothing picked yet.'}</Muted>
    </Dialog>
  );
}
