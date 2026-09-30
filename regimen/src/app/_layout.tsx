import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { Slot, usePathname, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthScreen from '@/screens/AuthScreen';
import { Shell } from '@/screens/Shell';
import { boot, getState, useUI } from '@/store/store';
import { Btn, Muted, T } from '@/ui/kit';
import { C } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fonts] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const phase = useUI(u => u.phase);
  const error = useUI(u => u.error);
  const version = useUI(u => u.version);
  const path = usePathname();

  useEffect(() => { boot(); }, []);
  // Web: paint the page behind the app dark too, so no white shows when the browser's bars move or the keyboard closes.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    for (const el of [document.documentElement, document.body]) { el.style.backgroundColor = C.bg; el.style.colorScheme = 'dark'; }
  }, []);
  useEffect(() => { if (fonts && phase !== 'booting') SplashScreen.hideAsync().catch(() => {}); }, [fonts, phase]);
  // First run: send the user through onboarding before anything else.
  useEffect(() => {
    if (phase === 'ready' && !getState().profile.onboarded && path !== '/onboarding') router.replace('/onboarding');
  }, [phase, path, version]);

  let body;
  if (!fonts || phase === 'booting' || phase === 'loading') body = <Splash />;
  else if (phase === 'signedOut') body = <AuthScreen />;
  else if (phase === 'error') body = (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
      <T size={17} w={500}>Couldn't load your data</T>
      <Muted size={13} style={{ textAlign: 'center' }}>{error}</Muted>
      <Btn variant="primary" title="Try again" onPress={() => boot()} />
    </View>
  );
  else body = <Shell><Slot /></Shell>;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: C.bg }}>{body}</View>
    </SafeAreaProvider>
  );
}

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: C.accent, boxShadow: `0 0 24px ${C.accent}` }} />
    </View>
  );
}
