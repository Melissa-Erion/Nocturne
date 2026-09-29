/* 14. Grocery List — port of prototype/FitGrocery.dc.html */
import { useState } from 'react';
import { View } from 'react-native';
import { useRG } from '@/store/rg';
import { Btn, Card, CardTitle, Empty, H, Icon, Input, Muted, Row, Rule, Select, T, Tag, Tap, useLayout } from '@/ui/kit';
import { C, R } from '@/ui/theme';
import { Screen } from './Shell';

const CATS = ['Meat & fish', 'Dairy & eggs', 'Grains & starches', 'Produce', 'Pantry', 'Frozen', 'Other'];

interface Row_ { id: string; name: string; cat: string; buy: string; basis: string; from: string[]; manual: boolean; g: number; est: boolean }

export default function GroceryScreen() {
  const RG = useRG();
  const narrow = useLayout().width < 520;
  const [mName, setMName] = useState(''); const [mQty, setMQty] = useState(''); const [mCat, setMCat] = useState('Other');
  const S = RG.s; const list = RG.groceryList(); const ck = S.grocery.checked;
  const all: Row_[] = list.map(i => ({ ...i, manual: false }))
    .concat(S.grocery.manual.map(m => ({ id: m.id, name: m.name, cat: m.cat, buy: m.qty || '', basis: '', from: ['Added manually'], manual: true, g: 0, est: false })));
  const cats = [...new Set(all.map(i => i.cat))];
  const done = all.filter(i => ck[i.id]).length;
  const plans = S.prep.map(p => { const c = RG.prepCalc(p); return c ? `${c.name} × ${c.n}` : ''; }).filter(Boolean);
  const source = `From ${S.prep.length} meal-prep plan${S.prep.length === 1 ? '' : 's'}${plans.length ? ': ' + plans.join(', ') : ''} · updates automatically`;
  const addManual = () => {
    if (!mName.trim()) return;
    RG.update(s => { s.grocery.manual.push({ id: 'm' + RG.uid(), name: mName.trim(), qty: mQty, cat: mCat }); });
    setMName(''); setMQty('');
  };

  return (
    <Screen>
      <View style={{ gap: 16, maxWidth: 900 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <View style={{ marginRight: 'auto', flexShrink: 1 }}>
            <Muted>{source}</Muted>
            <H size={28} style={{ marginTop: 2 }}>Grocery List</H>
          </View>
          <T size={13} color={C.n400}>{`${done} of ${all.length} checked`}</T>
          <Btn title="Uncheck all" onPress={() => RG.update(s => { s.grocery.checked = {}; })} />
          <Btn icon="cooking-pot" title="Edit prep plan" onPress={() => RG.go('prep')} />
        </View>

        {list.some(i => i.est) && (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.md, boxShadow: `inset 0 0 0 1px ${C.n800}` }}>
            <Icon name="warning" size={18} color={C.accent} />
            <T size={13} color={C.n300} style={{ flex: 1 }}>
              Items marked <T size={13} w={500} color={C.n300}>est. yield</T> were converted from cooked meal portions to raw purchase weight using average cooking yields. Buy a little extra, and enter actual cooked batch weights in Meal Prep for precise containers.
            </T>
          </View>
        )}

        {!all.length && (
          <Card>
            <Empty icon="shopping-cart" title="Your grocery list is empty" body="Add a meal-prep plan and its ingredients appear here automatically, or add items manually below."
              action={<Btn icon="cooking-pot" title="Open Meal Prep" onPress={() => RG.go('prep')} />} />
          </Card>
        )}

        {cats.map(cat => (
          <Card key={cat} gap={2} pad={[12, 18]}>
            <T size={11} upper color={C.n500} style={{ letterSpacing: 0.88, paddingTop: 4, paddingBottom: 6 }}>{cat}</T>
            {all.filter(i => i.cat === cat).map(i => {
              const on = !!ck[i.id];
              return (
                <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: on ? 0.5 : 1 }}>
                  <Rule style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
                  <Tap onPress={() => RG.update(s => { s.grocery.checked[i.id] = !s.grocery.checked[i.id]; })} label={`${on ? 'Uncheck' : 'Check'} ${i.name}`}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 44 }}>
                  <View
                    style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: on ? C.accent : C.n500, backgroundColor: on ? C.accent : C.n100, alignItems: 'center', justifyContent: 'center' }}>
                    {on && <Icon name="check" size={13} color={C.bg} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T size={14} style={on ? { textDecorationLine: 'line-through' } : undefined}>
                      {i.name}{!i.manual && !!i.basis && <T size={11} color={C.n500} upper style={{ letterSpacing: 0.55 }}>{'  ' + i.basis}</T>}
                    </T>
                    <Muted size={11}>{i.from.join(' · ')}</Muted>
                    {i.est && narrow && <Tag style={{ marginTop: 4 }}>est. yield</Tag>}
                  </View>
                  {i.est && !narrow && <Tag>est. yield</Tag>}
                  <View style={{ alignItems: 'flex-end' }}>
                    <T size={14} tab>{i.buy}</T>
                    {!i.manual && <Muted size={11} tab>{`need ${RG.g(i.g)}`}</Muted>}
                  </View>
                  </Tap>
                  {i.manual && <Btn variant="ghost" iconOnly icon="x" color={C.n500} label={`Remove ${i.name}`} style={{ width: 28, height: 28 }}
                    onPress={() => RG.update(s => { s.grocery.manual = s.grocery.manual.filter(m => m.id !== i.id); delete s.grocery.checked[i.id]; })} />}
                </View>
              );
            })}
          </Card>
        ))}

        <Card gap={8} pad={[14, 18]}>
          <CardTitle size={15}>Add an item</CardTitle>
          <Row gap={8} wrap>
            <Input value={mName} onChange={setMName} placeholder="e.g. Coffee, dish soap" style={{ width: 'auto', flex: 2, minWidth: 180 }} onSubmitEditing={addManual} accessibilityLabel="Item name" />
            <Input value={mQty} onChange={setMQty} placeholder="Qty" style={{ width: 'auto', flex: 1, minWidth: 80 }} onSubmitEditing={addManual} accessibilityLabel="Quantity" />
            <Select title="Category" value={mCat} options={CATS} onChange={setMCat} style={{ width: 'auto', minWidth: 140 }} />
            <Btn variant="primary" title="Add" onPress={addManual} disabled={!mName.trim()} />
          </Row>
        </Card>
      </View>
    </Screen>
  );
}
