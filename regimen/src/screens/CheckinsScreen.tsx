/* 7. Progress Check-Ins — port of prototype/FitCheckins.dc.html */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Checkin } from '@/domain/types';
import { useRG } from '@/store/rg';
import { Btn, Card, CardTitle, Check, Dialog, Field, Grid, H, Icon, Input, Muted, NumInput, Row, Seg, T } from '@/ui/kit';
import { alpha, C, SHADOW } from '@/ui/theme';
import { Screen } from './Shell';

type MeasKey = 'waist' | 'hips' | 'chest' | 'thighs' | 'arms';
type RatKey = 'energy' | 'sleep' | 'hunger' | 'stress' | 'recovery';
const MEAS: [MeasKey, string][] = [['waist', 'Waist'], ['hips', 'Hips'], ['chest', 'Chest'], ['thighs', 'Thighs'], ['arms', 'Arms']];
const RAT: [RatKey, string, string[]][] = [
  ['energy', 'Energy', ['Very low', 'Low', 'OK', 'Good', 'High']], ['sleep', 'Sleep quality', ['Poor', 'Fair', 'OK', 'Good', 'Great']],
  ['hunger', 'Hunger', ['None', 'Low', 'Moderate', 'High', 'Very high']], ['stress', 'Stress', ['None', 'Low', 'Moderate', 'High', 'Very high']],
  ['recovery', 'Recovery', ['Poor', 'Fair', 'OK', 'Good', 'Great']],
];
const POSES = ['front', 'side', 'back'] as const;

/** Form values are in display units (kg/lb, cm/in). */
type Form = { id: string | null; date: string; kg: number | null; cycle: string; strength: string; notes: string; custom: { name: string; value: number | null }[] }
  & Record<MeasKey, number | null> & Record<RatKey, number>;

export default function CheckinsScreen() {
  const RG = useRG();
  const [F, setForm] = useState<Form | null>(null);
  const [delId, setDel] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const S = RG.s, P = S.profile, wu = RG.wu(), lu = RG.lu();
  const cis = S.checkins.slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const setF = (patch: Partial<Form>) => setForm(f => f && { ...f, ...patch });
  const disp = (v: string) => v === '—' ? null : Number(v);

  const blank = (): Form => {
    const last = cis[cis.length - 1]; const avg = RG.avgWeight();
    return { id: null, date: RG.TODAY, kg: disp(RG.bw(avg)), cycle: '', strength: '', notes: '', custom: (last?.custom || []).map(c => ({ name: c.name, value: null })),
      waist: null, hips: null, chest: null, thighs: null, arms: null, energy: 3, sleep: 3, hunger: 3, stress: 3, recovery: 3 };
  };
  const fromCi = (c: Checkin): Form => ({
    id: c.id, date: c.date, kg: disp(RG.bw(c.kg)), cycle: c.cycle, strength: c.strength, notes: c.notes, custom: (c.custom || []).map(x => ({ name: x.name, value: disp(RG.len(x.value)) })),
    waist: disp(RG.len(c.waist)), hips: disp(RG.len(c.hips)), chest: disp(RG.len(c.chest)), thighs: disp(RG.len(c.thighs)), arms: disp(RG.len(c.arms)),
    energy: c.energy, sleep: c.sleep, hunger: c.hunger, stress: c.stress, recovery: c.recovery,
  });

  const first = cis[0], last = cis[cis.length - 1];
  const d = (a: number | null | undefined, b: number | null | undefined, fmt: (v: number) => string) => { if (a == null || b == null) return ''; const x = b - a; return (x < 0 ? '−' : '+') + fmt(Math.abs(x)); };
  const deltas = first && last && first !== last
    ? ([['Weight', 'kg', wu, (v: number | null) => RG.bw(v)]] as [string, keyof Checkin, string, (v: number | null) => string][])
      .concat(MEAS.map(([k, l]) => [l, k, lu, (v: number | null) => RG.len(v)]))
      .map(([label, k, unit, fmt]) => { const a = first[k] as number | null, b = last[k] as number | null; const dd = d(a, b, fmt); return { label, unit, now: fmt(b), delta: dd ? dd + ' ' + unit : '—' }; })
    : [];

  const save = () => {
    const f = F; if (!f) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || isNaN(Date.parse(f.date))) return RG.toast('Enter the date as YYYY-MM-DD.');
    const kg = f.kg != null ? RG.r1(RG.toKg(f.kg)) : null;
    const rec = {
      date: f.date, kg, cycle: f.cycle, strength: f.strength, notes: f.notes,
      custom: f.custom.filter(c => c.name.trim() && c.value != null).map(c => ({ name: c.name.trim(), value: RG.r1(RG.toCm(c.value as number)) })),
      waist: null as number | null, hips: null as number | null, chest: null as number | null, thighs: null as number | null, arms: null as number | null,
      energy: f.energy, sleep: f.sleep, hunger: f.hunger, stress: f.stress, recovery: f.recovery,
    };
    MEAS.forEach(([k]) => { const v = f[k]; rec[k] = v != null ? RG.r1(RG.toCm(v)) : null; });
    const today = RG.TODAY;
    RG.update(s => {
      const ex = f.id ? s.checkins.find(c => c.id === f.id) : null;
      if (ex) Object.assign(ex, rec);
      else s.checkins.push({ id: RG.uid(), photos: { front: null, side: null, back: null, custom: [] }, ...rec });
      if (kg && rec.date === today) {
        const w = s.weights.find(x => x.date === today);
        if (w) w.kg = kg; else { s.weights.push({ date: today, kg }); s.weights.sort((a, b) => a.date < b.date ? -1 : 1); }
      }
    });
    setForm(null); RG.toast('Check-in saved.');
  };

  const del = delId ? S.checkins.find(c => c.id === delId) : null;
  const doDelete = () => {
    if (!del) return; const id = del.id;
    POSES.forEach(p => { if (RG.hasPhoto(id + ':' + p)) void RG.setPhoto(id + ':' + p, null); });
    RG.update(s => { s.checkins = s.checkins.filter(c => c.id !== id); });
    setDel(null); RG.toast('Check-in deleted.');
  };
  const closeDlg = () => { setDel(null); setOk(false); };

  const list = cis.slice().reverse().map((c, i, arr) => {
    const prev = arr[i + 1];
    const pc = POSES.filter(p => RG.hasPhoto(c.id + ':' + p)).length + (c.photos?.custom || []).length;
    const meas = MEAS.filter(([k]) => c[k] != null).map(([k, l]) => `${l} ${RG.len(c[k])}`).concat((c.custom || []).map(x => `${x.name} ${RG.len(x.value)}`));
    return {
      c, date: RG.fmtD(c.date), kg: RG.bw(c.kg), dkg: prev ? (d(prev.kg, c.kg, v => RG.bw(v)) ? d(prev.kg, c.kg, v => RG.bw(v)) + ' ' + wu : '') : 'Baseline',
      photoCount: pc ? pc + ' photo' + (pc > 1 ? 's' : '') : 'No photos',
      meas: meas.length ? meas.join(' · ') + ' ' + lu : '',
      ratings: RAT.map(([k, l, w]) => `${l}: ${w[(c[k] || 3) - 1]}`).join(' · '),
      notes: [c.strength && 'Strength: ' + c.strength, c.cycle && 'Cycle: ' + c.cycle, c.notes].filter(Boolean).join(' · '),
    };
  });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ marginRight: 'auto' }}>
          <Row gap={4}><Icon name="lock-simple" size={12} color={C.n500} /><Muted>{`Private · ${P.checkInFreq} on ${RG.DFULL[P.checkInDay] ?? ''} · next ${RG.fmtD(RG.nextCheckIn())}`}</Muted></Row>
          <H size={28} style={{ marginTop: 2 }}>Progress Check-Ins</H>
        </View>
        <Seg value={P.checkInFreq} options={['Weekly', 'Biweekly', 'Monthly']} onChange={l => RG.update(s => { s.profile.checkInFreq = l; })} />
        <Btn variant="primary" icon="plus" title="New check-in" onPress={() => setForm(blank())} />
      </View>

      {F && (
        <Card gap={14} pad={[18, 20]} style={{ boxShadow: SHADOW.md }}>
          <Row gap={10}>
            <CardTitle style={{ flex: 1 }}>{F.id ? 'Edit check-in' : 'New check-in'}</CardTitle>
            <Btn variant="ghost" iconOnly icon="x" color={C.text} label="Close" onPress={() => setForm(null)} />
          </Row>
          <Grid min={140} gap={10}>
            <Field label="Date"><Input value={F.date} onChange={v => setF({ date: v })} placeholder="YYYY-MM-DD" maxLength={10} /></Field>
            <Field label={`Body weight (${wu})`}><NumInput value={F.kg} onValue={v => setF({ kg: v })} /></Field>
            {MEAS.map(([k, l]) => <Field key={k} label={`${l} (${lu})`}><NumInput value={F[k]} onValue={v => setF({ [k]: v } as Partial<Form>)} /></Field>)}
            {F.custom.map((c, i) => (
              <View key={'c' + i} style={{ gap: 5, minWidth: 0 }}>
                <Input value={c.name} placeholder="Name" accessibilityLabel="Custom measurement name" size={12} height={18}
                  onChange={v => setF({ custom: F.custom.map((x, j) => j === i ? { ...x, name: v } : x) })}
                  style={{ borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0, backgroundColor: 'transparent', color: alpha(C.text, 0.7) }} />
                <NumInput value={c.value} onValue={v => setF({ custom: F.custom.map((x, j) => j === i ? { ...x, value: v } : x) })} />
              </View>
            ))}
          </Grid>
          <Row style={{ marginTop: -6 }}>
            <Btn variant="ghost" icon="plus" title="Custom measurement" onPress={() => setF({ custom: F.custom.concat([{ name: 'Calf', value: null }]) })} />
          </Row>
          <Grid min={180} gap={12}>
            {RAT.map(([k, l, words]) => (
              <View key={k} style={{ gap: 6 }}>
                <Row gap={4}><T size={12} color={C.n400} style={{ flex: 1 }}>{l}</T><T size={12}>{words[(F[k] || 3) - 1]}</T></Row>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[1, 2, 3, 4, 5].map(n => {
                    const on = F[k] === n;
                    return (
                      <Pressable key={n} onPress={() => setF({ [k]: n } as Partial<Form>)} accessibilityRole="button" accessibilityLabel={`${l} ${n} of 5, ${words[n - 1]}`} accessibilityState={{ selected: on }} hitSlop={{ top: 4, bottom: 4 }}
                        style={{ flex: 1, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: on ? C.accent : C.n800, backgroundColor: on ? alpha(C.accent, 0.16) : 'transparent' }}>
                        <T size={13} color={on ? C.accent : C.n400}>{n}</T>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </Grid>
          <Grid min={240} gap={10}>
            {P.sex === 'Female' && <Field label="Menstrual-cycle notes"><Input value={F.cycle} onChange={v => setF({ cycle: v })} placeholder="Phase, symptoms, water retention" /></Field>}
            <Field label="Strength progress"><Input value={F.strength} onChange={v => setF({ strength: v })} placeholder="What moved, what stalled" /></Field>
          </Grid>
          <Field label="Notes"><Input multiline value={F.notes} onChange={v => setF({ notes: v })} placeholder="Anything worth remembering this week" /></Field>
          <Row gap={8} wrap>
            <Muted style={{ flex: 1, minWidth: 200 }}>Photos for this check-in can be added on the Progress Photos page.</Muted>
            <Btn title="Cancel" onPress={() => setForm(null)} />
            <Btn variant="primary" title="Save check-in" onPress={save} />
          </Row>
        </Card>
      )}

      {deltas.length > 0 && first && last && (
        <Card gap={10}>
          <Row gap={10} wrap style={{ alignItems: 'baseline' }}>
            <CardTitle style={{ flexGrow: 1 }}>Since your first check-in</CardTitle>
            <Muted>{`${RG.fmtD(first.date)} → ${RG.fmtD(last.date)} · ${cis.length} check-ins`}</Muted>
          </Row>
          <Grid min={130} gap={10}>
            {deltas.map(x => (
              <View key={x.label}>
                <Muted size={11}>{x.label}</Muted>
                <T size={20} tab lh={1.3}>{x.now} <T size={12} color={C.n500}>{x.unit}</T></T>
                <T size={12} color={C.a300} tab>{x.delta}</T>
              </View>
            ))}
          </Grid>
        </Card>
      )}

      {list.length === 0 && !F && (
        <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 28 }}>
          <Icon name="clipboard-text" size={26} color={C.n600} />
          <T size={15} w={500} center>No check-ins yet</T>
          <Muted size={13} style={{ textAlign: 'center', maxWidth: 420 }}>Record your weight, measurements and how the week felt. Your first check-in becomes the baseline for every comparison.</Muted>
          <Btn variant="primary" icon="plus" title="New check-in" onPress={() => setForm(blank())} />
        </Card>
      )}

      <View style={{ gap: 10 }}>
        {list.map(x => (
          <Card key={x.c.id} gap={8} pad={[14, 18]}>
            <Row gap={10} wrap>
              <T size={16} w={500}>{x.date}</T>
              <T size={13} color={C.n400} tab>{x.kg} {wu}</T>
              <T size={12} color={C.a300} tab>{x.dkg}</T>
              <View style={{ flex: 1 }} />
              <Row gap={4}><Icon name="camera" size={13} color={C.n500} /><Muted>{x.photoCount}</Muted></Row>
              <Btn variant="ghost" size="sm" title="Edit" onPress={() => setForm(fromCi(x.c))} />
              <Btn variant="ghost" size="sm" icon="trash" color={C.n500} label={`Delete ${x.date} check-in`} onPress={() => { setOk(false); setDel(x.c.id); }} />
            </Row>
            {!!x.meas && <T size={12} color={C.n400} tab>{x.meas}</T>}
            <Muted>{x.ratings}</Muted>
            {!!x.notes && <T size={13} color={C.n300}>{x.notes}</T>}
          </Card>
        ))}
      </View>

      <Dialog open={!!del} onClose={closeDlg} title="Permanently delete check-in?"
        body={`The ${del ? RG.fmtD(del.date) : ''} check-in, its measurements and any attached photos will be deleted from this device. This cannot be undone.`}
        actions={<><Btn title="Cancel" onPress={closeDlg} /><Btn variant="primary" title="Delete" disabled={!ok} onPress={() => { doDelete(); setOk(false); }} /></>}>
        <Check checked={ok} onChange={setOk} label="I understand this is permanent" />
      </Dialog>
    </Screen>
  );
}
