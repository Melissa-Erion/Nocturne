/* Guided app tour. Opens once after setup (on the dashboard) and can be replayed from Settings or the menu.
   Each step takes the user to the screen it describes (when they have access) with a card explaining it. */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TRIAL_DAYS } from '@/lib/plans';
import { canOpenRoute, useAccess } from '@/store/access';
import { RG, type Route } from '@/store/rg';
import { useUI } from '@/store/store';
import type { IconName } from '@/ui/icons';
import { Btn, Icon, Muted, Row, T, Tag, useLayout } from '@/ui/kit';
import { alpha, C, SHADOW } from '@/ui/theme';

interface Step { route?: Route; icon: IconName; title: string; body: (wide: boolean) => string; where?: (wide: boolean) => string }

const menu = (wide: boolean, item: string) => (wide ? `Menu on the left → ${item}` : `☰ menu (top left) → ${item}`);

const STEPS: Step[] = [
  { route: 'dashboard', icon: 'compass', title: 'Welcome to Regimen',
    body: () => 'A one-minute tour of where everything is. You can skip it now and replay it anytime from Fitness Settings or the menu.' },
  { icon: 'list', title: 'Getting around',
    body: w => w
      ? 'Every section is in the menu on the left: Training, Progress, Nutrition and your Account.'
      : 'Tap ☰ at the top left to open the menu with every section. The ← arrow next to it takes you back to the previous screen.' },
  { route: 'dashboard', icon: 'house', title: 'Fitness Dashboard: your day',
    body: () => 'Start here each day: today’s workout, your calories and macros, your meals (tap Log when you eat one), your weight trend and this week at a glance.',
    where: w => menu(w, 'Fitness Dashboard') },
  { route: 'schedule', icon: 'calendar-blank', title: 'My Schedule',
    body: () => 'Your workouts are placed on your training days automatically. Tap a workout to move, skip or reschedule it. Undo reverses your last change, Reset schedule rebuilds it from your plan, and Sync to calendar adds your workouts to Google Calendar, Outlook or Apple Calendar.',
    where: w => menu(w, 'My Schedule') },
  { route: 'workout', icon: 'barbell', title: 'Doing a workout',
    body: () => 'Press Start workout on the dashboard or schedule. Log each set, follow the rest timer, swap an exercise if you need to, and pause if you’re interrupted. Your next session’s weights and reps are worked out for you.',
    where: w => menu(w, 'Active Workout') },
  { route: 'nutrition', icon: 'chart-donut', title: 'Nutrition',
    body: () => 'Your targets for today (training and rest days can differ), what’s left to eat, and water. The Meal Planner builds meals with exact portions to hit your macros.',
    where: w => menu(w, 'Nutrition Dashboard / Meal Planner') },
  { route: 'prep', icon: 'cooking-pot', title: 'Prep, recipes and groceries',
    body: () => 'Meal-Prep Calculator gives batch-cook amounts, Food Alternatives swaps a food for one with matching macros, and the Grocery List is built from your prep.',
    where: w => menu(w, 'Meal-Prep Calculator') },
  { route: 'checkins', icon: 'chart-line-up', title: 'Tracking progress',
    body: () => 'Weekly check-ins, private progress photos, personal records and analytics show how far you’ve come.',
    where: w => menu(w, 'Progress') },
  { route: 'settings', icon: 'gear', title: 'Settings and your account',
    body: () => 'Fitness Settings is where you change your targets, units, training days and reminders, and replay this tour. My Account has your email, password and subscription.',
    where: w => menu(w, 'Fitness Settings / My Account') },
  { route: 'dashboard', icon: 'check-circle', title: 'You’re all set',
    body: () => 'Head to your dashboard and start with today. You can replay this tour anytime from Fitness Settings or the menu.' },
];

/** Opens the tour automatically the first time someone reaches the dashboard after setup. */
export function useAutoTour(route: string) {
  const ready = useUI(u => u.phase === 'ready');
  const version = useUI(u => u.version);
  useEffect(() => {
    const P = RG.s.profile;
    if (ready && route === 'dashboard' && P.onboarded && !P.tourDone && !useUI.getState().tourOpen) useUI.setState({ tourOpen: true });
  }, [ready, route, version]);
}

export function startTour() { useUI.setState({ tourOpen: true, lockPrompt: null }); }

export function Tour() {
  const open = useUI(u => u.tourOpen);
  const [i, setI] = useState(0);
  const { wide } = useLayout();
  const insets = useSafeAreaInsets();
  const access = useAccess();

  useEffect(() => { if (open) setI(0); }, [open]);
  const step = STEPS[i];
  const locked = !!step?.route && !canOpenRoute(step.route);
  useEffect(() => {
    // Show the screen being described (navigating directly: a locked screen isn't opened, the card says it's Pro).
    if (open && step?.route && !locked) router.navigate(('/' + step.route) as never);
  }, [open, i]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !step) return null;
  const last = i === STEPS.length - 1;
  const finish = () => {
    useUI.setState({ tourOpen: false });
    if (!RG.s.profile.tourDone) RG.update(s => { s.profile.tourDone = true; });
    router.navigate('/dashboard' as never);
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, justifyContent: 'flex-end', alignItems: wide ? 'flex-end' : 'stretch', padding: wide ? 24 : 10, paddingBottom: (wide ? 24 : 10) + insets.bottom, zIndex: 70 }}>
      {/* Dim the page a little so the tour card is clearly in front (the page stays visible behind it). */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      <View accessibilityRole="alert" style={{ width: wide ? 440 : undefined, gap: 10, padding: 18, borderRadius: 12, backgroundColor: '#2c2f45', borderWidth: 2, borderColor: C.accent, boxShadow: `0 0 0 5px ${alpha(C.accent, 0.18)}, 0 20px 50px rgba(0,0,0,0.7)` }}>
        <Row gap={6}><Icon name="compass" size={13} color={C.a400} /><T size={11} color={C.a400} upper style={{ letterSpacing: 1 }}>App tour</T></Row>
        <Row gap={10}>
          <View style={{ width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(C.accent, 0.15) }}>
            <Icon name={step.icon} size={18} color={C.accent} />
          </View>
          <T size={17} w={500} style={{ flex: 1 }}>{step.title}</T>
          <Muted size={12} tab>{`${i + 1} / ${STEPS.length}`}</Muted>
        </Row>
        <T size={14} color={alpha(C.text, 0.88)}>{step.body(wide)}</T>
        {step.where && <Muted size={12}>{`Find it: ${step.where(wide)}`}</Muted>}
        {locked && access.enforced && (
          <Row gap={8}><Tag variant="outline" icon="lock-simple">Regimen Pro</Tag><Muted size={12} style={{ flex: 1 }}>{`Unlock it with the ${TRIAL_DAYS}-day free trial.`}</Muted></Row>
        )}
        <View style={{ flexDirection: 'row', gap: 4, justifyContent: 'center', paddingVertical: 2 }}>
          {STEPS.map((_, k) => <View key={k} style={{ width: k === i ? 14 : 6, height: 6, borderRadius: 3, backgroundColor: k === i ? C.accent : C.n700 }} />)}
        </View>
        <Row gap={6}>
          {!last && <Btn variant="ghost" size="sm" title="Skip tour" onPress={finish} color={C.n400} />}
          <View style={{ flex: 1 }} />
          {i > 0 && <Btn size="sm" icon="arrow-left" title="Back" onPress={() => setI(i - 1)} />}
          <Btn variant="primary" size="sm" iconRight={last ? undefined : 'arrow-right'} title={last ? 'Done' : i === 0 ? 'Start tour' : 'Next'} onPress={() => (last ? finish() : setI(i + 1))} />
        </Row>
      </View>
    </View>
  );
}
