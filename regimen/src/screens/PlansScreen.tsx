/* 3. Workout Plans — port of prototype/FitPlans.dc.html */
import { useState, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useRG } from '@/store/rg';
import type { Plan, PlanItem, Region, Workout } from '@/domain/types';
import { Btn, Card, Check, ColLabel, Dialog, Field, H, Icon, Input, Muted, NumInput, Row, Select, T, Tag, Tap, useLayout } from '@/ui/kit';
import { alpha, C, R } from '@/ui/theme';
import { ExercisePicker } from './plans/ExercisePicker';
import { Screen } from './Shell';

const REGIONS: { value: Region; label: string }[] = [{ value: 'upper', label: 'Upper' }, { value: 'lower', label: 'Lower' }, { value: 'full', label: 'Full body' }, { value: 'core', label: 'Core / conditioning' }];
const TABLE_MIN = 1000; // below this card width the table becomes stacked per-exercise cards

/* column widths for the wide table */
const COL: Record<string, ViewStyle> = {
  n: { width: 26 }, ex: { flex: 2, minWidth: 170 }, sets: { width: 56 }, reps: { width: 116 }, target: { width: 72 }, rest: { width: 64 }, tempo: { width: 82 },
  rir: { width: 52 }, warm: { width: 60 }, ss: { width: 66 }, notes: { flex: 1, minWidth: 110 }, act: { width: 96 },
};

export default function PlansScreen() {
  const RG = useRG();
  const [planSel, setPlanSel] = useState<string | null>(null);
  const [wid, setWid] = useState<string | null>(null);
  const [confirmRm, setConfirmRm] = useState(false);
  // Exercise picker: replace the exercise in row `idx`, or add a new row.
  const [picker, setPicker] = useState<{ mode: 'replace'; idx: number } | { mode: 'add' } | null>(null);
  const [cardW, setCardW] = useState(0);
  const { wide } = useLayout();

  const S = RG.s; const wu = RG.wu();
  const planId = planSel || S.activePlanId;
  const plan = S.plans.find(p => p.id === planId) || S.plans[0];
  const wk: Workout | undefined = plan?.workouts.find(w => w.id === wid) || plan?.workouts[0];
  const isActive = !!plan && plan.id === S.activePlanId;

  /** Mutate the shown plan / workout. `sched` = the change affects the schedule → regenerate future auto-placed sessions. */
  const up = (fn: (p: Plan, w: Workout | undefined) => void, sched?: boolean) => {
    if (!plan) return;
    RG.update(s => { const p = s.plans.find(x => x.id === plan.id); if (p) fn(p, p.workouts.find(w => w.id === wk?.id)); });
    if (sched && isActive) RG.regenerate(RG.TODAY);
  };
  const upItem = (idx: number, fn: (it: PlanItem) => void) => up((_, w) => { const it = w?.items[idx]; if (it) fn(it); });


  const items = (wk?.items || []).map((it, idx) => {
    const rec = RG.recommend(it.exId, it);
    return {
      it, idx, key: it.id || String(idx),
      target: it.targetKg == null ? null : RG.w(it.targetKg), targetPh: rec && rec.kg != null ? RG.w(rec.kg) : 'auto',
      replacedNote: it.replaced && it.replaced.length ? 'Replaced ' + it.replaced.map(r => `${RG.ex(r.exId)?.name || r.exId} (${RG.fmtShort(r.date)})`).join(', ') + ' · history kept' : '',
      setEx: (v: string) => {
        if (!plan || !wk || v === it.exId) return;
        if (it.id) RG.replaceExercise(plan.id, wk.id, it.id, v);
        else upItem(idx, i2 => { i2.replaced = i2.replaced || []; i2.replaced.push({ exId: i2.exId, date: RG.TODAY }); i2.exId = v; });
        RG.toast('Exercise replaced. Original history preserved.');
      },
      num: (k: 'sets' | 'repMin' | 'repMax' | 'rest' | 'rir' | 'warmups') => (v: number | null) => upItem(idx, i2 => { i2[k] = v ?? 0; }),
      setTarget: (v: number | null) => upItem(idx, i2 => { i2.targetKg = v == null ? null : RG.r1(RG.toKg(v)); }),
      setTempo: (v: string) => upItem(idx, i2 => { i2.tempo = v; }),
      setSS: (v: string) => upItem(idx, i2 => { i2.superset = v.toUpperCase().slice(0, 2); }),
      setNotes: (v: string) => upItem(idx, i2 => { i2.notes = v; }),
      moveUp: () => up((_, w) => { if (w && idx > 0) { const t = w.items[idx - 1]; w.items[idx - 1] = w.items[idx]; w.items[idx] = t; } }),
      moveDown: () => up((_, w) => { if (w && idx < w.items.length - 1) { const t = w.items[idx + 1]; w.items[idx + 1] = w.items[idx]; w.items[idx] = t; } }),
      remove: () => up((_, w) => { w?.items.splice(idx, 1); }),
    };
  });
  type Item = (typeof items)[number];

  const activate = () => {
    if (!plan) return;
    RG.update(s => { s.activePlanId = plan.id; s.schedule = s.schedule.filter(e => !(e.status === 'planned' && e.date >= RG.TODAY)); });
    RG.regenerate(RG.TODAY);
    RG.toast(`${plan.name} is now active. Future sessions rescheduled from today; history kept.`);
  };
  const addWorkout = () => {
    const id = 'W' + RG.uid().slice(0, 3).toUpperCase();
    up(p => { p.workouts.push({ id, name: 'New workout', focus: '', muscles: [], region: 'full', items: [] }); p.rotation.push(id); }, true);
    setWid(id);
  };
  const removeWorkout = () => {
    if (!plan || !wk) return;
    RG.update(s => {
      const p = s.plans.find(x => x.id === plan.id); if (!p) return;
      p.workouts = p.workouts.filter(w => w.id !== wk.id); p.rotation = p.rotation.filter(r => r !== wk.id);
      // future planned sessions of the removed workout leave the calendar; logged/missed history stays
      s.schedule = s.schedule.filter(e => !(e.planId === plan.id && e.workoutId === wk.id && e.status === 'planned' && e.date >= RG.TODAY));
    });
    if (isActive) RG.regenerate(RG.TODAY);
    setConfirmRm(false); setWid(null);
  };
  const duplicate = () => {
    if (!plan) return;
    const c: Plan = JSON.parse(JSON.stringify(plan)); c.id = 'p' + RG.uid(); c.name = plan.name + ' (copy)';
    RG.update(s => { s.plans.push(c); }); setPlanSel(c.id); setWid(null);
  };
  const newPlan = () => {
    const id = 'p' + RG.uid();
    RG.update(s => { s.plans.push({ id, name: 'My plan', note: '', workouts: [{ id: 'A', name: 'Workout A', focus: '', muscles: [], region: 'full', items: [] }], rotation: ['A'], allowConsecutive: false }); });
    setPlanSel(id); setWid(null);
  };
  const addItem = () => setPicker({ mode: 'add' });
  const addExercise = (exId: string) => up((_, w) => { w?.items.push({ id: RG.uid(), exId, sets: 3, repMin: 8, repMax: 12, rir: 2, rest: 90, tempo: '2-0-1-0', warmups: 0, superset: '', notes: '', replaced: [] }); });

  const tab = (on: boolean): ViewStyle => ({ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 6, borderWidth: 1, borderColor: on ? C.accent : C.n800, backgroundColor: on ? alpha(C.accent, 0.14) : 'transparent', minHeight: 36, justifyContent: 'center' });
  const iconBtn = (icon: 'arrow-up' | 'arrow-down' | 'x', label: string, onPress: () => void, disabled?: boolean, color?: string) =>
    <Btn variant="ghost" iconOnly icon={icon} label={label} onPress={onPress} color={color} disabled={disabled} style={{ width: 30, height: 30, minHeight: 30 }} />;
  const actions = (i: Item) => (
    <Row gap={2}>
      {iconBtn('arrow-up', 'Move up', i.moveUp, i.idx === 0)}
      {iconBtn('arrow-down', 'Move down', i.moveDown, i.idx === items.length - 1)}
      {iconBtn('x', 'Remove', i.remove, false, C.n500)}
    </Row>
  );
  const exSelect = (i: Item) => (
    <View style={{ gap: 3 }}>
      <Tap onPress={() => setPicker({ mode: 'replace', idx: i.idx })} label={`Exercise: ${RG.ex(i.it.exId)?.name || i.it.exId}. Change`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 10, borderRadius: R.md, borderWidth: 1, borderColor: C.divider, backgroundColor: C.surface }}>
        <T size={14} numberOfLines={1} style={{ flex: 1 }}>{RG.ex(i.it.exId)?.name || i.it.exId}</T>
        <Icon name="caret-down" size={14} color={C.n500} />
      </Tap>
      {!!i.replacedNote && <Muted size={11}>{i.replacedNote}</Muted>}
    </View>
  );
  const reps = (i: Item, h?: number) => (
    <Row gap={3}>
      <NumInput value={i.it.repMin} onValue={i.num('repMin')} style={{ flex: 1 }} height={h} center accessibilityLabel="Min reps" />
      <T size={13} color={C.n500}>–</T>
      <NumInput value={i.it.repMax} onValue={i.num('repMax')} style={{ flex: 1 }} height={h} center accessibilityLabel="Max reps" />
    </Row>
  );

  const cell = (k: string, children: ReactNode) => <View key={k} style={[COL[k], { minWidth: COL[k].minWidth ?? 0 }]}>{children}</View>;
  const table = (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 8 }}>
        {[['n', '#'], ['ex', 'Exercise'], ['sets', 'Sets'], ['reps', 'Reps'], ['target', `Target ${wu}`], ['rest', 'Rest s'], ['tempo', 'Tempo'], ['rir', 'RIR'], ['warm', 'Warm-ups'], ['ss', 'Superset'], ['notes', 'Notes'], ['act', '']].map(([k, l]) =>
          cell(k, <ColLabel>{l}</ColLabel>))}
      </View>
      {items.map(i => (
        <View key={i.key} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.divider }}>
          {cell('n', <T size={14} color={C.n500} style={{ paddingTop: 7 }}>{i.idx + 1}</T>)}
          {cell('ex', exSelect(i))}
          {cell('sets', <NumInput value={i.it.sets} onValue={i.num('sets')} accessibilityLabel="Sets" />)}
          {cell('reps', reps(i))}
          {cell('target', <NumInput value={i.target} placeholder={i.targetPh} onValue={i.setTarget} accessibilityLabel={`Target ${wu}`} />)}
          {cell('rest', <NumInput value={i.it.rest} onValue={i.num('rest')} accessibilityLabel="Rest seconds" />)}
          {cell('tempo', <Input value={i.it.tempo} onChange={i.setTempo} accessibilityLabel="Tempo" />)}
          {cell('rir', <NumInput value={i.it.rir} onValue={i.num('rir')} accessibilityLabel="RIR" />)}
          {cell('warm', <NumInput value={i.it.warmups} onValue={i.num('warmups')} accessibilityLabel="Warm-up sets" />)}
          {cell('ss', <Input value={i.it.superset} onChange={i.setSS} placeholder="—" autoCapitalize="characters" accessibilityLabel="Superset" />)}
          {cell('notes', <Input value={i.it.notes} onChange={i.setNotes} placeholder="Cues" accessibilityLabel="Notes" />)}
          {cell('act', actions(i))}
        </View>
      ))}
    </View>
  );
  const small = (label: string, child: ReactNode, flex = 1) => <Field label={label} style={{ flexGrow: flex, flexBasis: 90, minWidth: 80 }}>{child}</Field>;
  const cards = (
    <View style={{ gap: 10 }}>
      {items.map(i => (
        <View key={i.key} style={{ gap: 10, padding: 12, borderRadius: R.md, backgroundColor: alpha(C.text, 0.03), boxShadow: `inset 0 0 0 1px ${C.n800}` }}>
          <Row gap={8}>
            <T size={13} color={C.n500} style={{ width: 20 }}>{i.idx + 1}</T>
            <View style={{ flex: 1 }} />
            {actions(i)}
          </Row>
          <Field label="Exercise">{exSelect(i)}</Field>
          <Row gap={8} wrap align="flex-start">
            {small('Sets', <NumInput value={i.it.sets} onValue={i.num('sets')} height={44} />)}
            {small('Reps', reps(i, 44), 2)}
            {small(`Target ${wu}`, <NumInput value={i.target} placeholder={i.targetPh} onValue={i.setTarget} height={44} />)}
            {small('Rest s', <NumInput value={i.it.rest} onValue={i.num('rest')} height={44} />)}
            {small('Tempo', <Input value={i.it.tempo} onChange={i.setTempo} height={44} />)}
            {small('RIR', <NumInput value={i.it.rir} onValue={i.num('rir')} height={44} />)}
            {small('Warm-ups', <NumInput value={i.it.warmups} onValue={i.num('warmups')} height={44} />)}
            {small('Superset', <Input value={i.it.superset} onChange={i.setSS} placeholder="—" autoCapitalize="characters" height={44} />)}
          </Row>
          <Field label="Notes"><Input value={i.it.notes} onChange={i.setNotes} placeholder="Cues" height={44} /></Field>
        </View>
      ))}
    </View>
  );

  if (!plan) {
    return (
      <Screen>
        <View style={{ marginRight: 'auto' }}><Muted>You build the plan. Regimen schedules it and tracks progress.</Muted><H size={28} style={{ marginTop: 2 }}>Workout Plans</H></View>
        <Row><Btn icon="plus" title="New plan" onPress={newPlan} /></Row>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ marginRight: 'auto' }}>
          <Muted>You build the plan. Regimen schedules it and tracks progress.</Muted>
          <H size={28} style={{ marginTop: 2 }}>Workout Plans</H>
        </View>
        <Btn icon="copy" title="Duplicate plan" onPress={duplicate} />
        <Btn icon="plus" title="New plan" onPress={newPlan} />
      </View>

      {/* plan selector */}
      <Row gap={8} wrap align="stretch">
        {S.plans.map(p => {
          const on = p.id === plan.id;
          return (
            <Tap key={p.id} onPress={() => { setPlanSel(p.id); setWid(null); }} label={p.name}
              style={{ gap: 3, alignItems: 'flex-start', paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.md, maxWidth: '100%',
                backgroundColor: on ? C.surface : 'transparent', borderWidth: 1, borderColor: on ? C.a700 : C.n800 }}>
              <Row gap={8}><T size={14} w={500}>{p.name}</T>{p.id === S.activePlanId && <Tag variant="accent">Active</Tag>}</Row>
              <Muted>{`${p.workouts.length} workouts · ${p.rotation.join(' → ')}`}</Muted>
            </Tap>
          );
        })}
      </Row>

      <Card gap={12}>
        <Row gap={10} wrap>
          <Input value={plan.name} onChange={v => up(p => { p.name = v; })} size={18} height={40} style={{ maxWidth: 360, flexBasis: 240, flexGrow: 1 }} accessibilityLabel="Plan name" />
          <View style={{ flex: 1 }} />
          <Check checked={!!plan.allowConsecutive} onChange={() => up(p => { p.allowConsecutive = !p.allowConsecutive; }, true)} label={<T size={13} color={C.n300} style={{ flexShrink: 1 }}>Allow same muscle group on consecutive days</T>} />
          {!isActive && <Btn variant="primary" title="Use this plan" onPress={activate} />}
        </Row>
        <Input multiline value={plan.note || ''} onChange={v => up(p => { p.note = v; })} placeholder="Plan notes and progression rules" size={13} style={{ minHeight: wide ? 52 : 90 }} accessibilityLabel="Plan notes" />
        <View style={{ gap: 6 }}>
          <ColLabel style={{ fontSize: 11 }}>Rotation order</ColLabel>
          <Row gap={6} wrap>
            {plan.rotation.map((id, i) => (
              <View key={id + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingLeft: 10, paddingRight: 4, borderRadius: 6, backgroundColor: C.n900 }}>
                <T size={12}>{plan.workouts.find(w => w.id === id)?.name || id}</T>
                <Btn variant="ghost" iconOnly icon="caret-left" label="Earlier" disabled={i === 0} style={{ width: 28, height: 28, minHeight: 28 }}
                  onPress={() => up(p => { const r = p.rotation; if (i > 0) [r[i - 1], r[i]] = [r[i], r[i - 1]]; }, true)} />
                <Btn variant="ghost" iconOnly icon="caret-right" label="Later" disabled={i === plan.rotation.length - 1} style={{ width: 28, height: 28, minHeight: 28 }}
                  onPress={() => up(p => { const r = p.rotation; if (i < r.length - 1) [r[i + 1], r[i]] = [r[i], r[i + 1]]; }, true)} />
              </View>
            ))}
          </Row>
        </View>
      </Card>

      {/* workout tabs */}
      <Row gap={6} wrap>
        {plan.workouts.map(w => (
          <Tap key={w.id} onPress={() => setWid(w.id)} label={w.name} style={tab(w.id === wk?.id)}>
            <T size={13} color={w.id === wk?.id ? C.accent : C.n300}>{w.name}</T>
          </Tap>
        ))}
        <Btn variant="ghost" icon="plus" title="Add workout" onPress={addWorkout} />
      </Row>

      {wk && (
        <Card gap={12}>
          <View onLayout={e => setCardW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Field label="Workout name" style={{ flexGrow: 1, flexBasis: 200 }}><Input value={wk.name} onChange={v => up((_, w) => { if (w) w.name = v; })} /></Field>
            <Field label="Focus / muscle groups" style={{ flexGrow: 1, flexBasis: 200 }}><Input value={wk.focus} onChange={v => up((_, w) => { if (w) w.focus = v; })} /></Field>
            <Field label="Region (for recovery rules)" style={{ minWidth: 200 }}>
              <Select value={wk.region} options={REGIONS} onChange={v => up((_, w) => { if (w) w.region = v; }, true)} title="Region" />
            </Field>
            <Btn variant="ghost" icon="trash" title="Remove workout" color={C.n400} disabled={plan.workouts.length <= 1} onPress={() => setConfirmRm(true)} />
          </View>
          {items.length ? (cardW >= TABLE_MIN ? table : cards) : <Muted size={13}>No exercises yet. Add one to build this workout.</Muted>}
          <Row gap={8} wrap>
            <Btn icon="plus" title="Add exercise" onPress={addItem} />
            <Muted style={{ flexShrink: 1 }}>Changing an exercise replaces it going forward. Past sessions and records for the original stay in Exercise History.</Muted>
          </Row>
        </Card>
      )}

      <Dialog open={confirmRm} onClose={() => setConfirmRm(false)} title={`Remove ${wk?.name || 'workout'}?`}
        body="It is removed from this plan and its rotation. Logged sessions stay in your history."
        actions={<><Btn title="Cancel" onPress={() => setConfirmRm(false)} /><Btn variant="primary" icon="trash" title="Remove workout" onPress={removeWorkout} /></>} />
      <ExercisePicker open={!!picker} onClose={() => setPicker(null)}
        title={picker?.mode === 'add' ? 'Add an exercise' : 'Change exercise'}
        currentId={picker?.mode === 'replace' ? items[picker.idx]?.it.exId : undefined}
        onPick={id => { if (picker?.mode === 'replace') items[picker.idx]?.setEx(id); else addExercise(id); }} />
    </Screen>
  );
}
