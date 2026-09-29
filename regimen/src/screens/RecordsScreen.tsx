/* 6. Personal Records — port of prototype/FitRecords.dc.html */
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { View } from 'react-native';
import { useRG } from '@/store/rg';
import { Btn, Card, Empty, Icon, Muted, NotMedical, PageHeader, Row, Seg, T } from '@/ui/kit';
import { C, R, SHADOW } from '@/ui/theme';
import { FillGrid, Table } from './history/Table';
import { Screen } from './Shell';

type Filter = 'All' | 'Upper' | 'Lower';

export default function RecordsScreen() {
  const RG = useRG();
  const [f, setF] = useState<Filter>('All');
  const S = RG.s, wu = RG.wu(), T0 = RG.TODAY, volK = RG.imp() ? 2.20462 : 1;

  const ids = [...new Set(S.sessions.flatMap(s => s.sets.filter(x => !x.warm).map(x => x.exId)))];
  const list = ids.map(id => ({ id, e: RG.ex(id), p: RG.prs(id) }))
    .flatMap(x => (x.e && x.p && (f === 'All' || x.e.region === f.toLowerCase()) ? [{ id: x.id, e: x.e, p: x.p }] : []))
    .sort((a, b) => b.p.e1.v - a.p.e1.v);

  const lim = RG.add(T0, -14);
  const recent: { kind: string; name: string; value: string; date: string; d: string }[] = [];
  list.forEach(({ e, p }) => {
    const firstSes = RG.history(e.id)[0]; if (firstSes && firstSes.date >= lim) return; // a first-ever session isn't a "record"
    if (p.heavy.date >= lim) recent.push({ kind: 'Heaviest', name: e.name, value: `${RG.w(p.heavy.kg)} ${wu} × ${p.heavy.reps}`, date: RG.fmtShort(p.heavy.date), d: p.heavy.date });
    else if (p.e1.date >= lim) recent.push({ kind: 'Est. 1RM', name: e.name, value: `${RG.w(p.e1.v)} ${wu}`, date: RG.fmtShort(p.e1.date), d: p.e1.date });
  });
  recent.sort((a, b) => (a.d < b.d ? 1 : -1));

  const sub = (t: string) => <T size={11} color={C.n500} tab>{t}</T>;

  return (
    <Screen>
      <PageHeader kicker="Working sets only · warm-ups excluded · e1RM uses the Epley estimate" title="Personal Records"
        right={<Seg value={f} onChange={setF} options={['All', 'Upper', 'Lower']} />} />

      <View style={{ gap: 8 }}>
        <T size={11} color={C.n500} upper style={{ letterSpacing: 0.88 }}>Set in the last 14 days</T>
        {recent.length ? (
          <FillGrid min={230} gap={10}>
            {recent.slice(0, 8).map(r => (
              <View key={r.name + r.kind} style={{ flexGrow: 1, borderRadius: R.md, boxShadow: SHADOW.sm, overflow: 'hidden', backgroundColor: C.surface }}>
                <LinearGradient colors={[C.a900, C.surface]} locations={[0, 0.7]} start={{ x: 0.25, y: 0 }} end={{ x: 0.75, y: 1 }} style={{ flexGrow: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 4 }}>
                  <Row gap={6}><Icon name="trophy" fill size={11} color={C.a300} /><T size={11} color={C.a300}>{`${r.kind} · ${r.date}`}</T></Row>
                  <T size={15}>{r.name}</T>
                  <T size={20} tab lh={1.3}>{r.value}</T>
                </LinearGradient>
              </View>
            ))}
          </FillGrid>
        ) : (
          <Muted size={13}>No new records in the last two weeks. Plateaus are normal; the trend matters more than any single session.</Muted>
        )}
      </View>

      <Card pad={[12, 18]} gap={8}>
        {list.length ? (
          <Table minWidth={820}
            cols={[{ label: 'Exercise', flex: 1.5 }, { label: 'Heaviest weight', flex: 1 }, { label: 'Est. 1RM', flex: 0.9 }, { label: 'Highest session volume', flex: 1.2 }, { label: 'Best working-set performance', flex: 1.6 }, { label: 'Most reps at weight', flex: 1.1 }]}
            rows={list.map(({ id, e, p }) => ({
              key: id, label: `${e.name} history`, onPress: () => RG.go('history', 'ex:' + id),
              cells: [
                <View key="n"><T size={14}>{e.name}</T>{sub(`${e.muscle} · ${e.equip}`)}</View>,
                <View key="h"><T size={14} tab>{`${RG.w(p.heavy.kg)} ${wu} × ${p.heavy.reps}`}</T>{sub(RG.fmtShort(p.heavy.date))}</View>,
                <View key="e"><T size={14} tab>{`${RG.w(p.e1.v)} ${wu}`}</T>{sub(`${RG.w(p.e1.kg)} × ${p.e1.reps} · ${RG.fmtShort(p.e1.date)}`)}</View>,
                <View key="v"><T size={14} tab>{`${RG.num(p.vol.v * volK)} ${wu}`}</T>{sub(RG.fmtShort(p.vol.date))}</View>,
                <View key="b"><T size={14} tab>{`${RG.w(p.best.kg)} ${wu} × ${p.best.reps.join(', ')}`}</T>{sub(RG.fmtShort(p.best.date))}</View>,
                <T key="r" size={12} color={C.n300} tab>{Object.entries(p.repsAt).sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, 3).map(([kg, r]) => `${RG.w(Number(kg))}: ${r.reps}`).join(' · ')}</T>,
              ],
            }))} />
        ) : (
          <Empty icon="trophy" title={S.sessions.length ? `No ${f.toLowerCase()}-body records yet` : 'No records yet'}
            body="Records are computed from completed working sets. Finish a workout to set your first ones."
            action={!S.sessions.length ? <Btn variant="primary" icon="barbell" title="Go to Active Workout" onPress={() => RG.go('workout')} /> : undefined} />
        )}
      </Card>
      <NotMedical text="Estimated 1RM is a calculation, not a tested max — not medical advice." />
    </Screen>
  );
}
