/* Sign in / create account (Supabase email + password). */
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Btn, Card, Field, H, Icon, Input, Muted, Row, Seg, T } from '@/ui/kit';
import { C } from '@/ui/theme';

type Mode = 'signin' | 'signup' | 'reset';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const redirect = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : Linking.createURL('/');

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
            <T size={19} w={500}>Regimen</T>
          </Row>
          <View style={{ gap: 4 }}>
            <H size={28}>{mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Welcome back'}</H>
            <Muted size={13}>Your plan, sessions, meals and progress — synced across your devices.</Muted>
          </View>
          <Card gap={14}>
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
