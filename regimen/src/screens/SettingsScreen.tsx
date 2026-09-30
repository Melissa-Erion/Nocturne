/* 16. Fitness Settings — port of prototype/FitSettings.dc.html */
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import type { DayType, Profile } from '@/domain/types';
import { requestCalendarPermission } from '@/lib/calendar';
import { saveTextFile } from '@/lib/files';
import { requestNotificationPermission } from '@/lib/notifications';
import { useRG } from '@/store/rg';
import { useUI } from '@/store/store';
import {
  Btn, Card, Check, Dialog, Field, H, Icon, Input, Muted, NotMedical, NumInput, Row, Rule, Seg, Select, T, Tag,
} from '@/ui/kit';
import { C, R } from '@/ui/theme';
import { Grid, Pick, Table, TimeInput } from './prep/ui';
import { Screen } from './Shell';
import { RemoveSampleButton } from './SampleData';
import { useAccess } from '@/store/access';
import { CalendarSyncDialog } from './CalendarSync';
import { startTour } from './Tour';

type Tab = 'profile' | 'training' | 'nutrition' | 'reminders' | 'motivation' | 'data';
const TABS: { value: Tab; label: string }[] = [
  { value: 'profile', label: 'Profile & goal' }, { value: 'training', label: 'Training' }, { value: 'nutrition', label: 'Nutrition' },
  { value: 'reminders', label: 'Reminders' }, { value: 'motivation', label: 'Motivation' }, { value: 'data', label: 'Data & privacy' },
];
const isTab = (v: unknown): v is Tab => TABS.some(t => t.value === v);
type DelKind = 'sessions' | 'checkins' | 'nutrition' | 'weights';
const DEL_KINDS: [DelKind, string][] = [['sessions', 'Workout history'], ['checkins', 'Check-ins & photos'], ['nutrition', 'Nutrition logs'], ['weights', 'Weight log']];
const csv = (v: string) => v.split(',').map(x => x.trim()).filter(Boolean);

export default function SettingsScreen() {
  const RG = useRG();
  const routeParam = useUI(u => u.routeParam);
  const email = useUI(u => u.email);
  const mode = useUI(u => u.mode);
  const [tab, setTab] = useState<Tab>(() => (isTab(routeParam) ? routeParam : 'profile'));
  useEffect(() => { if (isTab(routeParam)) setTab(routeParam); }, [routeParam]);
  const [ownQ, setOwnQ] = useState('');
  const [del, setDel] = useState<Partial<Record<DelKind, boolean>>>({});
  const [delText, setDelText] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [dlgCal, setDlgCal] = useState(false);
  const access = useAccess();
  const [allergies, setAllergies] = useState<string | null>(null);
  const [exclude, setExclude] = useState<string | null>(null);

  const S = RG.s, P = S.profile, wu = RG.wu(), lu = RG.lu();
  const up = (fn: (p: Profile) => void) => RG.update(s => fn(s.profile));
  const setK = <K extends keyof Profile>(k: K) => (v: Profile[K]) => up(p => { p[k] = v; });
  const num = <K extends 'age' | 'duration' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'waterMl'>(k: K) => (v: number | null) => { if (v != null || k === 'age') up(p => { (p as unknown as Record<string, number | null>)[k] = v; }); };
  const inList = (k: 'equipment' | 'dietPrefs', v: string) => () => up(p => { p[k] = p[k].includes(v) ? p[k].filter(x => x !== v) : p[k].concat([v]); });

  // nutrition safety
  const RT = P.restTargets ?? null;
  const macroNote = (t: { kcal: number; protein: number; carbs: number; fat: number }) => { const mk = t.protein * 4 + t.carbs * 4 + t.fat * 9; return `Macros add up to ${RG.num(mk)} kcal (${mk - t.kcal >= 0 ? '+' : ''}${mk - t.kcal} vs target).`; };
  const safetyP = { ...P, weightKg: RG.avgWeight() ?? P.weightKg };
  const floor = RG.calorieFloor(safetyP);
  const lowTrain = P.kcal < floor, lowRest = !!RT && RT.kcal < floor;
  const lowWhat = lowTrain && lowRest ? `Your training-day (${RG.num(P.kcal)} kcal) and rest-day (${RG.num(RT.kcal)} kcal) targets are` : lowRest && RT ? `Your rest-day target of ${RG.num(RT.kcal)} kcal is` : RT ? `Your training-day target of ${RG.num(P.kcal)} kcal is` : `${RG.num(P.kcal)} kcal is`;
  const lowWarn = RG.lowCalorie(safetyP) ? `${lowWhat} below your estimated minimum (~${RG.num(floor)} kcal: the higher of your estimated resting need and ${P.sex === 'Male' ? '1,500' : '1,200'} kcal). Regimen doesn't recommend targets this low. Consider a smaller deficit, and consult a qualified professional for anything more aggressive.` : '';
  const setRest = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => (v: number | null) => { if (v != null) up(p => { if (p.restTargets) p.restTargets[k] = v; }); };
  const toggleRest = (on: boolean) => up(p => { p.restTargets = on ? { kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat } : null; });

  const toggleDay = (i: number) => {
    up(p => { p.trainingDays = p.trainingDays.includes(i) ? p.trainingDays.filter(x => x !== i) : p.trainingDays.concat([i]).sort((a, b) => a - b); p.restDays = [0, 1, 2, 3, 4, 5, 6].filter(x => !p.trainingDays.includes(x)); });
    RG.regenerate(RG.TODAY); RG.toast('Training days updated. Future workouts rescheduled in rotation order.');
  };
  const toggleCalendar = async () => {
    if (P.calendarSync) return up(p => { p.calendarSync = false; });
    const ok = await requestCalendarPermission();
    if (!ok) return RG.toast('Calendar access was not granted. You can allow it in your device settings.');
    up(p => { p.calendarSync = true; }); RG.toast('Workouts will appear in a "Regimen" calendar on this device.');
  };
  const setMeals = (n: number | null) => {
    if (n == null) return; const v = Math.min(6, Math.max(2, Math.round(n)));
    RG.update(s => {
      s.profile.mealsPerDay = v;
      (['training', 'rest'] as DayType[]).forEach(t => { while (s.mealSlots[t].length < v) s.mealSlots[t].push({ name: 'Meal ' + (s.mealSlots[t].length + 1), label: 'Snack', time: '' }); });
      s.distribution.custom = Array(v).fill(Math.round(100 / v)); s.distribution.manual = null;
    });
  };
  const enableNotifications = async () => {
    const ok = await requestNotificationPermission();
    RG.toast(ok ? 'Notifications enabled. Reminders are scheduled on this device.' : 'Notifications were not allowed. You can turn them on in your device settings.');
  };

  const quotes = RG.quoteList();
  const addQ = () => { const t = ownQ.trim(); if (!t) return; RG.update(s => { s.quotes.custom.push({ id: 'c' + RG.uid(), text: t, tone: 'Your own' }); }); setOwnQ(''); };

  const exportData = async () => { await saveTextFile('regimen-export.json', JSON.stringify(S, null, 2), 'application/json'); };
  const resetDemo = async () => { setConfirmReset(false); await RG.reset(); RG.toast('Sample data restored.'); };
  const delReady = delText.trim() === 'DELETE' && Object.values(del).some(Boolean);
  const doDelete = () => {
    const d = del; const photoKeys = d.checkins ? S.checkins.flatMap(c => Object.keys(S.photos).filter(k => k.startsWith(c.id + ':'))) : [];
    RG.update(s => {
      if (d.sessions) { s.sessions = []; s.schedule = s.schedule.filter(e => e.status === 'planned'); }
      if (d.checkins) s.checkins = [];
      if (d.nutrition) s.nutritionLog = {};
      if (d.weights) s.weights = s.weights.slice(-1);
    });
    photoKeys.forEach(k => { RG.setPhoto(k, null); });
    setDel({}); setDelText(''); RG.toast('Selected history deleted.');
  };

  const reminderRows = S.reminders.map((r, i) => {
    const u = (fn: (x: typeof r) => void) => RG.update(s => { const x = s.reminders[i]; if (x) fn(x); });
    return {
      key: r.id,
      cells: [
        <Check key="on" checked={r.enabled} onChange={() => u(x => { x.enabled = !x.enabled; })} />,
        <T key="t" size={14}>{r.type}</T>,
        <TimeInput key="tm" value={r.time} onChange={v => u(x => { x.time = v; })} style={{ width: 110 }} />,
        <Input key="f" value={r.freq} onChange={v => u(x => { x.freq = v; })} style={{ minWidth: 150 }} />,
        <Select key="c" value={r.channel} options={['Push', 'Email', 'Push + email', 'In-app only']} onChange={v => u(x => { x.channel = v; })} title="Channel" />,
        <Select<number> key="s" value={r.snooze} options={[{ value: 0, label: 'None' }, { value: 10, label: '10 min' }, { value: 15, label: '15 min' }, { value: 30, label: '30 min' }, { value: 60, label: '1 h' }]} onChange={v => u(x => { x.snooze = v; })} title="Snooze" />,
        <Check key="r" checked={r.reschedule} onChange={() => u(x => { x.reschedule = !x.reschedule; })} />,
      ],
    };
  });

  return (
    <Screen>
      <View style={{ gap: 16, maxWidth: 1000, width: '100%' }}>
        <Row gap={12} wrap align="flex-end">
          <View style={{ marginRight: 'auto' }}>
            <Muted>Changes save instantly. History is never overwritten.</Muted>
            <H size={28} style={{ marginTop: 2 }}>Fitness Settings</H>
          </View>
          <Btn icon="compass" title="Replay app tour" onPress={startTour} />
          <Btn variant="primary" icon="magic-wand" title="Run guided setup" onPress={() => RG.go('onboarding')} />
        </Row>
        <Seg<Tab> value={tab} onChange={setTab} options={TABS} style={{ flexWrap: 'wrap' }} />

        {tab === 'profile' && (
          <Card gap={12}>
            <Grid min={180} gap={12}>
              <Field label="Name"><Input value={P.name} onChange={setK('name')} /></Field>
              <Field label="Primary goal"><Select value={P.goal} options={['Fat loss', 'Muscle gain', 'Recomposition', 'Strength', 'Maintenance', 'General fitness']} onChange={setK('goal')} title="Primary goal" /></Field>
              <Field label={`Goal weight (${wu})`}><NumInput value={P.goalWeightKg ? RG.bw(P.goalWeightKg) : null} onValue={v => up(p => { p.goalWeightKg = v == null ? null : RG.r1(RG.toKg(v)); })} /></Field>
              <Field label={`Height (${lu})`}><NumInput value={P.heightCm ? RG.len(P.heightCm) : null} onValue={v => up(p => { p.heightCm = v == null ? null : Math.round(RG.toCm(v)); })} /></Field>
              <Field label="Age"><NumInput value={P.age} onValue={num('age')} /></Field>
              <Field label="Sex"><Select value={P.sex} options={['Female', 'Male', 'Prefer not to say']} onChange={setK('sex')} title="Sex" /></Field>
              <Field label="Activity level"><Select value={P.activity} options={['Sedentary', 'Lightly active', 'Moderately active', 'Very active']} onChange={setK('activity')} title="Activity level" /></Field>
              <Field label="Experience"><Select value={P.experience} options={['Beginner', 'Intermediate', 'Advanced']} onChange={setK('experience')} title="Experience" /></Field>
              <Field label="Units"><Seg value={P.units} options={[{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }]} onChange={setK('units')} /></Field>
            </Grid>
            <Muted>{`Current weight comes from your weight log (7-day average: ${RG.bw(RG.avgWeight())} ${wu}). Calculations always run in metric.`}</Muted>
          </Card>
        )}

        {tab === 'training' && (
          <Card gap={14}>
            <Field label="Training days · the rest become rest days">
              <Row gap={6} wrap>{RG.DN.map((l, i) => <Pick key={l} label={l} on={P.trainingDays.includes(i)} onPress={() => toggleDay(i)} />)}</Row>
            </Field>
            <Grid min={170} gap={12}>
              <Field label="Workout duration (min)"><NumInput value={P.duration} onValue={num('duration')} /></Field>
              <Field label="Workout time"><TimeInput value={P.workoutTime} onChange={setK('workoutTime')} /></Field>
              <Field label="Location"><Select value={P.location} options={['Gym', 'Home', 'Both']} onChange={setK('location')} title="Location" /></Field>
              <Field label="Progression rule"><Select value={P.progression} options={[{ value: 'double', label: 'Double progression (reps, then load)' }, { value: 'linear', label: 'Linear (add load when min reps hit)' }]} onChange={setK('progression')} title="Progression rule" /></Field>
            </Grid>
            <Field label="Equipment">
              <Row gap={6} wrap>{['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight'].map(l => <Pick key={l} label={l} on={P.equipment.includes(l)} onPress={inList('equipment', l)} />)}</Row>
            </Field>
            <Field label={`Smallest available weight increments (${wu})`}>
              <Grid min={120} gap={8}>
                {['Barbell', 'Dumbbell', 'Cable', 'Machine'].map(l => (
                  <View key={l} style={{ gap: 3 }}>
                    <Muted size={11}>{l}</Muted>
                    <NumInput value={RG.w(P.increments[l])} onValue={v => { if (v != null) up(p => { p.increments[l] = RG.r1(RG.toKg(v)); }); }} />
                  </View>
                ))}
              </Grid>
            </Field>
            <Check checked={P.shiftLater} onChange={v => up(p => { p.shiftLater = v; })} label="When a workout moves, shift later workouts to keep the order" />
            {Platform.OS !== 'web' && <Check checked={P.calendarSync} onChange={toggleCalendar} label="Show workouts in this phone's calendar" />}
            <Row gap={10} wrap>
              <Btn icon="calendar-check" title="Sync to Google, Outlook or Apple Calendar" onPress={() => (access.full ? setDlgCal(true) : RG.go('schedule'))} />
            </Row>
          </Card>
        )}

        {tab === 'nutrition' && (
          <Card gap={12}>
            <T size={13}>Training days</T>
            <Grid min={140} gap={12}>
              <Field label="Calories"><NumInput value={P.kcal} onValue={num('kcal')} /></Field>
              <Field label="Protein g"><NumInput value={P.protein} onValue={num('protein')} /></Field>
              <Field label="Carbs g"><NumInput value={P.carbs} onValue={num('carbs')} /></Field>
              <Field label="Fat g"><NumInput value={P.fat} onValue={num('fat')} /></Field>
            </Grid>
            <T size={12} color={C.n400}>{macroNote(P)}</T>
            <Check checked={!!RT} onChange={toggleRest} label="Use different targets on rest days" />
            {RT ? (
              <>
                <T size={13}>Rest days</T>
                <Grid min={140} gap={12}>
                  <Field label="Calories"><NumInput value={RT.kcal} onValue={setRest('kcal')} /></Field>
                  <Field label="Protein g"><NumInput value={RT.protein} onValue={setRest('protein')} /></Field>
                  <Field label="Carbs g"><NumInput value={RT.carbs} onValue={setRest('carbs')} /></Field>
                  <Field label="Fat g"><NumInput value={RT.fat} onValue={setRest('fat')} /></Field>
                </Grid>
                <T size={12} color={C.n400}>{macroNote(RT)}</T>
              </>
            ) : <Muted>Off: rest days use the same targets as training days.</Muted>}
            <Grid min={140} gap={12}>
              <Field label="Meals per day"><NumInput value={P.mealsPerDay} onValue={setMeals} /></Field>
              <Field label="Water target (ml)"><NumInput value={P.waterMl} onValue={num('waterMl')} /></Field>
            </Grid>
            {!!lowWarn && (
              <Row gap={8} align="flex-start" style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: R.md, boxShadow: `inset 0 0 0 1px ${C.a700}` }}>
                <Icon name="warning" size={16} color={C.accent} style={{ marginTop: 2 }} />
                <T size={13} style={{ flex: 1 }}>{lowWarn}</T>
              </Row>
            )}
            <NotMedical text={RG.NOT_MEDICAL} />
            <Check checked={P.water} onChange={v => up(p => { p.water = v; })} label="Track water" />
            <Field label="Dietary preferences (boost matching alternatives)">
              <Row gap={6} wrap>{['Dairy-free', 'Gluten-free', 'Vegetarian', 'Vegan'].map(l => <Pick key={l} label={l} on={P.dietPrefs.includes(l)} onPress={inList('dietPrefs', l)} />)}</Row>
            </Field>
            <Grid min={220} gap={12}>
              <Field label="Allergies (never suggested)">
                <Input value={allergies ?? P.allergies.join(', ')} onChange={v => { setAllergies(v); up(p => { p.allergies = csv(v); }); }} onBlur={() => setAllergies(null)} placeholder="e.g. Peanuts, Shellfish" />
              </Field>
              <Field label="Foods to exclude">
                <Input value={exclude ?? P.exclude.join(', ')} onChange={v => { setExclude(v); up(p => { p.exclude = csv(v); }); }} onBlur={() => setExclude(null)} placeholder="e.g. Pork" />
              </Field>
            </Grid>
            <T size={11} upper color={C.n500} style={{ letterSpacing: 0.9, marginTop: 4 }}>Meal structure</T>
            <Grid min={280} gap={12}>
              {([['training', 'Training days'], ['rest', 'Rest days']] as [DayType, string][]).map(([t, l]) => (
                <View key={t} style={{ gap: 6 }}>
                  <T size={13}>{l}</T>
                  {S.mealSlots[t].slice(0, P.mealsPerDay).map((sl, i) => (
                    <Row key={i} gap={6}>
                      <Muted style={{ width: 60 }}>{sl.name}</Muted>
                      <Input value={sl.label} onChange={v => RG.update(s => { s.mealSlots[t][i].label = v; })} style={{ flex: 1, width: undefined, minWidth: 0 }} />
                      <TimeInput value={sl.time} onChange={v => RG.update(s => { s.mealSlots[t][i].time = v; })} style={{ width: 100 }} />
                    </Row>
                  ))}
                </View>
              ))}
            </Grid>
          </Card>
        )}

        {tab === 'reminders' && (
          <Card gap={8} pad={[12, 18]}>
            <Row gap={12} wrap>
              <T size={13} color={C.n400}>Quiet hours</T>
              <TimeInput value={P.quietStart} onChange={setK('quietStart')} style={{ width: 120 }} />
              <T size={13}>to</T>
              <TimeInput value={P.quietEnd} onChange={setK('quietEnd')} style={{ width: 120 }} />
              <Muted style={{ flexShrink: 1, minWidth: 200 }}>Nothing is sent during quiet hours; reminders wait until they end.</Muted>
            </Row>
            <Row gap={10} wrap style={{ paddingVertical: 4 }}>
              {Platform.OS === 'web' ? (
                <>
                  <Icon name="info" size={14} color={C.n500} />
                  <Muted style={{ flex: 1, minWidth: 220 }}>The web app can't schedule background reminders. Install the Regimen mobile app to get them as notifications; your settings here carry over.</Muted>
                </>
              ) : (
                <>
                  <Btn icon="bell" title="Enable notifications" onPress={enableNotifications} />
                  <Muted style={{ flex: 1, minWidth: 200 }}>Push reminders are scheduled on this device. Email reminders need a connected account.</Muted>
                </>
              )}
            </Row>
            <Table minWidth={860}
              cols={[{ label: 'On', flex: 0.4 }, { label: 'Reminder', flex: 1.6 }, { label: 'Time', flex: 1 }, { label: 'Frequency', flex: 1.6 }, { label: 'Channel', flex: 1.3 }, { label: 'Snooze', flex: 1 }, { label: 'Reschedule if missed', flex: 1.1 }]}
              rows={reminderRows} />
          </Card>
        )}

        {tab === 'motivation' && (
          <Card gap={10}>
            <Row gap={10} wrap>
              <T size={13} color={C.n400}>Tone shown on the dashboard</T>
              <Seg value={P.quoteTone} options={['All', 'Disciplined', 'Supportive', 'Direct', 'Calm', 'Performance']} onChange={setK('quoteTone')} style={{ flexWrap: 'wrap' }} />
            </Row>
            <Row gap={8}>
              <Input value={ownQ} onChange={setOwnQ} placeholder="Add your own statement, e.g. I train for the person I am becoming" style={{ flex: 1, width: undefined, minWidth: 0 }} onSubmitEditing={addQ} />
              <Btn variant="primary" title="Add" onPress={addQ} />
            </Row>
            {(() => {
              const shown = quotes.filter(q => P.quoteTone === 'All' || q.tone === P.quoteTone || q.custom);
              return <Muted size={12}>{P.quoteTone === 'All' ? `Showing all ${shown.length} lines. The dashboard rotates through them daily.` : `Showing ${shown.length} ${P.quoteTone.toLowerCase()} line${shown.length === 1 ? '' : 's'}${S.quotes.custom.length ? ' plus your own statements' : ''}. Only these appear on your dashboard.`}</Muted>;
            })()}
            <View>
              {quotes.filter(q => P.quoteTone === 'All' || q.tone === P.quoteTone || q.custom).map(q => {
                const hid = !!S.quotes.hidden[q.id];
                return (
                  <View key={q.id} style={{ opacity: hid ? 0.45 : 1 }}>
                    <Rule />
                    <Row gap={8} style={{ paddingVertical: 6 }}>
                      <T size={14} style={{ flex: 1 }}>{q.text}</T>
                      <Tag style={{ alignSelf: 'center' }}>{q.tone}</Tag>
                      <Btn variant="ghost" iconOnly icon="heart" iconFill={!!S.quotes.fav[q.id]} color={C.accent} label="Favourite" onPress={() => RG.update(s => { s.quotes.fav[q.id] = !s.quotes.fav[q.id]; })} />
                      <Btn variant="ghost" iconOnly icon={hid ? 'eye' : 'eye-slash'} color={C.text} label={hid ? 'Show again' : 'Hide'} onPress={() => RG.update(s => { if (s.quotes.hidden[q.id]) delete s.quotes.hidden[q.id]; else s.quotes.hidden[q.id] = true; })} />
                      {q.custom && <Btn variant="ghost" iconOnly icon="trash" color={C.n500} label="Delete statement" onPress={() => RG.update(s => { s.quotes.custom = s.quotes.custom.filter(c => c.id !== q.id); })} />}
                    </Row>
                  </View>
                );
              })}
            </View>
            <Muted>Lines are written to motivate without guilt, pressure or comments about bodies.</Muted>
          </Card>
        )}

        {tab === 'data' && (
          <Card gap={12}>
            <Row gap={10} align="flex-start">
              <Icon name="shield-check" size={20} color={C.accent} />
              <T size={13} color={C.n300} style={{ flex: 1 }}>{mode === 'cloud'
                ? "Check-ins, measurements and progress photos are sensitive. They're stored in your private account (photos in a private bucket, served only through short-lived links) and are never shared unless you export them. Nutrition data comes from USDA FoodData Central; custom and restaurant entries are labelled. Calculations are planning estimates and not medical advice."
                : "Check-ins, measurements and progress photos are sensitive. They're stored only on this device and are never shared unless you export them. Nutrition data comes from USDA FoodData Central; custom and restaurant entries are labelled. Calculations are planning estimates and not medical advice."}</T>
            </Row>
            <Row gap={8} wrap>
              <Btn icon="download-simple" title="Export my data (JSON)" onPress={exportData} />
              {S.sample
                ? <RemoveSampleButton />
                : <Btn icon="arrow-counter-clockwise" title="Load sample data" onPress={() => setConfirmReset(true)} />}
            </Row>
            {S.sample && <T size={12} color={C.n400}>You're using sample data. Remove it to start your own history. You'll go through the guided setup next.</T>}
            <View style={{ gap: 8, padding: 12, borderRadius: R.md, boxShadow: `inset 0 0 0 1px ${C.n800}` }}>
              <T size={14}>Permanently delete history</T>
              <Muted>Choose what to delete, then type DELETE to confirm. This cannot be undone.</Muted>
              <Row gap={6} wrap>{DEL_KINDS.map(([k, l]) => <Pick key={k} label={l} on={!!del[k]} onPress={() => setDel(d => ({ ...d, [k]: !d[k] }))} />)}</Row>
              <Row gap={8} wrap>
                <Input value={delText} onChange={setDelText} placeholder="Type DELETE" autoCapitalize="characters" style={{ maxWidth: 200 }} />
                <Btn variant="primary" icon="trash" title="Delete selected" disabled={!delReady} onPress={doDelete} />
              </Row>
            </View>
            {mode === 'cloud' && (
              <View style={{ gap: 8, padding: 12, borderRadius: R.md, boxShadow: `inset 0 0 0 1px ${C.n800}` }}>
                <T size={14}>Account</T>
                <Row gap={10} wrap>
                  <Icon name="envelope" size={16} color={C.n400} />
                  <T size={13} color={C.n300} style={{ flex: 1, minWidth: 180 }}>{email ? `Signed in as ${email}. ` : ''}Email, password and billing are in My Account.</T>
                  <Btn icon="gear" title="Open My Account" onPress={() => RG.go('account')} />
                </Row>
                <Muted>Your data syncs to your account and is available when you sign in on another device.</Muted>
              </View>
            )}
          </Card>
        )}
      </View>

      <CalendarSyncDialog open={dlgCal} onClose={() => setDlgCal(false)} />
      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Restore sample data?"
        body={mode === 'cloud' ? 'Replace everything with the sample data? Your current data and photos in your account will be lost.' : 'Replace everything with the sample data? Your current data and photos on this device will be lost.'}
        actions={<><Btn title="Cancel" onPress={() => setConfirmReset(false)} /><Btn variant="primary" icon="arrow-counter-clockwise" title="Replace with sample data" onPress={resetDemo} /></>} />
    </Screen>
  );
}
