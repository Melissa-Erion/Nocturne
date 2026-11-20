/* Today tab: today's workout, food left today with the next meal, quick logging (weight, water, photo). */
import { useState } from 'react';
import { track } from '@/lib/track';
import { View } from 'react-native';
import { useRG } from '@/store/rg';
import type { IconName } from '@/ui/icons';
import {
  Banner, Bar, Btn, Card, CardTitle, Check, ColLabel, Dialog, Field, Grid, H, HeroCard, Icon, Kicker, Muted,
  Num, NumInput, Row, RuledRow, T, Tag, Tap,
} from '@/ui/kit';
import { alpha, C } from '@/ui/theme';
import { Screen } from './Shell';
import { useAccess } from '@/store/access';
import { ExtrasList, LogExtraDialog } from './eat/LogExtra';

export default function DashboardScreen() {
  const RG = useRG();
  const { full } = useAccess();
  const [q, setQ] = useState(0);
  const [dlg, setDlg] = useState<null | 'weight' | 'move' | 'extra'>(null);
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

  // nutrition
  const day = RG.getDay(T0); const tot = RG.dayTotals(T0); const tgs = RG.mealTargets(day.type);
  const DT = RG.dayTargets(T0);
  // motivation line
  const quote = RG.todayQuote(q);
  const hour = new Date().getHours();
  const greeting = `Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}${P.name ? ', ' + P.name : ''}`;
  const nx = RG.nextEntry(T0);
  const shift = shiftOverride ?? P.shiftLater;
  const mv = moveTarget;
  const moveDays = mv ? Array.from({ length: 12 }, (_, i) => RG.add(T0, i)).filter(d => d !== mv.date).map(d => {
    const os = S.schedule.filter(e => e.date === d && e.status === 'planned' && e.id !== mv.id);
    return { d, label: RG.fmtD(d), occ: os.length > 1 ? `${os.length} workouts` : os.length ? (RG.workout(os[0].workoutId, os[0].planId)?.name || '').replace(' Body ', ' ') : RG.inPause(d) ? 'Paused' : 'Free' };
  }) : [];

  const openMove = (id?: string) => { if (!full) return RG.go('schedule'); if (!id && !(entry && entry.status === 'planned') && !RG.nextEntry(T0)) return RG.toast('No upcoming workout to move.'); setMoveId(id || null); setMoveTo(null); setShift(null); setDlg('move'); };
  const saveWeight = () => { const v = wInput; if (!(v != null && v > 20)) return; RG.logWeight(RG.toKg(v)); setDlg(null); RG.toast(`Weight logged: ${v} ${wu}. The 7-day average is updated.`); };
  const confirmMove = () => {
    if (!moveTo || !mv) return;
    const r = RG.moveEntry(mv.id, moveTo, shift); setDlg(null);
    RG.toast(r.error || [`Moved to ${RG.fmtD(moveTo)}.`, r.note, r.warning].filter(Boolean).join(' '));
  };

  // food left today, and the next meal not yet eaten
  const left = (t: number, got: number) => Math.round(t - got);
  const macros: [string, number, number][] = [['Protein', DT.protein, tot.logged.p], ['Carbs', DT.carbs, tot.logged.c], ['Fat', DT.fat, tot.logged.f]];
  const nextI = day.meals.findIndex(m => !m.logged);
  const nextM = nextI >= 0 ? day.meals[nextI] : null; const nextT = nextI >= 0 ? tgs[nextI] : null; const nextSum = nextM ? RG.sumM(nextM.items) : null;
  const nextFoods = nextM ? nextM.items.map(x => RG.food(x.foodId)?.name.split(',')[0]).filter(Boolean).join(', ') : '';
  const logMeal = (i: number) => {
    RG.update(s => { s.days[T0].meals[i].logged = true; }); track('meal_eaten', { from: 'today' });
    RG.toast(`${tgs[i]?.name || 'Meal'} marked as eaten.`, true);
  };
  const water = day.water || 0;
  // automatic calorie review (Pro): shown every two weeks once there are enough weigh-ins
  const advice = full && RG.calorieReviewDue() ? RG.calorieAdvice() : null;
  const showAdvice = !!advice && advice.status !== 'not-enough-data';
  const kgWk = (v: number) => `${v < 0 ? '−' : '+'}${RG.imp() ? Math.abs(v * 2.20462).toFixed(1) : Math.abs(v).toFixed(2)} ${wu}/week`;
  const openWeight = () => { setWInput(S.weights.length ? Number(RG.w(S.weights[S.weights.length - 1].kg)) : null); setDlg('weight'); };

  return (
    <Screen>
      <View>
        <Muted>{`${RG.DFULL[RG.dow(T0)]}, ${Number(T0.slice(8))} ${RG.MFULL[Number(T0.slice(5, 7)) - 1]}`}</Muted>
        <H size={28} style={{ marginTop: 2 }}>{greeting}</H>
      </View>

      {pause && (
        <Banner>
          <Icon name="pause-circle" size={20} color={C.accent} />
          <T size={14} style={{ flex: 1, minWidth: 200 }}>{`Schedule paused since ${RG.fmtD(pause.from)} · ${pause.reason}. Your rotation is saved and resumes with the next workout in order.`}</T>
          <Btn variant="primary" title="Resume schedule" onPress={() => { RG.resume(); RG.toast('Schedule resumed — rotation picks up where it left off.'); }} />
        </Banner>
      )}

      <Grid min={400}>
        <HeroCard style={{ flexGrow: 1 }}>
          {todays_.length ? todays_.map(({ e: en, w: tw }, ti) => {
            const exs = exercisesOf(tw);
            return (
              <View key={en.id} style={{ gap: 12, paddingTop: ti ? 18 : 0, borderTopWidth: ti ? 1 : 0, borderColor: C.divider }}>
                <View>
                  <Kicker>{`${todays_.length > 1 ? `Workout ${ti + 1} of ${todays_.length}` : 'Workout'} · ${RG.clock(RG.timeOn(RG.TODAY))} · ~${P.duration} min`}</Kicker>
                  <H size={30} style={{ marginTop: 6 }}>{tw.name}</H>
                  <T size={13} color={C.n400} style={{ marginTop: 4 }}>{`${tw.focus} · ${tw.items.reduce((a, i) => a + i.sets, 0)} working sets`}</T>
                </View>
                {en.status === 'planned' && !pause && (
                  <Btn variant="primary" size="lg" block icon="play" iconFill title={S.active && S.active.entryId === en.id ? 'Resume workout' : 'Start workout'} onPress={() => full ? RG.startWorkout(en.id) : RG.go('workout')} />
                )}
                <View>
                  {exs.slice(0, 4).map(ex => (
                    <RuledRow key={ex.key} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 9 }}>
                      <T size={14} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{ex.name}</T>
                      <Row gap={6} style={{ flexShrink: 0 }}>
                        <Icon name={ex.icon} size={14} color={ex.color} />
                        {full ? <T size={13} tab color={C.n200}>{ex.next}</T> : <Row gap={4}><Icon name="lock-simple" size={12} color={C.n500} /><T size={12} color={C.n500}>Pro</T></Row>}
                      </Row>
                    </RuledRow>
                  ))}
                  <Muted size={11} style={{ marginTop: 6 }}>{`${exs.length > 4 ? `and ${exs.length - 4} more · ` : ''}Next target for each exercise, worked out from your last session.`}</Muted>
                </View>
                {en.status === 'done' && <Tag variant="accent" icon="check-circle">Done today</Tag>}
                {en.status === 'planned' && (
                  <Row gap={8} wrap>
                    <Btn icon="calendar-blank" title="Move to another day" onPress={() => openMove(en.id)} />
                    <Btn icon="skip-forward" title="Skip" onPress={() => { RG.skipEntry(en.id); RG.toast(`${tw.name} skipped. The rotation continues with the next workout.`); }} />
                  </Row>
                )}
              </View>
            );
          }) : (
            <>
              <Kicker>Today</Kicker>
              <H size={30}>Rest day</H>
              <T size={14} color={C.n400}>{nx ? `Next workout: ${RG.workout(nx.workoutId, nx.planId)?.name} · ${RG.fmtD(nx.date)}` : 'No upcoming workouts.'}</T>
              <Row gap={8} wrap>
                <Btn title="Open schedule" onPress={() => RG.go('schedule')} />
                {nx && <Btn variant="ghost" icon="calendar-blank" title="Move next workout" onPress={() => openMove(nx.id)} />}
              </Row>
            </>
          )}
        </HeroCard>

        <Card>
          <Row style={{ alignItems: 'baseline' }}>
            <CardTitle style={{ marginRight: 'auto' }}>Food left today</CardTitle>
            <Btn variant="ghost" size="sm" title="Open Eat" iconRight="arrow-right" onPress={() => RG.go('meals')} />
          </Row>
          <Row gap={8} style={{ alignItems: 'baseline' }} wrap>
            <Num size={40}>{RG.num(Math.abs(left(DT.kcal, tot.logged.kcal)))}</Num>
            <T size={14} color={C.n400}>{left(DT.kcal, tot.logged.kcal) >= 0 ? `kcal left of ${RG.num(DT.kcal)}` : `kcal over ${RG.num(DT.kcal)}`}</T>
          </Row>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {macros.map(([k, t, got]) => (
              <View key={k} style={{ flex: 1, minWidth: 0, gap: 5 }}>
                <Muted size={12}>{k}</Muted>
                <Bar fills={[{ pct: t ? got / t * 100 : 0, color: k === 'Protein' ? C.a400 : C.n400 }]} />
                <T size={13} w={600} tab>{left(t, got) >= 0 ? `${left(t, got)} g left` : `${-left(t, got)} g over`}</T>
              </View>
            ))}
          </View>
          <View style={{ height: 1, backgroundColor: C.divider }} />
          {nextM && nextT && nextSum ? (
            <Row gap={10}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Muted size={12}>{`Next · ${RG.clock(nextT.time)}`}</Muted>
                <T size={15} w={600} numberOfLines={1}>{nextT.name}{nextT.label ? <T size={15} color={C.n400}>{` · ${nextT.label}`}</T> : null}</T>
                <Muted size={12} numberOfLines={1}>{nextFoods ? `${nextFoods} · ${RG.num(nextSum.kcal)} kcal · ${Math.round(nextSum.p)} g protein` : 'Nothing planned yet'}</Muted>
              </View>
              {nextM.items.length
                ? <Btn icon="check-circle" title="Ate it" onPress={() => logMeal(nextI)} />
                : <Btn title="Plan it" onPress={() => RG.go('meals')} />}
            </Row>
          ) : (
            <Row gap={8}><Icon name="check-circle" fill size={16} color={C.accent} /><T size={14}>All of today's meals are marked as eaten.</T></Row>
          )}
          <ExtrasList date={T0} />
          <Btn variant="ghost" icon="plus-circle" title="Log something else" onPress={() => setDlg('extra')} style={{ alignSelf: 'flex-start' }} />
        </Card>
      </Grid>

      {showAdvice && advice && (
        <Card gap={10}>
          <Row gap={8}><Icon name="scales" size={18} color={C.accent} /><CardTitle style={{ flex: 1 }}>Your 2-week calorie check</CardTitle></Row>
          <T size={14} lh={1.45}>
            {`Your weight trend is ${kgWk(advice.rateKg || 0)}. For ${P.goal.toLowerCase()} we aim for about ${Math.abs(advice.aimKg) < 0.01 ? 'no change' : kgWk(advice.aimKg)}. `}
            {advice.status === 'on-track' ? "You're right on track, so your calories stay the same."
              : advice.status === 'at-floor' ? "Your calories are already at the safe minimum, so we won't lower them further. Adding a short daily walk or an extra session is the better lever."
              : advice.change < 0 ? `Lowering your daily calories by ${Math.abs(advice.change)} (to ${RG.num(advice.newKcal)} kcal) should get you there. Protein stays the same.`
              : `Raising your daily calories by ${advice.change} (to ${RG.num(advice.newKcal)} kcal) is a healthier pace. Protein stays the same.`}
          </T>
          <Row gap={8} wrap>
            {advice.status === 'adjust' ? (
              <>
                <Btn variant="primary" title={`${advice.change < 0 ? 'Lower' : 'Raise'} to ${RG.num(advice.newKcal)} kcal`} onPress={() => { RG.applyCalorieChange(advice.change); RG.toast(`Daily calories set to ${RG.num(advice.newKcal)} kcal. Your planned meals were re-portioned.`, false); }} />
                <Btn title="Not now" onPress={() => { RG.snoozeCalorieReview(7); RG.toast("We'll check again in a week.", false); }} />
              </>
            ) : <Btn title="Got it" onPress={() => RG.snoozeCalorieReview(14)} />}
          </Row>
          <Muted size={11}>{`Based on ${advice.weighIns} weigh-ins over ${advice.days} days.${advice.status === 'adjust' ? " If you haven't been following your meals closely, choose Not now and check again next week." : ''} Not medical advice.`}</Muted>
        </Card>
      )}

      <View style={{ gap: 8 }}>
        <ColLabel>Quick log</ColLabel>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <QuickBtn icon="scales" label="Weight" onPress={openWeight} />
          {P.water && <QuickBtn icon="drop" label={`Water +250 ml · ${+(water / 1000).toFixed(2)} L today`} onPress={() => { RG.update(s => { s.days[T0].water = (s.days[T0].water || 0) + 250; }); RG.toast('250 ml of water added.', true); }} />}
          <QuickBtn icon="camera" label="Photo" onPress={() => RG.go('photos')} />
        </View>
      </View>

      <Banner gradient>
        <Icon name="quotes" size={26} color={C.accent} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={16} lh={1.4}>{quote.text}</T>
          <Muted size={11} style={{ marginTop: 4 }}>{`Today's line · ${quote.tone}`}</Muted>
        </View>
        <Btn variant="ghost" iconOnly icon="heart" iconFill={!!S.quotes.fav[quote.id]} label="Save to favourites" onPress={() => RG.update(s => { s.quotes.fav[quote.id] = !s.quotes.fav[quote.id]; })} />
        <Btn variant="ghost" iconOnly icon="arrows-clockwise" label="Another" onPress={() => setQ(x => x + 1)} />
      </Banner>

      <LogExtraDialog open={dlg === 'extra'} onClose={() => setDlg(null)} date={T0} />

      <Dialog open={dlg === 'weight'} onClose={() => setDlg(null)} title="Log today's weight"
        body="Weigh at the same time each day. Progress › Analytics shows the 7-day average, so one reading won't swing your trend."
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

function QuickBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} label={label}
      style={({ hovered }: { hovered?: boolean }) => ({ flex: 1, minWidth: 0, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 8, borderRadius: 12,
        backgroundColor: hovered ? C.n800 : C.surface, borderWidth: 1, borderColor: C.n800 })}>
      <Icon name={icon} size={20} color={C.a400} />
      <T size={12} numberOfLines={2} style={{ textAlign: 'center' }}>{label}</T>
    </Tap>
  );
}
