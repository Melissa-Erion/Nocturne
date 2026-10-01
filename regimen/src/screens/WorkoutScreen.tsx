/* 4. Active Workout — port of prototype/FitWorkout.dc.html.
   Timers are computed from timestamps (active.startedAt / active.restEnd), so they stay correct after backgrounding. */
import { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, Vibration, View, type PressableStateCallbackType } from 'react-native';
import type { ActiveWorkout, PlanItem, Workout } from '@/domain/types';
import { useRG } from '@/store/rg';
import {
  Bar, Btn, Card, CardTitle, Check, ColLabel, Dialog, Grid, H, Icon, Input, Kicker, Muted, NotMedical, Num, NumInput, PageHeader, Row, RuledRow,
  Spacer, Stripes, T, Tag, Tap, useLayout,
} from '@/ui/kit';
import { alpha, C, R, SHADOW } from '@/ui/theme';
import { Screen } from './Shell';

type PState = PressableStateCallbackType & { hovered?: boolean };
const FEELS = ['Good', 'Discomfort', 'Pain', 'Poor form'];
const fmtT = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const blankItem = (exId: string): PlanItem => ({ id: '', exId, sets: 3, repMin: 8, repMax: 12, rir: 2, rest: 90, tempo: '', warmups: 0, superset: '', notes: '', replaced: [] });
// set-row column widths (prototype grid: 40px 1fr 1fr 64px 52px 30px, gap 6)
const COL = { label: 40, rir: 64, done: 52, rm: 30 };

/** Re-render twice a second while a session runs, and immediately when the app returns to the foreground. */
function useClock(on: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    const iv = setInterval(() => set(Date.now()), 500);
    const sub = AppState.addEventListener('change', st => { if (st === 'active') set(Date.now()); });
    return () => { clearInterval(iv); sub.remove(); };
  }, [on]);
}

export default function WorkoutScreen() {
  const RG = useRG();
  const S = RG.s, A = S.active;
  useClock(!!A);
  const restMs = A?.restEnd ? A.restEnd - (A.pausedAt ?? Date.now()) : 0;
  // rest finished: clear it and buzz (once — the guard re-checks the live state). Never while paused: the rest timer is frozen.
  useEffect(() => {
    if (A?.restEnd && !A.pausedAt && restMs <= 0) {
      const a = RG.s.active;
      if (a && a.restEnd && !a.pausedAt && a.restEnd <= Date.now()) { RG.update(s => { if (s.active) s.active.restEnd = null; }); try { Vibration.vibrate(200); } catch { /* not supported */ } }
    }
  });
  return A ? <Running A={A} /> : <Idle />;
}

function Idle() {
  const RG = useRG();
  const S = RG.s, T0 = RG.TODAY;
  const list = S.schedule.filter(e => e.status === 'planned' && e.date >= T0).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 4)
    .flatMap(e => { const w = RG.workout(e.workoutId, e.planId); return w ? [{ e, w }] : []; });
  return (
    <Screen>
      <View style={{ gap: 14, maxWidth: 920, width: '100%' }}>
        <PageHeader kicker="No session running" title="Active Workout" />
        <Card gap={8}>
          <CardTitle>Start a session</CardTitle>
          {list.map(({ e, w }) => (
            <RuledRow key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={15}>{w.name}</T>
                <Muted>{`${e.date === T0 ? 'Today' : RG.fmtD(e.date)} · ${w.items.length} exercises · ${w.focus}`}</Muted>
              </View>
              <Btn variant="primary" icon="play" iconFill title="Start" onPress={() => RG.startWorkout(e.id)} />
            </RuledRow>
          ))}
          {!list.length && (
            <RuledRow style={{ paddingVertical: 12, gap: 8 }}>
              <Muted size={13}>{RG.activePause() ? 'Your schedule is paused — resume it to plan the next workout.' : 'No planned workouts coming up. Set up a plan and your training days to fill the schedule.'}</Muted>
              <Row gap={6} wrap><Btn icon="list-checks" title="Workout plans" onPress={() => RG.go('plans')} /><Btn icon="calendar-blank" title="My schedule" onPress={() => RG.go('schedule')} /></Row>
            </RuledRow>
          )}
        </Card>
      </View>
    </Screen>
  );
}

function Running({ A }: { A: ActiveWorkout }) {
  const RG = useRG();
  const [info, setInfo] = useState<Record<string, boolean>>({});
  const [sub, setSub] = useState<Record<string, boolean>>({});
  const [subPerm, setSubPerm] = useState<Record<string, boolean>>({});
  const [dlg, setDlg] = useState<null | 'finish' | 'discard'>(null);
  const { wide } = useLayout();

  const S = RG.s, wu = RG.wu(), T0 = RG.TODAY;
  const w: Workout = RG.workout(A.workoutId, A.planId) || { id: A.workoutId, name: 'Workout', focus: '', muscles: [], region: 'full', items: [] };
  const upd = (fn: (a: ActiveWorkout) => void) => RG.update(s => { if (s.active) fn(s.active); });
  // active time only — paused time is excluded, and both timers stand still while paused
  const paused = !!A.pausedAt, elapsed = RG.workoutElapsed(); const restMs = A.restEnd ? A.restEnd - (A.pausedAt ?? Date.now()) : 0;
  const curIdx = A.ex.findIndex(q => q.sets.some(s => !s.done));

  let totalW = 0, doneW = 0, prCount = 0, vol = 0;
  const exs = A.ex.map((x, ei) => {
    const item = w.items.find(i => i.id === x.itemId) || w.items[ei] || blankItem(x.exId);
    const e = RG.ex(x.exId) || { id: x.exId, name: x.exId, muscle: '', region: 'full', equip: 'Machine', instr: '', alts: [] };
    const last = RG.lastPerf(x.exId); const pr = RG.prs(x.exId); const rec = x.rec || {};
    const sets = x.sets.map((st, si) => {
      if (!st.warm) totalW++;
      if (st.done && !st.warm) { doneW++; vol += (Number(st.kg) || 0) * (Number(st.reps) || 0); }
      let pb = '';
      if (st.done && !st.warm && st.reps && pr) {
        const kg = Number(st.kg), r = Number(st.reps);
        if (kg > pr.heavy.kg) pb = 'Heaviest weight';
        else if (RG.e1rm(kg, r) > pr.e1.v + 0.05) pb = `Estimated 1RM PR · ${RG.w(RG.e1rm(kg, r))} ${wu}`;
        else if (pr.repsAt[kg] && r > pr.repsAt[kg].reps) pb = `Rep PR at ${RG.w(kg)} ${wu}`;
      }
      if (pb) prCount++;
      return { st, si, pb, label: st.warm ? 'W' : String(x.sets.slice(0, si + 1).filter(s => !s.warm).length), ph: st.warm ? '' : String(st.target || item.repMin) };
    });
    const alts = (e.alts || []).map(id => RG.ex(id)).filter((o): o is NonNullable<typeof o> => !!o)
      .concat(Object.values(RG.EX).filter(o => o.muscle === e.muscle && o.id !== e.id && !(e.alts || []).includes(o.id)))
      .filter(o => S.profile.equipment.includes(o.equip)).slice(0, 5);
    const done = x.sets.length > 0 && x.sets.every(s => s.done);
    return { x, ei, item, e, last, pr, rec, sets, alts, done, current: curIdx === ei };
  });
  const pct = totalW ? doneW / totalW * 100 : 0;

  const finish = () => {
    const ses = RG.finishWorkout(); setDlg(null);
    if (ses && ses.sets.length) { RG.go('history', ses.id); RG.toast(`${w.name} saved${prCount ? ` · ${prCount} personal record${prCount > 1 ? 's' : ''}` : ''}.`); }
    else RG.toast('No completed sets — nothing saved. The workout stays planned.');
  };
  const discard = () => { RG.discardWorkout(); setDlg(null); RG.toast('Session discarded.'); };

  const header = (
    <View style={{ gap: 8, paddingBottom: 10, maxWidth: 920, width: '100%' }}>
      <Row gap={12} wrap>
        <View style={{ flex: 1, minWidth: 110 }}>
          <Kicker>{`${A.date === T0 ? 'Today' : RG.fmtD(A.date)} · ${w.focus}`}</Kicker>
          <H size={wide ? 26 : 21} style={{ marginTop: 2 }}>{w.name}</H>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Row gap={6}>
            {paused && <Tag icon="pause">Paused</Tag>}
            <T size={22} tab lh={1.2} selectable={false} color={paused ? C.n400 : C.text}>{fmtT(elapsed)}</T>
          </Row>
          <Muted size={11}>{`${doneW} of ${totalW} working sets`}</Muted>
        </View>
        <Btn icon={paused ? 'play' : 'pause'} iconFill={paused} title={paused ? 'Resume' : 'Pause'} label={paused ? 'Resume workout' : 'Pause workout'}
          style={{ paddingVertical: 10, paddingHorizontal: 14 }} onPress={() => (paused ? RG.resumeWorkout() : RG.pauseWorkout())} />
        <Btn variant="primary" icon="flag-checkered" title="Finish" style={{ paddingVertical: 10, paddingHorizontal: 16 }} onPress={() => setDlg('finish')} />
      </Row>
      {paused && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: C.n900, boxShadow: `inset 0 0 0 1px ${C.n700}` }}>
          <Icon name="pause" size={20} color={C.n300} />
          <View style={{ flex: 1, minWidth: 180 }}>
            <T size={14}>Workout paused</T>
            <T size={12} color={C.n400}>Paused time doesn't count toward your workout's duration. The rest timer is on hold too.</T>
          </View>
          <Btn variant="primary" icon="play" iconFill title="Resume" style={{ minHeight: 44 }} onPress={() => RG.resumeWorkout()} />
        </View>
      )}
      {!!A.restEnd && restMs > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: C.a900, boxShadow: `inset 0 0 0 1px ${C.a700}` }}>
          <Icon name="timer" size={22} color={C.accent} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Num size={30}>{fmtT(restMs)}</Num>
            <T size={11} color={C.a200} numberOfLines={2}>{`${paused ? 'Rest on hold' : 'Rest'} · next: ${A.restFor || ''}`}</T>
          </View>
          <Btn title="−15" label="Rest 15 seconds less" style={{ minWidth: 52, minHeight: 44 }} onPress={() => upd(a => { if (a.restEnd) a.restEnd -= 15000; })} />
          <Btn title="+15" label="Rest 15 seconds more" style={{ minWidth: 52, minHeight: 44 }} onPress={() => upd(a => { a.restEnd = (a.restEnd || a.pausedAt || Date.now()) + 15000; })} />
          <Btn title="Skip rest" style={{ minHeight: 44 }} onPress={() => upd(a => { a.restEnd = null; })} />
        </View>
      )}
      <Bar height={3} fills={[{ pct, color: C.accent }]} />
    </View>
  );

  return (
    <Screen header={header}>
      <View style={{ gap: 14, maxWidth: 920, width: '100%' }}>
        {exs.map(({ x, ei, item, e, last, pr, rec, sets, alts, done, current }) => {
          const recTitle = rec.type === 'increase' ? 'Recommended · increase' : rec.type === 'reduce' ? 'Recommended · reduce' : rec.type === 'baseline' ? 'Recommended · baseline' : 'Recommended · hold';
          const setOf = (a: ActiveWorkout, si: number) => a.ex[ei].sets[si];
          const tile = (label: string, value: string) => (
            <View style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, backgroundColor: C.n900 }}>
              <T size={10} color={C.n500} upper style={{ letterSpacing: 0.8 }}>{label}</T>
              <T size={14} tab style={{ marginTop: 2 }}>{value}</T>
            </View>
          );
          const pickSub = (oId: string, oName: string) => {
            const perm = !!subPerm[x.key];
            upd(a => {
              const xx = a.ex[ei]; xx.exId = oId; const lp = RG.lastPerf(oId);
              const r = RG.recommend(oId, { ...item, exId: oId, replaced: [{ exId: x.originalExId, date: T0 }] });
              xx.rec = r || {}; xx.recState = 'pending';
              xx.sets.forEach(s => { if (!s.done) { s.kg = r && r.kg != null ? r.kg : lp ? lp.sets[0].kg : ''; s.reps = null; } });
            });
            if (perm && item.id) RG.replaceExercise(A.planId, A.workoutId, item.id, oId);
            setSub(v => ({ ...v, [x.key]: false }));
            RG.toast(`Swapped to ${oName}.${perm ? ' Plan updated; the original history is kept.' : ''}`);
          };
          return (
            <View key={x.key} style={{ gap: 10, padding: 16, borderRadius: R.md, backgroundColor: C.surface,
              boxShadow: done ? `inset 0 0 0 1px ${C.a800}` : current ? `inset 0 0 0 1px ${C.a700}, 0 0 24px -12px ${C.accent}` : SHADOW.sm }}>
              {/* title row */}
              <Row gap={10} wrap align="flex-start">
                <View style={{ width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: C.n900 }}>
                  <T size={12} color={C.n300} lh={1.2}>{ei + 1}</T>
                </View>
                <View style={{ flex: 1, minWidth: 180 }}>
                  <Row gap={8} wrap>
                    <T size={18} w={500} lh={1.3}>{e.name}</T>
                    {!!item.superset && <Tag variant="outline">{`Superset ${item.superset}`}</Tag>}
                    {x.exId !== x.originalExId && <Tag>{`Substitute for ${RG.ex(x.originalExId)?.name || x.originalExId}`}</Tag>}
                  </Row>
                  <Muted style={{ marginTop: 2 }}>{`${item.sets} × ${item.repMin}–${item.repMax} · RIR ${item.rir} · rest ${item.rest >= 60 ? Math.floor(item.rest / 60) + ':' + String(item.rest % 60).padStart(2, '0') : item.rest + 's'} · ${e.equip}`}</Muted>
                </View>
                <Row gap={2}>
                  <Btn variant="ghost" iconOnly icon="info" label="Instructions" onPress={() => setInfo(v => ({ ...v, [x.key]: !v[x.key] }))} />
                  <Btn variant="ghost" iconOnly icon="swap" label={sub[x.key] ? 'Close substitute options' : 'Substitute exercise'} onPress={() => { if (sub[x.key]) setSubPerm(p => ({ ...p, [x.key]: false })); setSub(v => ({ ...v, [x.key]: !v[x.key] })); }} />
                  <Btn variant="ghost" iconOnly icon="arrow-counter-clockwise" label="Repeat previous numbers" onPress={() => {
                    if (!last) return RG.toast('No previous session for this exercise yet.');
                    upd(a => { let j = 0; a.ex[ei].sets.forEach(s => { if (!s.warm && !s.done) { const ls = last.sets[Math.min(j, last.sets.length - 1)]; s.kg = ls.kg; s.reps = ls.reps; s.rir = ls.rir; } if (!s.warm) j++; }); });
                  }} />
                </Row>
              </Row>

              {/* previous / PR / recommended */}
              <Grid min={170} gap={8}>
                {tile(`Previous · ${last ? RG.fmtShort(last.date) : 'none'}`, last ? `${RG.w(last.sets[0].kg)} ${wu} × ${last.sets.map(s => s.reps).join(', ')} · RIR ${last.sets.map(s => s.rir ?? '–').join('/')}` : 'No history — this session sets the baseline')}
                {tile('Personal record', pr ? `${RG.w(pr.best.kg)} ${wu} × ${pr.best.reps.join(', ')} · e1RM ${RG.w(pr.e1.v)}` : '—')}
                <View style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, backgroundColor: C.a900, boxShadow: `inset 0 0 0 1px ${x.recState === 'accepted' ? C.accent : C.a800}`, opacity: x.recState === 'ignored' ? 0.5 : 1 }}>
                  <T size={10} color={C.a300} upper style={{ letterSpacing: 0.8 }}>{recTitle}</T>
                  <T size={14} tab style={{ marginTop: 2 }}>{rec.kg != null ? `${RG.w(rec.kg)} ${wu} × ${(rec.reps || []).join(', ')}` : 'Choose a starting weight'}</T>
                </View>
              </Grid>
              {x.recState === 'pending' && !!rec.reason && (
                <Row gap={8} wrap>
                  <T size={12} color={C.n400} style={{ flex: 1, minWidth: 200 }}>{rec.reason}</T>
                  <Btn variant="primary" size="sm" title="Accept" onPress={() => upd(a => {
                    const xx = a.ex[ei]; xx.recState = 'accepted'; let j = 0;
                    xx.sets.forEach(s => { if (!s.warm && !s.done) { if (rec.kg != null) s.kg = rec.kg; s.target = (rec.reps || [])[j] ?? s.target; } if (!s.warm) j++; });
                  })} />
                  <Btn size="sm" title="Edit" onPress={() => upd(a => { a.ex[ei].recState = 'edited'; })} />
                  <Btn variant="ghost" size="sm" title="Ignore" onPress={() => upd(a => {
                    const xx = a.ex[ei]; xx.recState = 'ignored';
                    if (last) xx.sets.filter(s => !s.warm && !s.done).forEach(s => { s.kg = last.sets[0].kg; s.target = item.repMin; });
                  })} />
                </Row>
              )}

              {/* instructions & media */}
              {info[x.key] && (
                <Grid min={220} gap={10} style={{ alignItems: 'flex-start' }}>
                  <View>
                    <T size={13} color={C.n300}>{e.instr}</T>
                    <Muted style={{ marginTop: 6 }}>{`Tempo ${item.tempo} · Rest ${item.rest} s${item.notes ? ' · ' + item.notes : ''}`}</Muted>
                  </View>
                  <View style={{ gap: 6 }}>
                    {item.media ? (
                      <Tap onPress={() => { Linking.openURL(item.media!).catch(() => RG.toast('Could not open that link.')); }} label="Open demonstration" style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32 }}>
                        <Icon name="play-circle" size={15} color={C.accent} /><T size={13} color={C.accent}>Open demonstration</T>
                      </Tap>
                    ) : (
                      <Stripes style={{ height: 96, borderRadius: 6, boxShadow: `inset 0 0 0 1px ${C.n800}` }}>
                        <T size={11} color={C.n500} style={{ fontFamily: 'monospace' }}>demonstration image / video</T>
                      </Stripes>
                    )}
                    <Input value={item.media || ''} placeholder="Paste image or video URL" size={12} height={32} autoCapitalize="none" autoCorrect={false} inputMode="url"
                      onChange={v => RG.update(s => {
                        const ww = (s.plans.find(p => p.id === A.planId) || s.plans[0])?.workouts.find(q => q.id === A.workoutId);
                        const it2 = ww?.items.find(q => q.id === item.id); if (it2) it2.media = v;
                      })} />
                  </View>
                </Grid>
              )}

              {/* substitute */}
              {sub[x.key] && (
                <View style={{ gap: 6, padding: 10, borderRadius: 6, backgroundColor: C.n900 }}>
                  <T size={12} color={C.n400}>Substitute for this session. History stays with each exercise separately.</T>
                  <Row gap={6} wrap>
                    {alts.map(o => (
                      <Btn key={o.id} size="sm" onPress={() => pickSub(o.id, o.name)} label={`Swap to ${o.name}`}
                        title={<T size={12} lh={1.2}>{o.name} <T size={12} color={C.n500}>· {o.equip}</T></T>} />
                    ))}
                    {!alts.length && <Muted>No alternatives for your equipment.</Muted>}
                  </Row>
                  <Check checked={!!subPerm[x.key]} onChange={v => setSubPerm(p => ({ ...p, [x.key]: v }))} label="Also replace in the plan going forward" size={12} />
                  <Row gap={6} wrap>
                    <Muted size={11} style={{ flex: 1, minWidth: 160 }}>Tap an exercise to swap. Nothing changes until you do.</Muted>
                    <Btn size="sm" icon="x" title="Cancel" label="Cancel — keep this exercise" style={{ minHeight: 36 }}
                      onPress={() => { setSub(v => ({ ...v, [x.key]: false })); setSubPerm(p => ({ ...p, [x.key]: false })); }} />
                  </Row>
                </View>
              )}

              {/* set table */}
              <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 2 }}>
                <ColLabel style={{ width: COL.label }}>Set</ColLabel>
                <ColLabel style={{ flex: 1 }}>{wu}</ColLabel>
                <ColLabel style={{ flex: 1 }}>Reps</ColLabel>
                <ColLabel style={{ width: COL.rir }}>RIR</ColLabel>
                <ColLabel style={{ width: COL.done }}>Done</ColLabel>
                <View style={{ width: COL.rm }} />
              </View>
              {sets.map(({ st, si, pb, label, ph }) => {
                const inp = { height: 48, paddingHorizontal: 6, fontSize: 20, fontVariant: ['tabular-nums' as const], backgroundColor: st.done ? 'transparent' : C.surface, borderColor: st.done ? C.a800 : C.divider };
                const setNum = (k: 'reps' | 'rir') => (n: number | null) => upd(a => { setOf(a, si)[k] = n == null ? '' : n; });
                return (
                  <View key={st.id} style={{ gap: 6, opacity: st.done ? 0.85 : 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Pressable accessibilityRole="button" accessibilityLabel={st.warm ? 'Warm-up set — make working set' : 'Working set — make warm-up'} hitSlop={4}
                        onPress={() => upd(a => { setOf(a, si).warm = !setOf(a, si).warm; })}
                        style={(ps: PState) => [{ width: COL.label, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
                          st.warm ? { borderWidth: 1, borderStyle: 'dashed', borderColor: C.n700 } : { backgroundColor: C.n900 }, ps.hovered && { opacity: 0.85 }]}>
                        <T size={13} color={st.warm ? C.n500 : C.text}>{label}</T>
                      </Pressable>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <NumInput accessibilityLabel="Weight" center height={48} style={inp}
                          value={st.kg === '' || st.kg == null ? '' : RG.w(Number(st.kg))}
                          onValue={n => upd(a => { const s2 = setOf(a, si); s2.kg = n == null ? '' : RG.r1(RG.toKg(n)); if (a.ex[ei].recState === 'pending') a.ex[ei].recState = 'edited'; })} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <NumInput accessibilityLabel="Reps" center height={48} style={inp} inputMode="numeric" keyboardType="number-pad" value={st.reps ?? ''} placeholder={ph} onValue={setNum('reps')} />
                      </View>
                      <View style={{ width: COL.rir }}>
                        <NumInput accessibilityLabel="RIR" center height={48} style={[inp, { fontSize: 16 }]} inputMode="numeric" keyboardType="number-pad" value={st.rir ?? ''} onValue={setNum('rir')} />
                      </View>
                      <Pressable accessibilityRole="checkbox" accessibilityLabel="Complete set" accessibilityState={{ checked: st.done }}
                        onPress={() => upd(a => {
                          const s2 = setOf(a, si);
                          if (!s2.done && (s2.reps === '' || s2.reps == null)) s2.reps = s2.target || item.repMin;
                          if (!s2.done && (s2.kg === '' || s2.kg == null)) s2.kg = 0;
                          s2.done = !s2.done;
                          if (s2.done) {
                            const nxt = a.ex[ei].sets.find(q => !q.done);
                            const ssPartner = item.superset ? w.items.find(q => q.superset === item.superset && q.id !== item.id) : undefined;
                            a.restEnd = ssPartner && w.items.indexOf(ssPartner) > w.items.indexOf(item) ? null : (a.pausedAt ?? Date.now()) + item.rest * 1000;
                            a.restFor = nxt ? `${e.name} · set ${a.ex[ei].sets.indexOf(nxt) + 1}` : (a.ex[ei + 1] ? RG.ex(a.ex[ei + 1].exId)?.name || 'next exercise' : 'finish');
                          }
                        })}
                        style={(ps: PState) => [{ width: COL.done, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
                          borderColor: st.done ? C.accent : C.n700, backgroundColor: st.done ? alpha(C.accent, 0.18) : ps.hovered ? alpha(C.text, 0.06) : 'transparent' }]}>
                        <Icon name={st.done ? 'check-circle' : 'check'} fill={st.done} size={22} color={st.done ? C.accent : C.n500} />
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel="Remove set" hitSlop={{ left: 4, right: 8 }} onPress={() => upd(a => { a.ex[ei].sets.splice(si, 1); })}
                        style={{ width: COL.rm, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="x" size={15} color={C.n600} />
                      </Pressable>
                    </View>
                    {!!pb && (
                      <Row gap={6} style={{ marginLeft: COL.label + 6 }}>
                        <Icon name="trophy" fill size={13} color={C.a300} /><T size={12} color={C.a300}>{pb}</T>
                      </Row>
                    )}
                  </View>
                );
              })}

              {/* add set · feel · notes */}
              <Row gap={6} wrap>
                <Btn variant="ghost" icon="plus" title="Add set" onPress={() => upd(a => {
                  const xx = a.ex[ei]; const lastW = [...xx.sets].reverse().find(s => !s.warm);
                  xx.sets.push({ id: RG.uid(), kg: lastW?.kg ?? '', reps: null, target: lastW?.target || item.repMin, rir: item.rir, warm: false, done: false, note: '', feel: '' });
                })} />
                <Spacer />
                {FEELS.map(l => {
                  const on = x.feel === l;
                  return (
                    <Pressable key={l} accessibilityRole="button" accessibilityState={{ selected: on }} hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
                      onPress={() => upd(a => { a.ex[ei].feel = a.ex[ei].feel === l ? '' : l; })}
                      style={(ps: PState) => [{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 5, borderWidth: 1, borderColor: on ? C.n600 : C.n800,
                        backgroundColor: on ? (l === 'Good' ? C.a800 : C.n800) : ps.hovered ? alpha(C.text, 0.05) : 'transparent' }]}>
                      <T size={11} color={on ? C.text : C.n500} lh={1.3}>{l}</T>
                    </Pressable>
                  );
                })}
              </Row>
              <Input value={x.note} placeholder="Notes — setup, cues, how it felt" size={13} onChange={v => upd(a => { a.ex[ei].note = v; })} />
            </View>
          );
        })}

        {!exs.length && <Card><Muted size={13}>This workout has no exercises. Add some in Workout Plans, or discard the session.</Muted></Card>}

        <Row gap={8} wrap style={{ justifyContent: 'space-between', paddingTop: 8, paddingBottom: 8 }}>
          <Btn variant="ghost" title="Discard session" color={C.n400} onPress={() => setDlg('discard')} />
          <Btn variant="primary" size="lg" icon="flag-checkered" title="Finish & save workout" style={{ paddingVertical: 12, paddingHorizontal: 22 }} onPress={() => setDlg('finish')} />
        </Row>
        <NotMedical text="Targets and PRs are estimates from your logged sets — not medical advice. Stop if something hurts." />
      </View>

      <Dialog open={dlg === 'finish'} onClose={() => setDlg(null)} title={`Finish ${w.name}?`}
        actions={<><Btn title="Keep training" onPress={() => setDlg(null)} /><Btn variant="primary" title="Save workout" onPress={finish} /></>}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {([[doneW, 'Working sets'], [RG.num(RG.imp() ? vol * 2.20462 : vol), `Volume (${wu})`], [prCount, 'Personal records']] as const).map(([v, l]) => (
            <View key={l} style={{ flex: 1 }}><Num size={28}>{v}</Num><Muted size={11}>{l}</Muted></View>
          ))}
        </View>
        <Muted size={12}>{`Workout time ${fmtT(elapsed)}${A.pausedMs || paused ? ' · paused time not counted' : ''}`}</Muted>
        <T size={14} color={alpha(C.text, 0.85)}>{doneW < totalW ? `${totalW - doneW} planned working set(s) not completed — only completed sets are saved. Next-session targets update from what you logged.` : 'Every planned set is logged. Next-session targets update from these numbers.'}</T>
      </Dialog>

      <Dialog open={dlg === 'discard'} onClose={() => setDlg(null)} title="Discard this session?"
        body="Nothing from this session will be saved and the workout stays planned. This can't be undone."
        actions={<><Btn title="Cancel" onPress={() => setDlg(null)} /><Btn variant="primary" title="Discard" onPress={discard} /></>} />
    </Screen>
  );
}
