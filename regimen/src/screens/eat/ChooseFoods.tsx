/* "Choose my foods": one step per meal. Tap the foods you like; Regimen works out the grams.
   Saves Profile.mealFoods and rebuilds every meal from today on that isn't eaten or prepped. */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Food } from '@/domain/types';
import { useRG } from '@/store/rg';
import { Btn, Dialog, Input, Muted, Row, T, Tap } from '@/ui/kit';
import { C } from '@/ui/theme';

/** Common foods, grouped the way people think about a plate. */
const GROUPS: [string, string, string[]][] = [
  ['protein', 'Protein', ['chicken_c', 'eggs', 'yog', 'turkey', 'beef_c', 'salmon_r', 'tuna', 'cod_c', 'tofu', 'cottage', 'eggw', 'whey']],
  ['carb', 'Carbs', ['oats', 'rice_c', 'potato_c', 'sweet_c', 'pasta_c', 'quinoa_c', 'bread', 'tortilla', 'lentils', 'chick']],
  ['veg', 'Fruit & veg', ['banana', 'blueb', 'broccoli_c', 'spinach', 'greens', 'peppers']],
  ['fat', 'Fats', ['avocado', 'almonds', 'pb', 'oil', 'cheddar', 'feta', 'hummus']],
];
const short = (f: Food) => f.name.split(',')[0];

export function ChooseFoods({ open, onClose, start = 0, single = false }: { open: boolean; onClose: () => void; start?: number; single?: boolean }) {
  const RG = useRG();
  const P = RG.s.profile;
  const day = RG.getDay(RG.TODAY);
  const tgs = RG.mealTargets(day.type);
  const n = Math.min(tgs.length, day.meals.length);
  const initial = () => Array.from({ length: n }, (_, i) => P.mealFoods?.[i]?.length ? [...P.mealFoods[i]] : day.meals[i].items.filter(x => !x.estimate).map(x => x.foodId));
  const [picks, setPicks] = useState<string[][]>(initial);
  const [step, setStep] = useState(start);
  const [q, setQ] = useState('');
  useEffect(() => { if (open) { setPicks(initial()); setStep(start); setQ(''); } }, [open, start]); // eslint-disable-line react-hooks/exhaustive-deps

  const i = Math.min(step, n - 1);
  const mine = picks[i] || [];
  const toggle = (id: string) => setPicks(p => p.map((l, k) => k !== i ? l : l.includes(id) ? l.filter(x => x !== id) : [...l, id]));
  const roles = mine.map(id => RG.food(id)?.role);
  const hint = !mine.length ? 'Pick at least one food.'
    : !roles.includes('protein') ? 'Tip: add a protein so this meal keeps you full.'
    : mine.length > 5 ? 'That’s a lot of foods for one meal. Portions will be small.' : '';
  const last = single || i === n - 1;
  const ql = q.trim().toLowerCase();
  const listed = new Set(GROUPS.flatMap(g => g[2]));
  const results = ql.length > 1 ? RG.allFoods().filter(f => f.name.toLowerCase().includes(ql)).slice(0, 8) : [];
  const extra = mine.filter(id => !listed.has(id)).map(id => RG.food(id)).filter((f): f is Food => !!f);
  const t = tgs[i];

  const finish = () => {
    RG.setMealFoods(picks, single ? i : undefined);
    RG.toast(single ? `${t?.label || 'Meal'} updated. Grams are worked out for you.` : 'Your meals are built. Grams are worked out for you.', false);
    onClose();
  };

  const chip = (f: Food) => {
    const on = mine.includes(f.id);
    return (
      <Tap key={f.id} onPress={() => toggle(f.id)} label={`${on ? 'Remove' : 'Add'} ${f.name}`}
        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: on ? C.accent : C.n700, backgroundColor: on ? C.a800 : 'transparent' }}>
        <T size={13} color={on ? C.a100 : C.text}>{(on ? '✓ ' : '') + short(f)}</T>
      </Tap>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} width={560}
      title={single ? `Change ${t?.label?.toLowerCase() || 'this meal'}` : `${t?.label || 'Meal'} · step ${i + 1} of ${n}`}
      body={`Tap the foods you'd like for ${t?.label?.toLowerCase() || 'this meal'}. You don't need amounts: Regimen works out the grams to hit your targets.`}
      actions={<>
        {!single && i > 0 ? <Btn title="Back" onPress={() => setStep(i - 1)} /> : <Btn title="Cancel" onPress={onClose} />}
        <Btn variant="primary" title={last ? (single ? 'Save meal' : 'Build my meals') : `Next: ${tgs[i + 1]?.label || 'next meal'}`} disabled={!mine.length}
          onPress={() => last ? finish() : (setStep(i + 1), setQ(''))} />
      </>}>
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
      <View style={{ paddingTop: 4 }}>
        <T size={13}>{mine.length ? `${t?.label || 'This meal'}: ${mine.map(id => RG.food(id)).filter((f): f is Food => !!f).map(short).join(', ')}` : 'Nothing picked yet.'}</T>
        {!!hint && <Muted size={12}>{hint}</Muted>}
      </View>
    </Dialog>
  );
}
