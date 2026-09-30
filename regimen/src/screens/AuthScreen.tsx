/* Sign in / create account (Supabase email + password). */
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { takeDeletedNotice } from '@/lib/account';
import { signInWithGoogle, takeRedirectError } from '@/lib/auth';
import { googleButtonAvailable, GoogleWebButton } from '@/lib/googleWeb';
import { supabase } from '@/lib/supabase';
import { Btn, Card, Field, H, Icon, Input, Muted, Row, Seg, T } from '@/ui/kit';
import { C, FONT } from '@/ui/theme';

/** Simple "G" mark for the Google button (no brand icon in the kit). */
const GMark = () => (
  <View style={{ width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 0 0 1.5px ${C.text}` }}>
    <T size={11} w={600} lh={1}>G</T>
  </View>
);

type Mode = 'signin' | 'signup' | 'reset';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // A failed or cancelled Google sign-in on web comes back with an error in the address bar.
  useEffect(() => { const e = takeRedirectError(); if (e) setMsg({ kind: 'err', text: e }); }, []);
  useEffect(() => { takeDeletedNotice().then(d => { if (d) setMsg({ kind: 'ok', text: 'Your account and all of its data have been deleted.' }); }); }, []);

  async function google() {
    setMsg(null); setBusy(true);
    try {
      const r = await signInWithGoogle();
      if (r === 'cancelled') setMsg({ kind: 'err', text: 'Google sign-in was cancelled.' });
      if (r === 'redirecting') return; // page is leaving for Google; keep the button disabled
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Google sign-in failed. Try again.' });
    }
    setBusy(false);
  }

  const googleBtn = (
    <Btn size="lg" disabled={busy} onPress={google} label="Continue with Google"
      title={<Row gap={10}><GMark /><T size={15} w={500} lh={1.2}>Continue with Google</T></Row>} />
  );

  // Email links return to the app's own address (including its sub-path, /app).
  const redirect = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin + (process.env.EXPO_PUBLIC_BASE_URL || '') + '/' : Linking.createURL('/');

  async function submit() {
    if (!supabase) return;
    setMsg(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg({ kind: 'err', text: 'Enter a valid email address.' });
    if (mode !== 'reset' && pw.length < 8) return setMsg({ kind: 'err', text: 'Passwords are at least 8 characters.' });
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pw, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        if (!data.session) setMsg({ kind: 'ok', text: 'Check your email and tap the confirmation link, then sign in here.' });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect });
        if (error) throw error;
        setMsg({ kind: 'ok', text: 'If an account exists for that email, a reset link is on its way.' });
      }
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Something went wrong. Try again.' });
    } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 400, gap: 18 }}>
          <Row gap={8}>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: C.accent, boxShadow: `0 0 12px ${C.accent}` }} />
            <T size={21} style={{ fontFamily: FONT.display, letterSpacing: -0.2 }}>Regimen</T>
          </Row>
          <View style={{ gap: 4 }}>
            <H size={28}>{mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Welcome back'}</H>
            <Muted size={13}>Your plan, sessions, meals and progress — synced across your devices.</Muted>
          </View>
          <Card gap={14}>
            {mode !== 'reset' && (
              <>
                {googleButtonAvailable()
                  ? <GoogleWebButton onBusy={setBusy} onError={text => setMsg({ kind: 'err', text })} fallback={googleBtn} />
                  : googleBtn}
                <Row gap={10}>
                  <View style={{ flex: 1, height: 1, backgroundColor: C.divider }} />
                  <Muted>or use email</Muted>
                  <View style={{ flex: 1, height: 1, backgroundColor: C.divider }} />
                </Row>
              </>
            )}
            {mode !== 'reset' && <Seg value={mode} onChange={v => { setMode(v); setMsg(null); }} options={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }]} />}
            <Field label="Email">
              <Input value={email} onChange={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="you@example.com" onSubmitEditing={submit} />
            </Field>
            {mode !== 'reset' && (
              <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
                <Input value={pw} onChange={setPw} secureTextEntry autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} textContentType={mode === 'signup' ? 'newPassword' : 'password'} onSubmitEditing={submit} />
              </Field>
            )}
            {msg && (
              <Row gap={8} align="flex-start">
                <Icon name={msg.kind === 'ok' ? 'check-circle' : 'warning'} size={16} color={msg.kind === 'ok' ? C.accent : C.n300} style={{ marginTop: 2 }} />
                <T size={13} color={msg.kind === 'ok' ? C.a300 : C.n300} style={{ flex: 1 }}>{msg.text}</T>
              </Row>
            )}
            <Btn variant="primary" size="lg" disabled={busy} onPress={submit}
              title={busy ? 'Working…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'} />
            {mode === 'signin' && <Btn variant="ghost" title="Forgot password?" onPress={() => { setMode('reset'); setMsg(null); }} style={{ alignSelf: 'flex-start' }} />}
            {mode === 'reset' && <Btn variant="ghost" icon="arrow-left" title="Back to sign in" onPress={() => { setMode('signin'); setMsg(null); }} style={{ alignSelf: 'flex-start' }} />}
          </Card>
          <Row gap={6} align="flex-start">
            <Icon name="lock-simple" size={13} color={C.n600} style={{ marginTop: 2 }} />
            <Muted size={11} color={C.n600} style={{ flex: 1 }}>Check-ins, measurements and photos are private to your account. Photos are stored in a private bucket and only shown through short-lived links.</Muted>
          </Row>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
