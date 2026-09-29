/* App shell — port of prototype/Regimen.dc.html: sticky 236 px sidebar (≥ 980 px) or a top bar with a drawer,
   the active-workout resume banner, and toasts. Screens render inside <Screen> (scrolling, max width 1320). */
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View, type PressableStateCallbackType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RG, type Route, useRG } from '@/store/rg';
import { retrySync, signOut, useUI } from '@/store/store';
import type { IconName } from '@/ui/icons';
import { Btn, Icon, Muted, T, Tap, useLayout } from '@/ui/kit';
import { alpha, C, MAX_W, SHADOW } from '@/ui/theme';

type PState = PressableStateCallbackType & { hovered?: boolean };

export const NAV: [string, [Route, string, IconName][]][] = [
  ['Training', [['dashboard', 'Fitness Dashboard', 'house'], ['schedule', 'My Schedule', 'calendar-blank'], ['plans', 'Workout Plans', 'list-checks'], ['workout', 'Active Workout', 'barbell'], ['history', 'Exercise History', 'clock-counter-clockwise'], ['records', 'Personal Records', 'trophy']]],
  ['Progress', [['checkins', 'Progress Check-Ins', 'clipboard-text'], ['photos', 'Progress Photos', 'camera'], ['analytics', 'Analytics', 'chart-line-up']]],
  ['Nutrition', [['nutrition', 'Nutrition Dashboard', 'chart-donut'], ['meals', 'Meal Planner', 'fork-knife'], ['prep', 'Meal-Prep Calculator', 'cooking-pot'], ['recipes', 'Recipes & Saved Meals', 'book-open'], ['alternatives', 'Food Alternatives', 'swap'], ['grocery', 'Grocery List', 'shopping-cart']]],
  ['Account', [['settings', 'Fitness Settings', 'gear']]],
];

const ShellCtx = createContext({ wide: true });
export const useShell = () => useContext(ShellCtx);

export function Shell({ children }: { children: ReactNode }) {
  const RGx = useRG();
  const { wide } = useLayout();
  const path = usePathname();
  const route = (path.replace(/^\//, '').split('/')[0] || 'dashboard') as Route;
  const [menu, setMenu] = useState(false);
  const insets = useSafeAreaInsets();
  const toast = useUI(u => u.toast);
  const active = RGx.s.active;
  const title = NAV.flatMap(g => g[1]).find(p => p[0] === route)?.[1] || 'Setup';
  const wk = active && RGx.workout(active.workoutId, active.planId);
  const onboarding = route === 'onboarding';

  // In-app history for the Back button. Browser back (web) is recognised and pops instead of pushing.
  const [hist, setHist] = useState<string[]>([]);
  useEffect(() => {
    setHist(h => h[h.length - 1] === path ? h : h[h.length - 2] === path ? h.slice(0, -1) : [...h, path].slice(-50));
  }, [path]);
  const canBack = hist.length > 1 && !onboarding;
  const goBack = () => { const prev = hist[hist.length - 2]; if (!prev) return; setHist(h => h.slice(0, -1)); router.navigate(prev as never); };

  return (
    <ShellCtx.Provider value={{ wide }}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg, paddingTop: wide ? insets.top : 0 }}>
        {wide && !onboarding && (
          <LinearGradient colors={[C.sidebarTop, C.bg]} style={{ width: 236, paddingTop: 20, paddingBottom: 16 }}>
            <ScrollView contentContainerStyle={{ gap: 18, paddingHorizontal: 14, flexGrow: 1 }}>
              <Brand />
              <NavList route={route} active={!!active} onGo={r => RG.go(r)} />
              <SidebarFooter />
            </ScrollView>
          </LinearGradient>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          {!wide && (
            <View style={{ paddingTop: insets.top, backgroundColor: alpha(C.bg, 0.92), zIndex: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14 }}>
                {canBack && <Btn variant="ghost" iconOnly icon="arrow-left" color={C.text} iconSize={22} label="Back" onPress={goBack} />}
                {!onboarding && <Btn variant="ghost" iconOnly icon="list" color={C.text} iconSize={22} label="Menu" onPress={() => setMenu(true)} />}
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: C.accent, boxShadow: `0 0 10px ${C.accent}` }} />
                <T size={16} w={500} style={{ flex: 1 }} numberOfLines={1}>{title}</T>
                <SyncDot />
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
          <View style={{ flex: 1 }}>{children}</View>
        </View>

        <Modal visible={menu && !wide} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
          <Pressable style={{ flex: 1, backgroundColor: alpha(C.n900, 0.6) }} onPress={() => setMenu(false)} />
          <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 290, maxWidth: '86%', backgroundColor: C.bg, boxShadow: SHADOW.lg, paddingTop: insets.top + 18 }}>
            <ScrollView contentContainerStyle={{ gap: 16, paddingHorizontal: 14, paddingBottom: insets.bottom + 18, flexGrow: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: C.accent }} />
                <T size={17} w={500} style={{ flex: 1 }}>Regimen</T>
                <Btn variant="ghost" iconOnly icon="x" color={C.text} label="Close menu" onPress={() => setMenu(false)} />
              </View>
              <NavList route={route} active={!!active} large onGo={r => { setMenu(false); RG.go(r); }} />
              <SidebarFooter />
            </ScrollView>
          </View>
        </Modal>

        {toast && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 24 + insets.bottom, alignItems: 'center', zIndex: 60, paddingHorizontal: 16 }}>
            <View style={{ maxWidth: 560, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: C.surface, boxShadow: SHADOW.lg }}>
              <Icon name="check-circle" size={16} color={C.accent} />
              <T size={13} style={{ flexShrink: 1 }}>{toast.msg}</T>
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
      <T size={17} w={500} style={{ letterSpacing: -0.17 }}>Regimen</T>
    </View>
  );
}

function NavList({ route, active, large, onGo }: { route: Route; active: boolean; large?: boolean; onGo: (r: Route) => void }) {
  return (
    <>
      {NAV.map(([label, items]) => (
        <View key={label} style={{ gap: 1 }}>
          <T size={10} color={C.n600} upper style={{ letterSpacing: 1, paddingHorizontal: 8, paddingBottom: 6 }}>{label}</T>
          {items.map(([id, l, ic]) => {
            const on = route === id;
            return (
              <Pressable key={id} onPress={() => onGo(id)} accessibilityRole="link" accessibilityState={{ selected: on }}
                style={(st: PState) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: large ? 10 : 6, paddingHorizontal: 8, borderRadius: 6, minHeight: large ? 44 : 32 },
                  on ? { backgroundColor: alpha(C.accent, 0.12), boxShadow: `inset 2px 0 0 ${C.accent}` } : st.hovered && { backgroundColor: alpha(C.text, 0.05) }]}>
                <Icon name={ic} size={large ? 18 : 16} color={on ? C.text : C.n400} />
                <T size={large ? 15 : 13} color={on ? C.text : C.n400} style={{ flex: 1 }}>{l}</T>
                {id === 'workout' && active && <T size={10} color={C.accent}>● live</T>}
              </Pressable>
            );
          })}
        </View>
      ))}
    </>
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
