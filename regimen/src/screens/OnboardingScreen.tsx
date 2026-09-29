/* 17. Onboarding (6 steps) — port of prototype/FitOnboarding.dc.html.
   Works from a blank profile (new account: name '', weight/height/age null, empty lists). */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { newUserState } from '@/domain/seed';
import type { Profile, State } from '@/domain/types';
import type { IconName } from '@/ui/icons';
import { useRG } from '@/store/rg';
import { Btn, Card, Field, H, Icon, Input, Muted, NotMedical, NumInput, Row, Rule, Seg, Select, T, Tap } from '@/ui/kit';
import { alpha, C, R } from '@/ui/theme';
import { Grid, Pick, TimeInput } from './prep/ui';
import { Screen } from './Shell';

type N = number | null;
interface Draft {
  name: string; goal: string; weight: N; goalWeight: N; height: N; age: N; sex: string; activity: string; experience: string;
  trainingDays: number[]; duration: N; workoutTime: string; location: string; equipment: string[]; priorities: string[];
  kcal: N; protein: N; carbs: N; fat: N; meals: N; dietPrefs: string[]; allergies: string; exclude: string;
  checkInDay: number; checkInFreq: string; remLead: number; weighTime: string; quietStart: string; quietEnd: string;
}

const TITLES: [string, string][] = [
  ['What are you training for?', 'This shapes the suggested targets. You choose the plan; Regimen organises it.'],
  ['About you', 'Used only to estimate energy needs. Stored privately.'],
  ['Your training week', 'Workouts are placed on these days in rotation order, avoiding back-to-back sessions for the same muscles.'],
  ['Daily targets', 'Start from the estimate or enter your own. Meals are portioned to these numbers.'],
  ['Check-ins & reminders', 'Pick a rhythm you can keep. Every reminder is adjustable later.'],
  ['Review', 'Confirm and save. You can change any of this in Fitness Settings.'],
];
const GOALS: [string, IconName, string][] = [
  ['Fat loss', 'trend-down', 'Moderate deficit, high protein, keep strength'], ['Muscle gain', 'trend-up', 'Small surplus, progressive volume'],
  ['Recomposition', 'arrows-down-up', 'Near maintenance, build while leaning out'], ['Strength', 'barbell', 'Heavier loads, lower reps, longer rests'],
  ['Maintenance', 'equals', 'Hold weight, keep training consistent'], ['General fitness', 'heartbeat', 'Balanced training and energy'],
];
const ADJ: Record<string, number> = { 'Fat loss': -0.18, 'Muscle gain': 0.1, Recomposition: -0.08, Strength: 0.05, Maintenance: 0, 'General fitness': 0 };
const PRIOS = ['Glutes', 'Quads', 'Hamstrings', 'Upper back', 'Chest', 'Shoulders', 'Arms', 'Core', 'Strength on big lifts'];
const csv = (v: string) => v.split(',').map(x => x.trim()).filter(Boolean);
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const hm = (t: number) => { const x = ((t % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

export default function OnboardingScreen() {
  const RG = useRG();
  const P = RG.s.profile; const imp = RG.imp(); const wu = RG.wu(), lu = RG.lu();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [d, setDraft] = useState<Draft>(() => {
    const w = RG.avgWeight() ?? P.weightKg;
    return {
      name: P.name || '', goal: P.goal || 'Fat loss',
      weight: w != null ? Number(RG.bw(w)) : null, goalWeight: P.goalWeightKg ? Number(RG.bw(P.goalWeightKg)) : null,
      height: P.heightCm ? Number(RG.len(P.heightCm)) : null, age: P.age, sex: P.sex || 'Female', activity: P.activity || 'Moderately active', experience: P.experience || 'Intermediate',
      trainingDays: [...(P.trainingDays || [])], duration: P.duration || 60, workoutTime: P.workoutTime || '17:30', location: P.location || 'Gym',
      equipment: [...(P.equipment || [])], priorities: [...(P.priorities || [])],
      kcal: P.kcal, protein: w != null ? Math.round(w * 2.20462) : P.protein, carbs: P.carbs, fat: P.fat, meals: P.mealsPerDay, dietPrefs: [...(P.dietPrefs || [])],
      allergies: (P.allergies || []).join(', '), exclude: (P.exclude || []).join(', '),
      checkInDay: Number(P.checkInDay) || 0, checkInFreq: P.checkInFreq || 'Weekly', remLead: 120, weighTime: '07:15', quietStart: P.quietStart || '22:00', quietEnd: P.quietEnd || '07:00',
    };
  });
  const setD = (patch: Partial<Draft>) => setDraft(x => ({ ...x, ...patch }));
  const set = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setD({ [k]: v } as Partial<Draft>);
  // Protein = 1 g per lb of body weight, recalculated whenever the weight changes.
  const proteinFor = (w: number | null) => (w != null && w > 0 ? Math.round(RG.toKg(w) * 2.20462) : null);
  const setWeight = (w: number | null) => { const pr = proteinFor(w); setD(pr == null ? { weight: w } : { weight: w, protein: pr }); };
  const toggleIn = <K extends 'trainingDays' | 'equipment' | 'priorities' | 'dietPrefs'>(k: K, v: Draft[K][number]) => () =>
    setDraft(x => { const a = x[k] as (string | number)[]; return { ...x, [k]: a.includes(v) ? a.filter(y => y !== v) : a.concat([v]) }; });

  // estimates — Mifflin-St Jeor via RG.bmr / RG.tdee, on a metric copy of the draft
  const kg = d.weight != null ? RG.toKg(d.weight) : null; const cm = d.height != null ? RG.toCm(d.height) : null;
  const est: Profile = { ...P, weightKg: kg, heightCm: cm, age: d.age, sex: d.sex, activity: d.activity, kcal: d.kcal || 0 };
  const bmr = RG.bmr(est); const tdee = RG.tdee(est); const floor = RG.calorieFloor(est);
  const adj = ADJ[d.goal] || 0;
  const sugg = tdee && kg ? (() => {
    const raw = Math.round(tdee * (1 + adj) / 10) * 10; const sK = Math.max(raw, Math.ceil(floor / 10) * 10);
    const sP = Math.round(kg * 2.20462); /* 1 g of protein per lb of body weight */ const sF = Math.round(Math.max(kg * 0.7, sK * 0.25 / 9));
    const sC = Math.max(50, Math.round((sK - sP * 4 - sF * 9) / 4));
    return { sK, sP, sC, sF, clamped: sK > raw };
  })() : null;
  // The target boxes are calculated from the user's details and keep following them (weight, height, age, sex, activity, goal)
  // until the user types their own target. Without height/age, protein is still set to 1 g per lb of weight.
  const [targetsEdited, setTargetsEdited] = useState(false);
  const calcP = kg ? Math.round(kg * 2.20462) : null;
  useEffect(() => {
    if (targetsEdited) return;
    if (sugg) setD({ kcal: sugg.sK, protein: sugg.sP, carbs: sugg.sC, fat: sugg.sF });
    else if (calcP != null) setD({ protein: calcP });
  }, [targetsEdited, sugg?.sK, sugg?.sP, sugg?.sC, sugg?.sF, calcP]); // eslint-disable-line react-hooks/exhaustive-deps
  const setTarget = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => (v: number | null) => { setTargetsEdited(true); setD({ [k]: v } as Partial<Draft>); };
  const suggestNote = sugg && tdee
    ? `Estimated maintenance ≈ ${RG.num(tdee)} kcal (Mifflin-St Jeor × activity). For ${d.goal.toLowerCase()}: ${RG.num(sugg.sK)} kcal · ${sugg.sP} g protein · ${sugg.sC} g carbs · ${sugg.sF} g fat.${sugg.clamped ? ` Raised to your estimated minimum of ${RG.num(floor)} kcal — Regimen doesn't suggest targets below it.` : ''} This is an estimate, not medical advice.`
    : 'Add your weight, height and age (step 2) to get a Mifflin-St Jeor estimate, or enter your own targets below. Estimates are not medical advice.';
  const mk = (d.protein || 0) * 4 + (d.carbs || 0) * 4 + (d.fat || 0) * 9;
  const lowWarn = d.kcal && RG.lowCalorie(est)
    ? `${RG.num(d.kcal)} kcal is below ${bmr ? `the estimated resting need (${RG.num(bmr)} kcal) or ` : ''}a common minimum (${d.sex === 'Male' ? '1,500' : '1,200'} kcal). Regimen won't set targets this low by default; consider a smaller deficit or talk to a qualified professional.` : '';

  const setUnits = (u: 'metric' | 'imperial') => {
    if (u === P.units) return;
    const toImp = u === 'imperial'; const r1 = RG.r1;
    const cw = (v: N) => v == null ? null : r1(toImp ? v * 2.20462 : v / 2.20462);
    setD({ weight: cw(d.weight), goalWeight: cw(d.goalWeight), height: d.height == null ? null : toImp ? r1(d.height / 2.54) : Math.round(d.height * 2.54) });
    RG.update(s => { s.profile.units = u; });
  };

  const wasSample = !!RG.s.sample;
  const save = () => {
    const meals = Math.min(6, Math.max(2, Math.round(d.meals || 4)));
    RG.update(s => {
      // Finishing setup on sample data replaces the demo history with a clean start (units are kept).
      if (s.sample) {
        const fresh = newUserState(RG.TODAY); const units = s.profile.units;
        (Object.keys(fresh) as (keyof State)[]).forEach(k => { (s as unknown as Record<string, unknown>)[k] = fresh[k]; });
        s.profile.units = units; s.sample = false;
      }
      const p = s.profile;
      Object.assign(p, {
        name: d.name.trim(), goal: d.goal, goalWeightKg: d.goalWeight == null ? null : RG.r1(RG.toKg(d.goalWeight)), heightCm: cm == null ? null : Math.round(cm), age: d.age,
        sex: d.sex, activity: d.activity, experience: d.experience,
        trainingDays: d.trainingDays.slice().sort((a, b) => a - b), restDays: [0, 1, 2, 3, 4, 5, 6].filter(x => !d.trainingDays.includes(x)),
        duration: d.duration || 60, workoutTime: d.workoutTime, location: d.location, equipment: d.equipment, priorities: d.priorities,
        kcal: d.kcal || p.kcal, protein: d.protein ?? p.protein, carbs: d.carbs ?? p.carbs, fat: d.fat ?? p.fat, mealsPerDay: meals, dietPrefs: d.dietPrefs,
        allergies: csv(d.allergies), exclude: csv(d.exclude), checkInDay: d.checkInDay, checkInFreq: d.checkInFreq, quietStart: d.quietStart, quietEnd: d.quietEnd, onboarded: true,
      } satisfies Partial<Profile>);
      (['training', 'rest'] as const).forEach(t => { while (s.mealSlots[t].length < meals) s.mealSlots[t].push({ name: 'Meal ' + (s.mealSlots[t].length + 1), label: 'Snack', time: '' }); });
      if (s.distribution.custom.length !== meals) { s.distribution.custom = Array(meals).fill(Math.round(100 / meals)); s.distribution.manual = null; }
      const r1 = s.reminders.find(r => r.id === 'r1') || s.reminders.find(r => r.type === 'Upcoming workout');
      if (r1) { r1.enabled = d.remLead !== 0; if (d.remLead) r1.time = hm(toMin(d.workoutTime) - d.remLead); }
      const r2 = s.reminders.find(r => r.id === 'r2') || s.reminders.find(r => r.type === 'Start workout'); if (r2) r2.time = d.workoutTime;
      const r6 = s.reminders.find(r => r.id === 'r6') || s.reminders.find(r => r.type === 'Weight log'); if (r6) r6.time = d.weighTime;
      Object.keys(s.days).forEach(k => { if (k > RG.TODAY) delete s.days[k]; });
    });
    if (kg != null && kg > 20 && Math.abs(kg - (RG.avgWeight() ?? 0)) > 0.05) RG.logWeight(kg);
    RG.regenerate(RG.TODAY); RG.go('dashboard'); RG.toast(wasSample ? 'Setup saved. Sample data cleared — your history starts today.' : 'Setup saved. Future workouts rescheduled, history kept.');
  };
  const next = () => {
    if (step === 3 && !d.trainingDays.length) return RG.toast('Choose at least one training day.');
    if (step < 6) setStep(step + 1); else save();
  };
  const exploreSample = async () => { setBusy(true); try { await RG.reset(); RG.go('dashboard'); RG.toast('Sample data loaded. When you’re ready, use “Remove sample data & set up my own” in the banner at the top.'); } finally { setBusy(false); } };

  const big = { height: 44, size: 16 } as const;
  const review: [string, string][] = [
    ['Name', d.name.trim() || '—'],
    ['Goal', d.goal],
    ['Body', `${d.weight ?? '—'} ${wu} → ${d.goalWeight ?? '—'} ${wu} · ${d.height ?? '—'} ${lu} · ${d.age ?? '—'} y · ${d.sex}`],
    ['Training', `${d.trainingDays.slice().sort((a, b) => a - b).map(i => RG.DN[i]).join(', ') || '—'} · ${d.duration ?? '—'} min at ${d.workoutTime} · ${d.location}`],
    ['Equipment', d.equipment.join(', ') || '—'], ['Priorities', d.priorities.join(', ') || '—'],
    ['Targets', `${RG.num(d.kcal || 0)} kcal · ${d.protein ?? 0} P · ${d.carbs ?? 0} C · ${d.fat ?? 0} F · ${d.meals ?? '—'} meals`],
    ['Diet', [d.dietPrefs.join(', '), d.allergies && 'allergies: ' + d.allergies, d.exclude && 'exclude: ' + d.exclude].filter(Boolean).join(' · ') || 'No restrictions'],
    ['Check-ins', `${d.checkInFreq} on ${RG.DFULL[d.checkInDay]}`],
    ['Workout reminder', d.remLead ? `${d.remLead >= 60 ? d.remLead / 60 + ' h' : d.remLead + ' min'} before (${hm(toMin(d.workoutTime) - d.remLead)})` : 'Off'],
    ['Quiet hours', `${d.quietStart}–${d.quietEnd}`],
  ];

  return (
    <Screen>
      <View style={{ gap: 18, maxWidth: 760, width: '100%' }}>
        <View style={{ gap: 10 }}>
          <Row gap={10} align="center">
            <Muted style={{ flex: 1 }}>{`Setup · step ${step} of 6 · editable any time in Settings, history is never lost`}</Muted>
            <Btn variant="ghost" size="sm" title="Exit setup" onPress={() => { RG.update(s => { s.profile.onboarded = true; }); RG.go('settings'); }} />
          </Row>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[1, 2, 3, 4, 5, 6].map(i => <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? C.accent : C.n800 }} />)}
          </View>
          <H size={30} style={{ marginTop: 4 }}>{TITLES[step - 1][0]}</H>
          <T size={14} color={C.n400}>{TITLES[step - 1][1]}</T>
        </View>

        {step === 1 && (
          <>
            <Grid min={210} gap={10}>
              {GOALS.map(([l, ic, desc]) => {
                const on = d.goal === l;
                return (
                  <View key={l}>
                  <Tap onPress={() => setD({ goal: l })} label={l}
                    style={st => ({ flexGrow: 1, alignItems: 'flex-start', gap: 6, padding: 16, minHeight: 120, borderRadius: R.md, borderWidth: 1, borderColor: on ? C.accent : 'transparent',
                      backgroundColor: on ? C.a900 : st.hovered ? alpha(C.text, 0.04) : C.surface, boxShadow: on ? undefined : `0 0 0 1px ${C.n800}` })}>
                    <Icon name={ic} size={22} color={C.accent} />
                    <T size={16} w={500}>{l}</T>
                    <T size={12} color={C.n400}>{desc}</T>
                  </Tap>
                  </View>
                );
              })}
            </Grid>
            <Row gap={10} wrap style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: C.n900 }}>
              <Icon name="info" size={16} color={C.n400} />
              <T size={13} color={C.n300} style={{ flex: 1, minWidth: 200 }}>Just looking around? Load the sample data set (six weeks of training, weights and meals) and explore first.</T>
              <Btn icon="play" title={busy ? 'Loading…' : 'Explore with sample data'} disabled={busy} onPress={exploreSample} />
            </Row>
          </>
        )}

        {step === 2 && (
          <>
            <Row gap={8}>
              <T size={13} color={C.n400}>Units</T>
              <Seg value={P.units} options={[{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }]} onChange={setUnits} />
            </Row>
            <Grid min={170} gap={12}>
              <Field label="Name (optional)"><Input value={d.name} onChange={set('name')} {...big} placeholder="What should we call you?" autoComplete="given-name" /></Field>
              <Field label={`Current weight (${wu})`}><NumInput value={d.weight} onValue={setWeight} {...big} /></Field>
              <Field label={`Goal weight (${wu}, optional)`}><NumInput value={d.goalWeight} onValue={set('goalWeight')} {...big} /></Field>
              <Field label={`Height (${lu})`}><NumInput value={d.height} onValue={set('height')} {...big} /></Field>
              <Field label="Age"><NumInput value={d.age} onValue={v => setD({ age: v == null ? null : Math.round(v) })} {...big} /></Field>
              <Field label="Sex (for energy estimates)"><Select value={d.sex} options={['Female', 'Male', 'Prefer not to say']} onChange={set('sex')} height={44} title="Sex" /></Field>
              <Field label="Activity outside training"><Select value={d.activity} options={['Sedentary', 'Lightly active', 'Moderately active', 'Very active']} onChange={set('activity')} height={44} title="Activity outside training" /></Field>
              <Field label="Training experience"><Select value={d.experience} options={['Beginner', 'Intermediate', 'Advanced']} onChange={set('experience')} height={44} title="Training experience" /></Field>
            </Grid>
          </>
        )}

        {step === 3 && (
          <>
            <Field label="Available training days" hint={`Other days become rest days. ${d.trainingDays.length ? `${d.trainingDays.length} training days per week.` : 'Pick at least one day.'}`}>
              <Row gap={6} wrap>{RG.DN.map((l, i) => <Pick key={l} label={l} on={d.trainingDays.includes(i)} onPress={toggleIn('trainingDays', i)} style={{ minHeight: 40, paddingVertical: 9, paddingHorizontal: 14 }} />)}</Row>
            </Field>
            <Grid min={170} gap={12}>
              <Field label="Typical duration (min)"><NumInput value={d.duration} onValue={set('duration')} height={44} /></Field>
              <Field label="Preferred workout time"><TimeInput value={d.workoutTime} onChange={set('workoutTime')} height={44} /></Field>
              <Field label="Where"><Select value={d.location} options={['Gym', 'Home', 'Both']} onChange={set('location')} height={44} title="Where" /></Field>
            </Grid>
            <Field label="Available equipment">
              <Row gap={6} wrap>{['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight'].map(l => <Pick key={l} label={l} on={d.equipment.includes(l)} onPress={toggleIn('equipment', l)} style={{ minHeight: 40, paddingVertical: 9, paddingHorizontal: 14 }} />)}</Row>
            </Field>
            <Field label="Priorities">
              <Row gap={6} wrap>{PRIOS.map(l => <Pick key={l} label={l} on={d.priorities.includes(l)} onPress={toggleIn('priorities', l)} style={{ minHeight: 40, paddingVertical: 9, paddingHorizontal: 14 }} />)}</Row>
            </Field>
          </>
        )}

        {step === 4 && (
          <>
            <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: C.n900, gap: 6 }}>
              <T size={13} color={C.n300}>{suggestNote}</T>
              {sugg && <Row><Btn variant="ghost" size="sm" title="Use suggestion" onPress={() => { setTargetsEdited(false); setD({ kcal: sugg.sK, protein: sugg.sP, carbs: sugg.sC, fat: sugg.sF }); }} /></Row>}
            </View>
            <Grid min={140} gap={12}>
              <Field label="Calories (kcal)"><NumInput value={d.kcal} onValue={setTarget('kcal')} {...big} /></Field>
              <Field label="Protein (g)"><NumInput value={d.protein} onValue={setTarget('protein')} {...big} /></Field>
              <Field label="Carbohydrates (g)"><NumInput value={d.carbs} onValue={setTarget('carbs')} {...big} /></Field>
              <Field label="Fat (g)"><NumInput value={d.fat} onValue={setTarget('fat')} {...big} /></Field>
              <Field label="Meals per day"><NumInput value={d.meals} onValue={set('meals')} {...big} /></Field>
            </Grid>
            <T size={12} color={C.n400}>{`Macros add up to ${RG.num(mk)} kcal (${mk - (d.kcal || 0) >= 0 ? '+' : ''}${RG.num(mk - (d.kcal || 0))} vs calorie target). Small gaps are normal rounding.`}</T>
            {!!lowWarn && (
              <Row gap={8} align="flex-start" style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: R.md, boxShadow: `inset 0 0 0 1px ${C.a700}` }}>
                <Icon name="warning" size={16} color={C.accent} style={{ marginTop: 2 }} />
                <T size={13} style={{ flex: 1 }}>{lowWarn}</T>
              </Row>
            )}
            <Field label="Dietary preferences">
              <Row gap={6} wrap>{['Dairy-free', 'Gluten-free', 'Vegetarian', 'Vegan'].map(l => <Pick key={l} label={l} on={d.dietPrefs.includes(l)} onPress={toggleIn('dietPrefs', l)} style={{ minHeight: 40, paddingVertical: 9, paddingHorizontal: 14 }} />)}</Row>
            </Field>
            <Grid min={220} gap={12}>
              <Field label="Allergies (comma separated)"><Input value={d.allergies} onChange={set('allergies')} placeholder="e.g. peanut, shellfish" /></Field>
              <Field label="Foods to exclude"><Input value={d.exclude} onChange={set('exclude')} placeholder="e.g. pork" /></Field>
            </Grid>
            <NotMedical text={RG.NOT_MEDICAL} />
          </>
        )}

        {step === 5 && (
          <Grid min={180} gap={12}>
            <Field label="Check-in day"><Select<number> value={d.checkInDay} options={RG.DFULL.map((l, i) => ({ value: i, label: l }))} onChange={set('checkInDay')} height={44} title="Check-in day" /></Field>
            <Field label="Check-in frequency"><Select value={d.checkInFreq} options={['Weekly', 'Biweekly', 'Monthly']} onChange={set('checkInFreq')} height={44} title="Check-in frequency" /></Field>
            <Field label="Workout reminder"><Select<number> value={d.remLead} options={[{ value: 30, label: '30 min before' }, { value: 60, label: '1 h before' }, { value: 120, label: '2 h before' }, { value: 0, label: 'Off' }]} onChange={set('remLead')} height={44} title="Workout reminder" /></Field>
            <Field label="Weigh-in reminder"><TimeInput value={d.weighTime} onChange={set('weighTime')} height={44} /></Field>
            <Field label="Quiet hours from"><TimeInput value={d.quietStart} onChange={set('quietStart')} height={44} /></Field>
            <Field label="Quiet hours until"><TimeInput value={d.quietEnd} onChange={set('quietEnd')} height={44} /></Field>
          </Grid>
        )}

        {step === 6 && (
          <>
            <Card gap={0}>
              {review.map(([k, v]) => (
                <View key={k}>
                  <Rule />
                  <Row gap={12} align="flex-start" style={{ paddingVertical: 6 }}>
                    <T size={14} color={C.n500} style={{ width: 160, flexShrink: 0 }}>{k}</T>
                    <T size={14} style={{ flex: 1 }}>{v}</T>
                  </Row>
                </View>
              ))}
            </Card>
            {wasSample
              ? <Muted>You're currently looking at sample data. Saving clears all of it (the demo weigh-ins, workouts, check-ins, meals and recipes) and starts your own history from today. Targets are planning estimates, not medical advice.</Muted>
              : <Muted>Saving updates your profile and reschedules future workouts from today in rotation order. Logged workouts, check-ins, photos and nutrition history are kept. Targets are planning estimates, not medical advice.</Muted>}
          </>
        )}

        <Row gap={8} style={{ justifyContent: 'space-between', paddingTop: 6 }}>
          <Btn title="Back" disabled={step === 1} onPress={() => setStep(Math.max(1, step - 1))} style={{ minHeight: 44 }} />
          <Btn variant="primary" title={step < 6 ? 'Continue' : 'Save & build schedule'} onPress={next} style={{ minHeight: 44, paddingHorizontal: 22 }} />
        </Row>
      </View>
    </Screen>
  );
}
