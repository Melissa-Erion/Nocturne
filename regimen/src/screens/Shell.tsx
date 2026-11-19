/* App shell. Four tabs (Today, Train, Eat, Progress) plus Me (settings and account). Each tab holds a few pages,
   shown as a row of section buttons at the top. Wide screens (≥ 980 px): sticky 236 px sidebar. Phones: top bar with
   Back and Me, and a tab bar at the bottom. A workout in progress is full screen (no tab bar). Also the resume-workout
   banner and toasts. Screens render inside <Screen> (scrolling, max width 1320). */
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type PressableStateCallbackType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RG, type Route, useRG } from '@/store/rg';
import { retrySync, signOut, useUI } from '@/store/store';
import type { IconName } from '@/ui/icons';
import { Btn, Dialog, Icon, Muted, T, Tap, useLayout } from '@/ui/kit';
import { alpha, C, FONT, MAX_W, SHADOW } from '@/ui/theme';
import { SampleBanner } from './SampleData';
import { useAccess } from '@/store/access';
import { FEATURE, TRIAL_DAYS } from '@/lib/plans';
import { startTour, Tour, useAutoTour } from './Tour';
import { Paywall } from './UpgradeScreen';

type PState = PressableStateCallbackType & { hovered?: boolean };

export type TabId = 'today' | 'train' | 'eat' | 'progress' | 'me';
/** The four main tabs and the pages inside each one (first page = where the tab opens the first time). */
export const TABS: { id: TabId; label: string; icon: IconName; pages: [Route, string][] }[] = [
  { id: 'today', label: 'Today', icon: 'house', pages: [['dashboard', 'Today']] },
  { id: 'train', label: 'Train', icon: 'barbell', pages: [['schedule', 'Schedule'], ['plans', 'Plans'], ['history', 'History']] },
  { id: 'eat', label: 'Eat', icon: 'fork-knife', pages: [['meals', 'Meals'], ['nutrition', 'Macros'], ['prep', 'Prep'], ['recipes', 'Recipes'], ['grocery', 'Groceries']] },
  { id: 'progress', label: 'Progress', icon: 'chart-line-up', pages: [['checkins', 'Check-ins'], ['photos', 'Photos'], ['records', 'Records'], ['analytics', 'Analytics']] },
];
export const ME_PAGES: [Route, string][] = [['settings', 'Settings'], ['account', 'Account']];
/** Pages that belong to a tab without being one of its sections. */
const EXTRA: Partial<Record<Route, TabId>> = { workout: 'train', alternatives: 'eat', upgrade: 'me' };
export function tabOf(route: Route): TabId | null {
  return TABS.find(t => t.pages.some(p => p[0] === route))?.id ?? (ME_PAGES.some(p => p[0] === route) ? 'me' : EXTRA[route] ?? null);
}
const sectionsOf = (tab: TabId | null) => (tab === 'me' ? ME_PAGES : TABS.find(t => t.id === tab)?.pages ?? []);
const TITLE: Partial<Record<Route, string>> = { workout: 'Workout', alternatives: 'Swap a food', upgrade: 'Regimen Pro', onboarding: 'Setup' };
/** Tapping a tab returns to the section you last had open in it. */
const lastPage: Partial<Record<TabId, Route>> = {};
const openTab = (tab: TabId) => RG.go(lastPage[tab] || sectionsOf(tab)[0][0]);

const ShellCtx = createContext({ wide: true });
export const useShell = () => useContext(ShellCtx);

export function Shell({ children }: { children: ReactNode }) {
  const RGx = useRG();
  const { wide } = useLayout();
  const path = usePathname();
  const route = (path.replace(/^\//, '').split('/')[0] || 'dashboard') as Route;
  const insets = useSafeAreaInsets();
  const toast = useUI(u => u.toast);
  const lockPrompt = useUI(u => u.lockPrompt);
  const lockedFeature = lockPrompt ? FEATURE[lockPrompt] : null;
  const closeLock = () => useUI.setState({ lockPrompt: null });
  const active = RGx.s.active;
  const tab = tabOf(route);
  const sections = sectionsOf(tab);
  if (tab && sections.some(p => p[0] === route)) lastPage[tab] = route;
  const title = TITLE[route] || (tab === 'me' ? 'Me' : TABS.find(t => t.id === tab)?.label) || 'Regimen';
  const inWorkout = route === 'workout';
  const wk = active && RGx.workout(active.workoutId, active.planId);
  const onboarding = route === 'onboarding';
  const access = useAccess();
  useAutoTour(route);

  // In-app history for the Back button. Browser back (web) is recognised and pops instead of pushing.
  const [hist, setHist] = useState<string[]>([]);
  useEffect(() => {
    if (path === '/onboarding') { setHist([]); return; } // setup isn't a place to go "back" to
    setHist(h => h[h.length - 1] === path ? h : h[h.length - 2] === path ? h.slice(0, -1) : [...h, path].slice(-50));
  }, [path]);
  const canBack = hist.length > 1 && !onboarding;
  const goBack = () => { const prev = hist[hist.length - 2]; if (!prev) return; setHist(h => h.slice(0, -1)); router.navigate(prev as never); };

  return (
    <ShellCtx.Provider value={{ wide }}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg, paddingTop: wide ? insets.top : 0 }}>
        {wide && !onboarding && (
          <LinearGradient colors={[C.sidebarTop, C.bg]} style={{ width: 236, paddingTop: 20, paddingBottom: 16, borderRightWidth: 1, borderRightColor: C.n800 }}>
            <ScrollView contentContainerStyle={{ gap: 18, paddingHorizontal: 14, flexGrow: 1 }}>
              <Brand />
              <NavList tab={tab} active={!!active} />
              <SidebarFooter />
            </ScrollView>
          </LinearGradient>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          {!wide && (
            <View style={{ paddingTop: insets.top, backgroundColor: alpha(C.bg, 0.92), zIndex: 20, borderBottomWidth: 1, borderBottomColor: C.n800 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14 }}>
                {inWorkout
                  ? <Btn variant="ghost" iconOnly icon="caret-down" color={C.text} iconSize={22} label="Minimise workout" onPress={() => openTab('today')} />
                  : canBack && <Btn variant="ghost" iconOnly icon="arrow-left" color={C.text} iconSize={22} label="Back" onPress={goBack} />}
                <T size={18} style={{ flex: 1, fontFamily: FONT.display }} numberOfLines={1}>{title}</T>
                <SyncDot />
                {!onboarding && !inWorkout && (
                  <Pressable onPress={() => openTab('me')} accessibilityRole="button" accessibilityLabel="Me: settings and account"
                    style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === 'me' ? C.a700 : C.a900 }}>
                    <Icon name="user-circle" size={24} color={C.a200} />
                  </Pressable>
                )}
              </View>
            </View>
          )}
          {!!active && route !== 'workout' && (
            <Tap onPress={() => RG.go('workout')} label="Resume workout"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginHorizontal: wide ? 28 : 14, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: C.a700, backgroundColor: C.a900 }}>
              <Icon name="record" fill size={14} color={C.accent} />
              <T size={13} color={C.a100} style={{ flex: 1 }}>{wk ? wk.name : 'Workout'} in progress · tap to resume</T>
              <Icon name="arrow-right" size={14} color={C.a100} />
            </Tap>
          )}
          {wide && canBack && (
            <View style={{ paddingTop: 14, paddingHorizontal: 28, marginBottom: -12, alignItems: 'flex-start' }}>
              <Btn variant="ghost" size="sm" icon="arrow-left" title="Back" onPress={goBack} />
            </View>
          )}
          {!onboarding && RGx.s.sample && <View style={{ paddingHorizontal: wide ? 28 : 14, paddingTop: 12 }}><SampleBanner /></View>}
          {sections.length > 1 && sections.some(p => p[0] === route) && <Sections route={route} pages={sections} wide={wide} />}
          <View style={{ flex: 1 }}>{access.canOpen(route) ? children : <Screen><Paywall feature={route} /></Screen>}</View>
          {!wide && !onboarding && !inWorkout && <TabBar tab={tab} active={!!active} bottom={insets.bottom} />}
        </View>

        {!onboarding && <Tour />}

        <Dialog open={!!lockPrompt} onClose={closeLock}
          title={<>{lockedFeature?.title || 'This feature'} is part of Regimen Pro</>}
          body={`${lockedFeature ? lockedFeature.body + ' ' : ''}Try everything free for ${TRIAL_DAYS} days. Cancel anytime before the trial ends and you won't be charged.`}
          actions={<>
            <Btn title="Not now" onPress={closeLock} />
            <Btn variant="primary" icon="lock-simple-open" title={`Start ${TRIAL_DAYS}-day free trial`} onPress={() => { closeLock(); RG.go('upgrade'); }} />
          </>} />

        {toast && (
          <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 24 + insets.bottom + (!wide && !onboarding && !inWorkout ? 64 : 0), alignItems: 'center', zIndex: 60, paddingHorizontal: 16 }}>
            <View style={{ maxWidth: 560, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: C.surface, boxShadow: SHADOW.lg }}>
              <Icon name="check-circle" size={16} color={C.accent} />
              <T size={13} style={{ flexShrink: 1 }}>{toast.msg}</T>
              {toast.undo && <Btn variant="ghost" size="sm" icon="arrow-counter-clockwise" title="Undo" onPress={() => RG.undo()} />}
            </View>
          </View>
        )}
      </View>
    </ShellCtx.Provider>
  );
}

function Brand() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: C.accent, boxShadow: `0 0 12px ${C.accent}` }} />
      <T size={19} style={{ fontFamily: FONT.display }}>Regimen</T>
    </View>
  );
}

/** Sidebar (wide screens): the four tabs, then Me. */
function NavList({ tab, active }: { tab: TabId | null; active: boolean }) {
  const items: [TabId, string, IconName][] = [...TABS.map(t => [t.id, t.label, t.icon] as [TabId, string, IconName]), ['me', 'Me', 'user-circle']];
  return (
    <View style={{ gap: 2 }}>
      {items.map(([id, l, ic]) => {
        const on = tab === id;
        return (
          <Fragment key={id}>
            {id === 'me' && <View style={{ height: 1, backgroundColor: C.n800, marginVertical: 8 }} />}
            <Pressable onPress={() => openTab(id)} accessibilityRole="link" accessibilityState={{ selected: on }}
              style={(st: PState) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, minHeight: 44 },
                on ? { backgroundColor: alpha(C.accent, 0.14), boxShadow: `inset 3px 0 0 ${C.accent}` } : st.hovered && { backgroundColor: alpha(C.text, 0.05) }]}>
              <Icon name={ic} size={20} color={on ? C.text : C.n400} />
              <T size={15} w={on ? 600 : 400} color={on ? C.text : C.n300} style={{ flex: 1 }}>{l}</T>
              {id === 'train' && active && <T size={10} color={C.accent}>● live</T>}
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

/** Phone tab bar. */
function TabBar({ tab, active, bottom }: { tab: TabId | null; active: boolean; bottom: number }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: C.sidebarTop, borderTopWidth: 1, borderTopColor: C.n800, paddingBottom: bottom }}>
      {TABS.map(t => {
        const on = tab === t.id;
        return (
          <Pressable key={t.id} onPress={() => openTab(t.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}
            style={{ flex: 1, height: 60, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <View>
              <Icon name={t.icon} size={24} fill={on} color={on ? C.a400 : C.n500} />
              {t.id === 'train' && active && <View style={{ position: 'absolute', top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent }} />}
            </View>
            <T size={11} w={on ? 600 : 400} color={on ? C.a300 : C.n400}>{t.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The sections inside a tab (Train: Schedule · Plans · History), as a row of buttons at the top of the page. */
function Sections({ route, pages, wide }: { route: Route; pages: [Route, string][]; wide: boolean }) {
  const access = useAccess();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: wide ? 6 : 5, paddingHorizontal: wide ? 28 : 14, paddingTop: 12, paddingBottom: 2 }}>
      {pages.map(([id, l]) => {
        const on = id === route; const locked = access.enforced && !access.canOpen(id);
        return (
          <Pressable key={id} onPress={() => RG.go(id)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={(st: PState) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: wide ? 14 : 11, borderRadius: 19, borderWidth: 1 },
              on ? { backgroundColor: C.a800, borderColor: C.a600 } : { borderColor: C.n800, backgroundColor: st.hovered ? alpha(C.text, 0.05) : 'transparent' }]}>
            <T size={wide ? 14 : 13} w={on ? 600 : 400} color={on ? C.text : C.n300}>{l}</T>
            {locked && <Icon name="lock-simple" size={12} color={C.n500} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function SyncDot() {
  const mode = useUI(u => u.mode); const sync = useUI(u => u.sync);
  if (mode !== 'cloud') return null;
  return <Icon name={sync === 'error' ? 'cloud-slash' : 'cloud-check'} size={16} color={sync === 'error' ? C.n300 : sync === 'saving' ? C.accent : C.n600} />;
}

function SidebarFooter() {
  const mode = useUI(u => u.mode); const email = useUI(u => u.email); const sync = useUI(u => u.sync); const err = useUI(u => u.syncError);
  return (
    <View style={{ marginTop: 'auto', paddingTop: 10, paddingHorizontal: 8, gap: 10 }}>
      {mode === 'cloud' && (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={sync === 'error' ? 'cloud-slash' : 'cloud-check'} size={13} color={sync === 'error' ? C.n300 : C.n600} />
            <Muted size={11} color={C.n600} style={{ flex: 1 }}>{sync === 'saving' ? 'Saving…' : sync === 'error' ? 'Not synced' : 'Synced'}{email ? ` · ${email}` : ''}</Muted>
          </View>
          {sync === 'error' && <Muted size={11} color={C.n500}>{err}</Muted>}
          {sync === 'error' && <Btn variant="ghost" size="sm" title="Retry sync" onPress={retrySync} style={{ alignSelf: 'flex-start' }} />}
          <Btn variant="ghost" size="sm" icon="sign-out" title="Sign out" onPress={() => { signOut(); }} style={{ alignSelf: 'flex-start' }} color={C.n400} />
        </View>
      )}
      <Btn variant="ghost" size="sm" icon="compass" title="App tour" onPress={startTour} style={{ alignSelf: 'flex-start' }} color={C.n400} />
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Icon name="lock-simple" size={12} color={C.n600} style={{ marginTop: 2 }} />
        <Muted size={11} color={C.n600} style={{ flex: 1 }}>{mode === 'cloud' ? 'Check-ins, measurements and photos are private to your account.' : 'Check-ins, measurements and photos are private and stay on this device.'}</Muted>
      </View>
    </View>
  );
}

/** Scrolling page container: max width 1320, padding 22/28 (12/14 on mobile). `header` stays fixed above the scroll area. */
export function Screen({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const { wide } = useLayout();
  const insets = useSafeAreaInsets();
  const pad = wide ? { paddingTop: 22, paddingHorizontal: 28, paddingBottom: 48 + insets.bottom } : { paddingTop: 12, paddingHorizontal: 14, paddingBottom: 40 + insets.bottom };
  return (
    <View style={{ flex: 1 }}>
      {header && <View style={{ paddingHorizontal: pad.paddingHorizontal, paddingTop: pad.paddingTop, zIndex: 10 }}><View style={{ width: '100%', maxWidth: MAX_W - pad.paddingHorizontal * 2 }}>{header}</View></View>}
      <ScrollView contentContainerStyle={pad} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W - pad.paddingHorizontal * 2, gap: 16 }}>{children}</View>
      </ScrollView>
    </View>
  );
}
