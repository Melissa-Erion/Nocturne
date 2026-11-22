/* Grocery list: built from the next few days of the meal plan (plus recipe prep plans and items you add).
   Any item can be removed; removed items stay off until restored. */
import { useState } from 'react';
import { View } from 'react-native';
import { useRG } from '@/store/rg';
import { Btn, Card, CardTitle, Empty, H, Icon, Input, Muted, Row, Rule, Seg, Select, T, Tag, Tap, useLayout } from '@/ui/kit';
import { C, R } from '@/ui/theme';
import { Screen } from './Shell';

const CATS = ['Meat & fish', 'Dairy & eggs', 'Grains & starches', 'Produce', 'Pantry', 'Frozen', 'Other'];

interface Row_ { id: string; name: string; cat: string; buy: string; basis: string; from: string[]; manual: boolean; g: number; est: boolean }

export default function GroceryScreen() {
  const RG = useRG();
  const narrow = useLayout().width < 520;
  const [mName, setMName] = useState(''); const [mQty, setMQty] = useState(''); const [mCat, setMCat] = useState('Other');
  const [showRemoved, setShowRemoved] = useState(false);
  const S = RG.s; const days = S.profile.shopDays || 7; const list = RG.shoppingList(days); const ck = S.grocery.checked;
  const removedIds = Object.keys(S.grocery.removed || {}).filter(id => S.grocery.removed![id]);
  const all: Row_[] = list.map(i => ({ ...i, manual: false }))
    .concat(S.grocery.manual.map(m => ({ id: m.id, name: m.name, cat: m.cat, buy: m.qty || '', basis: '', from: ['Added manually'], manual: true, g: 0, est: false })));
  const cats = [...new Set(all.map(i => i.cat))];
  const done = all.filter(i => ck[i.id]).length;
  const source = `Everything in your meals for the next ${days} days${S.prep.length ? ', plus your recipe batches' : ''}. Updates automatically when your meals change.`;
  const remove = (i: Row_) => RG.update(s => {
    if (i.manual) s.grocery.manual = s.grocery.manual.filter(m => m.id !== i.id);
    else { s.grocery.removed = { ...(s.grocery.removed || {}), [i.id]: true }; }
    delete s.grocery.checked[i.id];
  });
  const addManual = () => {
    if (!mName.trim()) return;
    RG.update(s => { s.grocery.manual.push({ id: 'm' + RG.uid(), name: mName.trim(), qty: mQty, cat: mCat }); });
    setMName(''); setMQty('');
  };

  return (
    <Screen>
      <View style={{ gap: 16, maxWidth: 900 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <View style={{ marginRight: 'auto', flexShrink: 1, gap: 2 }}>
            <H size={28}>Grocery list</H>
            <Muted size={13}>{source}</Muted>
          </View>
        </View>
        <Row gap={10} wrap>
          <T size={14} w={500}>Shopping for</T>
          <Seg<number> value={days} onChange={v => RG.update(s => { s.profile.shopDays = v; })} options={[{ value: 3, label: '3 days' }, { value: 5, label: '5 days' }, { value: 7, label: '7 days' }]} />
          <View style={{ flex: 1 }} />
          <T size={13} color={C.n400}>{`${done} of ${all.length} checked`}</T>
          <Btn variant="ghost" title="Uncheck all" onPress={() => RG.update(s => { s.grocery.checked = {}; })} />
        </Row>

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
            <Empty icon="shopping-cart" title="Your grocery list is empty" body="Plan your meals and everything in them appears here automatically. You can also add items below."
              action={<Btn icon="fork-knife" title="Plan my meals" onPress={() => RG.go('meals')} />} />
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
                  <Btn variant="ghost" iconOnly icon="x" color={C.n500} label={`Remove ${i.name}`} style={{ width: 36, height: 36 }} onPress={() => remove(i)} />
                </View>
              );
            })}
          </Card>
        ))}

        {!!removedIds.length && (
          <View style={{ gap: 6 }}>
            <Row><Btn variant="ghost" icon={showRemoved ? 'caret-down' : 'caret-right'} title={`${showRemoved ? 'Hide' : 'Show'} removed items (${removedIds.length})`} onPress={() => setShowRemoved(v => !v)} /></Row>
            {showRemoved && (
              <Card gap={2} pad={[8, 18]}>
                <Muted size={12} style={{ paddingVertical: 6 }}>Removed items stay off your list (for example, things you already have) until you put them back.</Muted>
                {removedIds.map(id => (
                  <Row key={id} gap={8} style={{ minHeight: 40 }}>
                    <T size={14} style={{ flex: 1 }} color={C.n400}>{RG.food(id)?.name || id}</T>
                    <Btn variant="ghost" size="sm" icon="arrow-counter-clockwise" title="Put back" label={`Put back ${RG.food(id)?.name || id}`}
                      onPress={() => RG.update(s => { if (s.grocery.removed) delete s.grocery.removed[id]; })} />
                  </Row>
                ))}
              </Card>
            )}
          </View>
        )}

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
