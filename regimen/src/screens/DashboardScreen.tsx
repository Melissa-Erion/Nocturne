/* 1. Fitness Dashboard — port of prototype/FitDashboard.dc.html */
import { useState } from 'react';
import { View } from 'react-native';
import { useRG } from '@/store/rg';
import type { IconName } from '@/ui/icons';
import {
  Banner, Bar, Btn, Card, CardTitle, Check, ColLabel, Dialog, Field, Grid, H, HeroCard, Icon, Kicker, LineChart, Muted, NotMedical,
  NumInput, Row, RuledRow, Seg, Stat, T, Tag, Tap,
} from '@/ui/kit';
import { alpha, C } from '@/ui/theme';
import { Screen } from './Shell';

const REMINDER_ICONS: Record<string, IconName> = {
  'Upcoming workout': 'barbell', 'Start workout': 'play', 'Progress check-in': 'clipboard-text', 'Progress photos': 'camera', 'Meal prep': 'cooking-pot',
  'Grocery shopping': 'shopping-cart', "Prepare tomorrow's meals": 'cooking-pot', 'Drink water': 'drop', 'Wind-down routine': 'moon', 'Weight log': 'scales',
  Supplements: 'pill', 'Missed workout': 'warning',
};

export default function DashboardScreen() {
  const RG = useRG();
  const [q, setQ] = useState(0);
  const [dlg, setDlg] = useState<null | 'weight' | 'move'>(null);
  const [wInput, setWInput] = useState<number | null>(null);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [shiftOverride, setShift] = useState<boolean | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);

  const S = RG.s, P = S.profile, T0 = RG.TODAY, wu = RG.wu();
  const todayEntries = S.schedule.filter(e => e.date === T0 && (e.status === 'planned' || e.status === 'done'));
  const entry = todayEntries.find(e => e.status === 'planned') || todayEntries[0];
  const moveTarget = (moveId ? RG.entry(moveId) : undefined) || (entry && entry.status === 'planned' ? entry : RG.nextEntry(T0));
  const w = entry && RG.workout(entry.workoutId, entry.planId);
  const pause = RG.activePause();

  const exercisesOf = (w: NonNullable<ReturnType<typeof RG.workout>>) => w.items.map(item => {
    const e = RG.ex(item.exId); const last = RG.lastPerf(item.exId); const rec = RG.recommend(item.exId, item);
    const up = rec?.type === 'increase', dn = rec?.type === 'reduce';
    return {
      key: item.id, name: e?.name || item.exId, scheme: `${item.sets} × ${item.repMin}–${item.repMax} · RIR ${item.rir}${item.superset ? ' · superset ' + item.superset : ''}`,
      last: last ? `${RG.w(last.sets[0].kg)} ${wu} × ${last.sets.map(s => s.reps).join(', ')}` : '—',
      next: rec && rec.kg != null ? `${RG.w(rec.kg)} ${wu} × ${rec.reps.join(', ')}` : 'Set baseline',
      icon: (up ? 'arrow-up-right' : dn ? 'arrow-down-right' : rec?.type === 'baseline' ? 'flag' : 'equals') as IconName,
      color: up ? C.accent : dn ? C.n300 : C.n500,
    };
  });
  const todays_ = todayEntries.map(e => ({ e, w: RG.workout(e.workoutId, e.planId) })).filter((x): x is { e: typeof x.e; w: NonNullable<typeof x.w> } => !!x.w);

  // week strip
  const mon = RG.monday(T0); const ws = RG.weekStats(mon); const nextCheck = RG.nextCheckIn();
  const week = [0, 1, 2, 3, 4, 5, 6].map(i => {
    const d = RG.add(mon, i); const es = RG.entriesOn(d); const e = es.find(x => x.status === 'done') || es.find(x => x.status === 'planned') || es[0];
    const st = !e ? (RG.inPause(d) ? 'paused' : 'rest') : e.status; const isT = d === T0;
    const ww = e && RG.workout(e.workoutId, e.planId);
    const lab = ww ? ww.id : d === nextCheck ? 'Check' : st === 'paused' ? 'Paused' : 'Rest';
    const icon: IconName = st === 'done' ? 'check-circle' : st === 'missed' ? 'x-circle' : st === 'skipped' ? 'skip-forward-circle' : st === 'planned' ? (isT ? 'barbell' : 'circle-dashed') : st === 'paused' ? 'pause' : lab === 'Check' ? 'clipboard-text' : 'moon';
    const color = st === 'rest' || st === 'paused' ? C.n600 : st === 'missed' ? C.n400 : C.text;
    return { d, day: RG.DN[i] + ' ' + Number(d.slice(8)), lab, icon, fill: st === 'done', color, st, isT, title: ww ? `${ww.name} · ${st}` : lab };
  });

  // weight
  const hasW = S.weights.length > 0;
  const ww = S.weights.slice(-28).map(x => x.kg); const avg = RG.rolling(S.weights.map(x => x.kg), 7).slice(-28);
  const lo = Math.min(...ww) - 0.3, hi = Math.max(...ww) + 0.3;
  const a0 = RG.avgWeight(T0), a1 = RG.avgWeight(RG.add(T0, -7));
  const ch = a0 != null && a1 != null ? a0 - a1 : null;
  const chStr = ch == null ? '—' : (ch < 0 ? '−' : '+') + (RG.imp() ? Math.abs(ch * 2.20462).toFixed(1) : Math.abs(ch).toFixed(1)) + ' ' + wu;

  // nutrition
  const day = RG.getDay(T0); const tot = RG.dayTotals(T0); const tgs = RG.mealTargets(day.type);
  const DT = RG.dayTargets(T0);
  const mk: [string, number, number, number, string][] = [['Calories', DT.kcal, tot.planned.kcal, tot.logged.kcal, 'kcal'], ['Protein', DT.protein, tot.planned.p, tot.logged.p, 'g'], ['Carbs', DT.carbs, tot.planned.c, tot.logged.c, 'g'], ['Fat', DT.fat, tot.planned.f, tot.logged.f, 'g']];
  const macroKcal = DT.protein * 4 + DT.carbs * 4 + DT.fat * 9; const dk = macroKcal - DT.kcal;
  const macroNote = `Planned today: ${RG.num(tot.planned.kcal)} kcal. ` + (Math.abs(dk) > 5 ? `Your macro targets add up to ${RG.num(macroKcal)} kcal, ${Math.abs(dk)} kcal ${dk > 0 ? 'above' : 'below'} the ${RG.num(DT.kcal)} kcal calorie target. Macros are rounded to whole grams.` : 'Macro targets reconcile with the calorie target.');

  // quote & reminders
  const quote = RG.todayQuote(q);
  const now = new Date(); const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const todays = S.reminders.filter(r => r.enabled && /Daily|Training|Every/.test(r.freq) && r.time > nowHM && (!/Training/.test(r.freq) || (entry && entry.status === 'planned')));
  const reminders = todays.slice(0, 3).map(r => ({ when: r.time, icon: REMINDER_ICONS[r.type] || 'bell' as IconName, text: r.type + (r.type === 'Upcoming workout' && w ? ` · ${w.name} at ${P.workoutTime}` : '') }))
    .concat(S.reminders.filter(r => r.enabled && /Sat|Sun/.test(r.freq)).slice(0, 2).map(r => ({ when: (r.freq.includes('Sat') ? 'Sat ' : 'Sun ') + r.time, icon: REMINDER_ICONS[r.type] || 'bell', text: r.type })));

  const hour = now.getHours();
  const greeting = `Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}${P.name ? ', ' + P.name : ''}`;
  const nx = RG.nextEntry(T0);
  const shift = shiftOverride ?? P.shiftLater;
  const mv = moveTarget;
  const moveDays = mv ? Array.from({ length: 12 }, (_, i) => RG.add(T0, i)).filter(d => d !== mv.date).map(d => {
    const os = S.schedule.filter(e => e.date === d && e.status === 'planned' && e.id !== mv.id);
    return { d, label: RG.fmtD(d), occ: os.length > 1 ? `${os.length} workouts` : os.length ? (RG.workout(os[0].workoutId, os[0].planId)?.name || '').replace(' Body ', ' ') : RG.inPause(d) ? 'Paused' : 'Free' };
  }) : [];

  const openMove = (id?: string) => { if (!id && !(entry && entry.status === 'planned') && !RG.nextEntry(T0)) return RG.toast('No upcoming workout to move.'); setMoveId(id || null); setMoveTo(null); setShift(null); setDlg('move'); };
  const saveWeight = () => { const v = wInput; if (!(v != null && v > 20)) return; RG.logWeight(RG.toKg(v)); setDlg(null); RG.toast(`Weight logged: ${v} ${wu}. The 7-day average is updated.`); };
  const confirmMove = () => {
    if (!moveTo || !mv) return;
    const r = RG.moveEntry(mv.id, moveTo, shift); setDlg(null);
    RG.toast(r.error || [`Moved to ${RG.fmtD(moveTo)}.`, r.note, r.warning].filter(Boolean).join(' '));
  };

  return (
    <Screen>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <View style={{ marginRight: 'auto' }}>
          <Muted>{`${RG.DFULL[RG.dow(T0)]}, ${Number(T0.slice(8))} ${RG.MFULL[Number(T0.slice(5, 7)) - 1]}`}</Muted>
          <H size={28} style={{ marginTop: 2 }}>{greeting}</H>
        </View>
        <Row gap={6} wrap style={{ flexShrink: 1, maxWidth: '100%' }}>
          <Btn icon="scales" title="Log weight" onPress={() => { setWInput(S.weights.length ? Number(RG.w(S.weights[S.weights.length - 1].kg)) : null); setDlg('weight'); }} />
          <Btn icon="camera" title="Progress photos" onPress={() => RG.go('photos')} />
          <Btn icon="arrows-left-right" title="Move workout" onPress={() => openMove()} />
          <Btn icon="cooking-pot" title="Prepare meals" onPress={() => RG.go('prep')} />
        </Row>
        <Seg value={P.units} onChange={v => RG.update(s => { s.profile.units = v; })} options={[{ value: 'metric', label: 'kg' }, { value: 'imperial', label: 'lb' }]} />
      </View>

      {pause && (
        <Banner>
          <Icon name="pause-circle" size={20} color={C.accent} />
          <T size={14} style={{ flex: 1, minWidth: 200 }}>{`Schedule paused since ${RG.fmtD(pause.from)} · ${pause.reason}. Your rotation is saved and resumes with the next workout in order.`}</T>
          <Btn variant="primary" title="Resume schedule" onPress={() => { RG.resume(); RG.toast('Schedule resumed — rotation picks up where it left off.'); }} />
        </Banner>
      )}

      <Grid min={420}>
        <HeroCard style={{ flexGrow: 1 }}>
          {todays_.length ? (
            <>
              {todays_.map(({ e: en, w: tw }, ti) => {
                const incr = tw.items.filter(i => RG.recommend(i.exId, i)?.type === 'increase').length;
                return (
                  <View key={en.id} style={{ gap: 12, paddingTop: ti ? 18 : 0, borderTopWidth: ti ? 1 : 0, borderColor: C.divider }}>
                    <Row gap={12} wrap align="flex-start">
                      <View style={{ marginRight: 'auto', flexShrink: 1 }}>
                        <Kicker>{todays_.length > 1 ? `Today · workout ${ti + 1} of ${todays_.length} · ~${P.duration} min · ${P.location}` : `Today · ${P.workoutTime} · ~${P.duration} min · ${P.location}`}</Kicker>
                        <H size={30} style={{ marginTop: 6 }}>{tw.name}</H>
                        <T size={13} color={C.n400} style={{ marginTop: 4 }}>{`${tw.focus} · ${tw.items.reduce((a, i) => a + i.sets, 0)} working sets · ${incr ? incr + ' weight increase' + (incr > 1 ? 's' : '') + ' suggested' : 'hold weights, add reps'}`}</T>
                      </View>
                      {en.status === 'planned' && !pause && (
                        <Btn variant="primary" size="lg" icon="play" iconFill title={S.active && S.active.entryId === en.id ? 'Resume workout' : 'Start workout'} onPress={() => RG.startWorkout(en.id)} />
                      )}
                      {en.status === 'done' && <Tag variant="accent" icon="check-circle">Logged</Tag>}
                    </Row>
                    <View>
                      <View style={{ flexDirection: 'row', gap: 14, paddingTop: 6, paddingBottom: 4 }}>
                        <ColLabel style={{ flex: 1 }}>Exercise</ColLabel><ColLabel>Last session</ColLabel><ColLabel>Next target</ColLabel>
                      </View>
                      {exercisesOf(tw).map(ex => (
                        <RuledRow key={ex.key} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 12 }}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <T size={14} numberOfLines={1}>{ex.name}</T>
                            <Muted numberOfLines={1}>{ex.scheme}</Muted>
                          </View>
                          <T size={13} color={C.n300} tab style={{ flexShrink: 0 }}>{ex.last}</T>
                          <Row gap={6} style={{ flexShrink: 0 }}>
                            <Icon name={ex.icon} size={14} color={ex.color} />
                            <T size={13} tab>{ex.next}</T>
                          </Row>
                        </RuledRow>
                      ))}
                    </View>
                    {(en.status === 'planned' || ti === todays_.length - 1) && (
                      <Row gap={4} wrap>
                        <Btn variant="ghost" icon="calendar-blank" title="Move" onPress={() => openMove(en.status === 'planned' ? en.id : undefined)} />
                        {en.status === 'planned' && <Btn variant="ghost" icon="skip-forward" title="Skip" onPress={() => { RG.skipEntry(en.id); RG.toast(`${tw.name} skipped. The rotation continues with the next workout.`); }} />}
                        {ti === todays_.length - 1 && <Btn variant="ghost" icon="calendar-dots" title="Full schedule" onPress={() => RG.go('schedule')} />}
                      </Row>
                    )}
                  </View>
                );
              })}
            </>
          ) : (
            <>
              <Kicker>Today</Kicker>
              <H size={30}>Rest day</H>
              <T size={14} color={C.n400}>{nx ? `Next: ${RG.workout(nx.workoutId, nx.planId)?.name} · ${RG.fmtD(nx.date)}` : 'No upcoming sessions'}</T>
              <Row gap={6}><Btn title="Open schedule" onPress={() => RG.go('schedule')} /></Row>
            </>
          )}
        </HeroCard>

        <View style={{ gap: 16 }}>
          <Card>
            <Row style={{ alignItems: 'baseline' }}><CardTitle style={{ marginRight: 'auto' }}>This week</CardTitle><Muted>{`${RG.fmtShort(mon)} – ${RG.fmtShort(RG.add(mon, 6))}`}</Muted></Row>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {week.map(d => (
                <Tap key={d.d} onPress={() => RG.go('schedule')} label={d.title}
                  style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 2, borderRadius: 8,
                    backgroundColor: d.st === 'done' ? C.a900 : d.isT ? alpha(C.accent, 0.1) : 'transparent',
                    boxShadow: d.isT ? `inset 0 0 0 1px ${C.accent}` : d.st === 'planned' ? `inset 0 0 0 1px ${C.n800}` : undefined }}>
                  <T size={10} color={C.n500} upper style={{ letterSpacing: 0.6 }} numberOfLines={1}>{d.day}</T>
                  <Icon name={d.icon} fill={d.fill} size={18} color={d.color} />
                  <T size={11} color={d.color} lh={1.2} numberOfLines={1}>{d.lab}</T>
                </Tap>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Stat value={ws.done} sub={` / ${ws.total}`} label={`${ws.pct}% done${ws.missed ? ` · ${ws.missed} missed` : ''}`} /></View>
              <View style={{ flex: 1 }}><Stat value={RG.streak()} label="Sessions in a row" /></View>
              <View style={{ flex: 1 }}><Stat value={RG.fmtD(nextCheck).replace(/ \w+$/, '')} label="Next check-in" /></View>
            </View>
          </Card>
          <Card gap={8}>
            <Row style={{ alignItems: 'baseline' }}><CardTitle style={{ marginRight: 'auto' }}>Body weight</CardTitle><Tag>7-day average</Tag></Row>
            {hasW ? (
              <>
                <Row gap={10} wrap style={{ alignItems: 'baseline' }}>
                  <T size={32} tab lh={1.15} style={{ letterSpacing: -0.64 }}>{RG.bw(a0)}</T>
                  <T size={14} color={C.n400}>{wu}</T>
                  <T size={13} color={C.a300}>{chStr} vs last week</T>
                </Row>
                <LineChart height={80} series={[{ points: RG.pts(ww, 280, 80, lo, hi), color: C.n700, width: 1.2 }, { points: RG.pts(avg, 280, 80, lo, hi), color: C.accent, width: 2 }]} />
                <Row><Muted size={11} color={C.n600} style={{ marginRight: 'auto' }}>4 weeks</Muted><Muted size={11} color={C.n600}>{`Latest scale reading ${RG.bw(S.weights[S.weights.length - 1].kg)} ${wu}`}</Muted></Row>
              </>
            ) : (
              <>
                <T size={14} color={C.n400}>No weigh-ins yet. Log a reading to start your 7-day average.</T>
                <Row><Btn icon="scales" title="Log weight" onPress={() => { setWInput(null); setDlg('weight'); }} /></Row>
              </>
            )}
          </Card>
        </View>
      </Grid>

      <Grid min={380}>
        <Card>
          <Row wrap style={{ alignItems: 'baseline' }}>
            <CardTitle style={{ marginRight: 'auto' }}>Calories &amp; macros</CardTitle>
            <Row gap={5}>
              <View style={{ width: 10, height: 6, borderRadius: 2, backgroundColor: C.accent }} /><Muted size={11}>Logged</Muted>
              <View style={{ width: 10, height: 6, borderRadius: 2, backgroundColor: C.n700, marginLeft: 6 }} /><Muted size={11}>Planned</Muted>
            </Row>
          </Row>
          {mk.map(m => {
            const rem = m[1] - m[3];
            return (
              <View key={m[0]} style={{ gap: 5 }}>
                <Row style={{ alignItems: 'baseline' }}>
                  <T size={13} style={{ marginRight: 'auto' }}>{m[0]}</T>
                  <T size={13} tab>{RG.num(m[3])}</T>
                  <T size={13} tab color={C.n500}>/ {RG.num(m[1])} {m[4]}</T>
                  <T size={13} tab color={C.a300} style={{ minWidth: 76, textAlign: 'right' }}>{rem >= 0 ? `${RG.num(rem)}${m[4] === 'g' ? ' g' : ''} left` : `${RG.num(-rem)} over`}</T>
                </Row>
                <Bar fills={[{ pct: m[2] / m[1] * 100, color: C.n700 }, { pct: m[3] / m[1] * 100, color: C.accent }]} />
              </View>
            );
          })}
          <Muted size={11}>{macroNote}</Muted>
          <NotMedical />
          <Row gap={4}><Btn variant="ghost" title="Nutrition dashboard" onPress={() => RG.go('nutrition')} /><Btn variant="ghost" title="Meal planner" onPress={() => RG.go('meals')} /></Row>
        </Card>
        <Card gap={6}>
          <Row style={{ alignItems: 'baseline' }}><CardTitle style={{ marginRight: 'auto' }}>Meals today</CardTitle><Btn variant="ghost" icon="shopping-cart" title="Grocery list" onPress={() => RG.go('grocery')} /></Row>
          {day.meals.map((m, i) => {
            const t = tgs[i]; const sm = RG.sumM(m.items);
            const foods = m.items.map(x => { const f = RG.food(x.foodId); return f ? `${f.name.split(',')[0]} ${Math.round(x.g)} g${f.basis === 'cooked' ? ' cooked' : f.basis === 'raw' ? ' raw' : ''}` : ''; }).filter(Boolean).join(' · ');
            return (
              <RuledRow key={m.key} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Muted tab style={{ width: 44 }}>{t?.time || ''}</Muted>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={14}>{t?.name || 'Meal ' + (i + 1)} <T size={14} color={C.n500}>· {t?.label || ''}</T></T>
                  <Muted numberOfLines={1}>{foods || 'Nothing planned yet'}</Muted>
                  <T size={11} color={C.n400} tab>{`${RG.num(sm.kcal)} kcal · ${Math.round(sm.p)}P ${Math.round(sm.c)}C ${Math.round(sm.f)}F · ${m.prepped ? 'Prepped' : 'Not prepped'}`}</T>
                </View>
                <Tap onPress={() => RG.update(s => { const mm = s.days[T0].meals[i]; mm.logged = !mm.logged; })} label={m.logged ? 'Mark not logged' : 'Log meal'}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: m.logged ? C.a800 : C.accent, backgroundColor: m.logged ? C.a800 : 'transparent' }}>
                  <Icon name={m.logged ? 'check-circle' : 'plus-circle'} fill={m.logged} size={13} color={m.logged ? C.a100 : C.accent} />
                  <T size={12} color={m.logged ? C.a100 : C.accent}>{m.logged ? 'Logged' : 'Log'}</T>
                </Tap>
              </RuledRow>
            );
          })}
        </Card>
      </Grid>

      <Grid min={380}>
        <Banner gradient>
          <Icon name="quotes" size={26} color={C.accent} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={18} lh={1.35}>{quote.text}</T>
            <Muted size={11} style={{ marginTop: 4 }}>{`Today's line · ${quote.tone}`}</Muted>
          </View>
          <Btn variant="ghost" iconOnly icon="heart" iconFill={!!S.quotes.fav[quote.id]} label="Save to favourites" onPress={() => RG.update(s => { s.quotes.fav[quote.id] = !s.quotes.fav[quote.id]; })} />
          <Btn variant="ghost" iconOnly icon="eye-slash" label="Hide this line" onPress={() => { RG.update(s => { s.quotes.hidden[quote.id] = true; }); RG.toast('Line hidden. Restore it in Settings → Motivation.'); }} />
          <Btn variant="ghost" iconOnly icon="arrows-clockwise" label="Another" onPress={() => setQ(x => x + 1)} />
        </Banner>
        <Card gap={4} pad={[14, 18]}>
          <Row style={{ alignItems: 'baseline' }}><CardTitle size={15} style={{ marginRight: 'auto' }}>Upcoming reminders</CardTitle><Btn variant="ghost" size="sm" title="Manage" onPress={() => RG.go('settings', 'reminders')} /></Row>
          {reminders.length ? reminders.map((r, i) => (
            <Row key={i} gap={10} style={{ paddingVertical: 3 }}>
              <Icon name={r.icon} size={14} color={C.n500} />
              <Muted size={13} tab style={{ width: 78 }}>{r.when}</Muted>
              <T size={13} style={{ flex: 1 }}>{r.text}</T>
            </Row>
          )) : <Muted size={13}>Nothing else scheduled today.</Muted>}
        </Card>
      </Grid>

      <Dialog open={dlg === 'weight'} onClose={() => setDlg(null)} title="Log today's weight"
        body="Weigh at the same time each day. The dashboard shows the 7-day average, so one reading won't swing your trend."
        actions={<><Btn title="Cancel" onPress={() => setDlg(null)} /><Btn variant="primary" title="Save" onPress={saveWeight} /></>}>
        <Field label={`Weight (${wu})`}><NumInput value={wInput} onValue={setWInput} size={22} height={52} autoFocus onSubmitEditing={saveWeight} /></Field>
      </Dialog>

      <Dialog open={dlg === 'move'} onClose={() => setDlg(null)} width={520}
        title={`Move ${mv ? RG.workout(mv.workoutId, mv.planId)?.name + ' · ' + RG.fmtD(mv.date) : ''}`}
        body="Choose a new date. Completed sessions can't be moved."
        actions={<><Btn title="Cancel" onPress={() => setDlg(null)} /><Btn variant="primary" title="Move workout" disabled={!moveTo} onPress={confirmMove} /></>}>
        <Grid min={88} gap={6}>
          {moveDays.map(md => {
            const on = moveTo === md.d;
            return (
              <Tap key={md.d} onPress={() => setMoveTo(md.d)} label={md.label}
                style={{ gap: 2, padding: 8, borderRadius: 6, borderWidth: 1, borderColor: on ? C.accent : C.n800, backgroundColor: on ? alpha(C.accent, 0.16) : 'transparent' }}>
                <T size={12}>{md.label}</T>
                <T size={10} color={C.n500} numberOfLines={1}>{md.occ}</T>
              </Tap>
            );
          })}
        </Grid>
        <Check checked={shift} onChange={setShift} label="Shift later workouts: if the new day already has a workout, it moves to the next training day (and so on, only as far as needed). Off: both workouts stay on that day." />
      </Dialog>
    </Screen>
  );
}
