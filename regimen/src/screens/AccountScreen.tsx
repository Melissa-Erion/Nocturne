/* My Account — profile, sign-in email, password, subscription (information only for now) and sign out. */
import type { User } from '@supabase/supabase-js';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { authRedirect, friendlyAuthError } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useRG } from '@/store/rg';
import { signOut, useUI } from '@/store/store';
import { Btn, Card, CardTitle, Dialog, Field, Grid, Icon, Input, Muted, PageHeader, Row, RuledRow, T, Tag } from '@/ui/kit';
import { C, R } from '@/ui/theme';
import { Screen } from './Shell';
import { billingLive, PLANS, TRIAL_DAYS } from '@/lib/plans';
import { useAccess } from '@/store/access';

type Msg = { kind: 'ok' | 'err'; text: string } | null;
const PROVIDER: Record<string, string> = { email: 'Email', google: 'Google' };
const validEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim());

function Note({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <Row gap={8} align="flex-start">
      <Icon name={msg.kind === 'ok' ? 'check-circle' : 'warning'} size={16} color={msg.kind === 'ok' ? C.accent : C.n300} style={{ marginTop: 2 }} />
      <T size={13} color={msg.kind === 'ok' ? C.a300 : C.n300} style={{ flex: 1 }}>{msg.text}</T>
    </Row>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <RuledRow style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, flexWrap: 'wrap' }}>
      <T size={13} color={C.n400} style={{ width: 130 }}>{label}</T>
      <View style={{ flex: 1, minWidth: 160 }}>{children}</View>
    </RuledRow>
  );
}

export default function AccountScreen() {
  const RG = useRG();
  const access = useAccess();
  const sub = access.sub;
  const endStr = sub?.periodEnd ? new Date(sub.periodEnd).toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const subStatus: { tag: string; tone: 'accent' | 'neutral' | 'outline'; line: string } =
    sub?.status === 'comp' ? { tag: 'Full access', tone: 'accent', line: 'Complimentary full access. No payment needed.' }
    : sub?.status === 'trialing' ? { tag: 'Free trial', tone: 'accent', line: `Free trial of the ${sub.plan} plan until ${endStr}.` }
    : sub?.status === 'active' ? { tag: 'Active', tone: 'accent', line: `${sub.plan === 'yearly' ? 'Yearly' : 'Monthly'} plan. Renews ${endStr}.` }
    : sub?.status === 'canceled' ? { tag: 'Canceled', tone: 'neutral', line: `Canceled. Full access until ${endStr}, then paid features lock (your data is kept).` }
    : sub?.status === 'expired' ? { tag: 'Ended', tone: 'neutral', line: 'Your subscription has ended. Paid features are locked; your data is kept.' }
    : { tag: billingLive() ? 'Free version' : 'Coming soon', tone: 'outline', line: billingLive() ? 'You\'re on the free version.' : 'No subscription yet.' };
  const mode = useUI(u => u.mode);
  const manageUrl = useUI(u => u.manageUrl);
  const cloud = !!supabase && mode === 'cloud';

  const [user, setUser] = useState<User | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(async () => {
    if (!supabase) return;
    setLoadState('loading');
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) throw error || new Error('No user');
      setUser(data.user); setLoadState('ready');
    } catch { setLoadState('error'); }
  }, []);
  useEffect(() => { if (cloud) load(); }, [cloud, load]);

  // Profile name
  const [name, setName] = useState(RG.s.profile.name || '');
  const nameDirty = name.trim() !== (RG.s.profile.name || '');
  const saveName = () => { RG.update(s => { s.profile.name = name.trim(); }); RG.toast('Name saved.'); };

  // Email
  const [newEmail, setNewEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState<Msg>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  // Password
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwAdded, setPwAdded] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const [confirmOut, setConfirmOut] = useState(false);
  const [outBusy, setOutBusy] = useState(false);

  if (!cloud) {
    return (
      <Screen>
        <PageHeader kicker="Account" title="My Account" sub="Email, password and billing for your Regimen account." />
        <Card gap={10} style={{ maxWidth: 640 }}>
          <Row gap={10}>
            <Icon name="lock-simple" size={18} color={C.accent} />
            <CardTitle>You're using Regimen without an account</CardTitle>
          </Row>
          <T size={14} color={C.n300} lh={1.5}>
            Accounts need sign-in. This copy of Regimen runs without one and keeps everything on this device, so there's no email,
            password or subscription to manage. When you use Regimen signed in, this is where you change your email and password,
            see how you sign in, and (later) manage your subscription.
          </T>
          <Muted>Your data on this device is under Settings → Data &amp; privacy, where you can export it.</Muted>
          <Btn icon="gear" title="Open Settings" onPress={() => RG.go('settings')} style={{ alignSelf: 'flex-start' }} />
        </Card>
      </Screen>
    );
  }

  const providers = Array.from(new Set((user?.identities || []).map(i => i.provider).concat(user?.app_metadata?.provider ? [user.app_metadata.provider as string] : [])));
  const hasPassword = pwAdded || providers.includes('email');
  const since = user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

  function askEmail() {
    setEmailMsg(null);
    const e = newEmail.trim();
    if (!validEmail(e)) return setEmailMsg({ kind: 'err', text: 'Enter a valid email address.' });
    if (user?.email && e.toLowerCase() === user.email.toLowerCase()) return setEmailMsg({ kind: 'err', text: "That's already your email address." });
    setConfirmEmail(true);
  }
  async function changeEmail() {
    if (!supabase) return;
    setConfirmEmail(false); setEmailBusy(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ email: newEmail.trim() }, { emailRedirectTo: authRedirect() });
      if (error) throw error;
      if (data?.user) setUser(data.user);
      setEmailMsg({ kind: 'ok', text: `Confirmation link sent to ${newEmail.trim()}. Your email changes once you tap it. You may also get a link at your current address — tap both if so.` });
      setNewEmail('');
      RG.toast('Confirmation email sent.');
    } catch (e) { setEmailMsg({ kind: 'err', text: friendlyAuthError(e) }); }
    finally { setEmailBusy(false); }
  }

  async function changePassword() {
    if (!supabase) return;
    setPwMsg(null);
    if (pw.length < 8) return setPwMsg({ kind: 'err', text: 'Passwords are at least 8 characters.' });
    if (pw !== pw2) return setPwMsg({ kind: 'err', text: "The two passwords don't match." });
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      const added = !hasPassword;
      setPw(''); setPw2(''); setPwAdded(true);
      setPwMsg({ kind: 'ok', text: added ? 'Password added. You can now also sign in with your email and this password.' : 'Password changed. Use it next time you sign in.' });
      RG.toast(added ? 'Password added.' : 'Password changed.');
    } catch (e) { setPwMsg({ kind: 'err', text: friendlyAuthError(e) }); }
    finally { setPwBusy(false); }
  }

  async function sendReset() {
    if (!supabase || !user?.email) return;
    setResetBusy(true); setPwMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: authRedirect() });
      if (error) throw error;
      setPwMsg({ kind: 'ok', text: `Reset link sent to ${user.email}. Open it to choose a new password.` });
      RG.toast('Reset email sent.');
    } catch (e) { setPwMsg({ kind: 'err', text: friendlyAuthError(e) }); }
    finally { setResetBusy(false); }
  }

  async function doSignOut() {
    setOutBusy(true);
    try { await signOut(); } catch { RG.toast('Sign-out failed. Try again.'); setOutBusy(false); setConfirmOut(false); }
  }

  return (
    <Screen>
      <PageHeader kicker="Account" title="My Account" sub="Your sign-in details, password and subscription."
        right={<Btn icon="sign-out" title="Sign out" onPress={() => setConfirmOut(true)} />} />

      {loadState === 'loading' && (
        <Card><Row gap={10}><Icon name="circle-dashed" size={16} color={C.n400} /><T size={14} color={C.n300}>Loading your account…</T></Row></Card>
      )}

      {loadState === 'error' && (
        <Card gap={10} style={{ maxWidth: 640 }}>
          <Row gap={10}><Icon name="warning" size={18} color={C.n300} /><CardTitle>Couldn't load your account details</CardTitle></Row>
          <Muted size={13}>Check your connection, then try again. Your workouts and meals are not affected.</Muted>
          <Btn icon="arrows-clockwise" title="Retry" onPress={load} style={{ alignSelf: 'flex-start' }} />
        </Card>
      )}

      {loadState === 'ready' && user && (
        <Grid min={380}>
          <Card gap={4}>
            <CardTitle style={{ marginBottom: 8 }}>Profile</CardTitle>
            <Field label="Name" style={{ marginBottom: 10 }}>
              <Row gap={8}>
                <Input value={name} onChange={setName} placeholder="Your name" autoComplete="name" style={{ flex: 1 }} onSubmitEditing={() => nameDirty && saveName()} />
                <Btn title="Save" disabled={!nameDirty} onPress={saveName} />
              </Row>
            </Field>
            <InfoRow label="Email"><T size={14} selectable>{user.email || '—'}</T></InfoRow>
            <InfoRow label="Sign-in methods">
              <Row gap={6} wrap>
                {providers.length ? providers.map(p => <Tag key={p} icon={p === 'email' ? 'envelope' : undefined}>{PROVIDER[p] || p}</Tag>) : <T size={14}>—</T>}
                {pwAdded && !providers.includes('email') && <Tag icon="envelope">Email</Tag>}
              </Row>
            </InfoRow>
            <InfoRow label="Member since"><T size={14}>{since}</T></InfoRow>
          </Card>

          <Card gap={12}>
            <CardTitle>Email</CardTitle>
            <Muted size={13}>
              To change the email you sign in with, enter the new address. We'll send a confirmation link to it (and possibly one to your current address).
              The change applies after you confirm.
            </Muted>
            {user.new_email ? (
              <Row gap={8} align="flex-start">
                <Icon name="envelope" size={16} color={C.accent} style={{ marginTop: 2 }} />
                <T size={13} color={C.a300} style={{ flex: 1 }}>Waiting for you to confirm {user.new_email}. Until then, keep signing in with {user.email}.</T>
              </Row>
            ) : null}
            <Field label="New email">
              <Input value={newEmail} onChange={setNewEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="you@example.com" onSubmitEditing={askEmail} />
            </Field>
            <Note msg={emailMsg} />
            <Btn icon="envelope" title={emailBusy ? 'Sending…' : 'Change email'} disabled={emailBusy || !newEmail.trim()} onPress={askEmail} style={{ alignSelf: 'flex-start' }} />
          </Card>

          <Card gap={12}>
            <CardTitle>{hasPassword ? 'Password' : 'Add a password'}</CardTitle>
            <Muted size={13}>
              {hasPassword
                ? 'Choose a new password of at least 8 characters.'
                : 'You sign in with Google. Add a password to also sign in with your email and password.'}
            </Muted>
            <Field label={hasPassword ? 'New password' : 'Password'} hint="At least 8 characters.">
              <Input value={pw} onChange={setPw} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
            </Field>
            <Field label="Type it again">
              <Input value={pw2} onChange={setPw2} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={changePassword} />
            </Field>
            <Note msg={pwMsg} />
            <Row gap={8} wrap>
              <Btn icon="lock-simple" title={pwBusy ? 'Saving…' : hasPassword ? 'Change password' : 'Add password'} disabled={pwBusy || !pw} onPress={changePassword} />
            </Row>
            {hasPassword && user.email && (
              <RuledRow faint style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 10, gap: 8, flexWrap: 'wrap' }}>
                <T size={13} color={C.n400}>Forgot your password?</T>
                <Btn variant="ghost" title={resetBusy ? 'Sending…' : 'Send a reset email'} disabled={resetBusy} onPress={sendReset} />
              </RuledRow>
            )}
          </Card>

          <Card gap={12}>
            <Row gap={8}>
              <CardTitle style={{ flex: 1 }}>Subscription &amp; payments</CardTitle>
              <Tag variant={subStatus.tone}>{subStatus.tag}</Tag>
            </Row>
            <T size={14}>{subStatus.line}</T>
            {!billingLive() && (
              <View style={{ gap: 8, padding: 12, borderRadius: R.md, boxShadow: `inset 0 0 0 1px ${C.n800}` }}>
                <Row gap={8}><Icon name="info" size={16} color={C.accent} /><T size={13} style={{ flex: 1 }}>Payments aren't switched on yet. Nobody is charged, and every feature is open.</T></Row>
              </View>
            )}
            {PLANS.map(p => (
              <InfoRow key={p.id} label={p.name}><Row gap={8} wrap><T size={14}>{`${p.price}/${p.per}`}</T>{p.recommended && <Tag variant="accent">Save 40%</Tag>}</Row></InfoRow>
            ))}
            <InfoRow label="Free trial"><T size={14}>{`${TRIAL_DAYS} days`}</T></InfoRow>
            <Muted size={12}>If you cancel, you keep full access until the end of the period you've paid for. After that, paid features lock, but your data is kept, so everything comes back if you subscribe again.</Muted>
            {!access.full && <Btn variant="primary" title="See plans" onPress={() => RG.go('upgrade')} style={{ alignSelf: 'flex-start' }} />}
            {manageUrl && sub?.status !== 'comp' && (
              <Btn icon="credit-card" title="Manage or cancel subscription" onPress={() => Linking.openURL(manageUrl)} style={{ alignSelf: 'flex-start' }} />
            )}
          </Card>
        </Grid>
      )}

      <Dialog open={confirmEmail} onClose={() => setConfirmEmail(false)} title="Change your email?"
        body={`We'll send a confirmation link to ${newEmail.trim()}. Your sign-in email stays ${user?.email || 'the same'} until you tap it.`}
        actions={<><Btn title="Cancel" onPress={() => setConfirmEmail(false)} /><Btn variant="primary" icon="envelope" title="Send link" onPress={changeEmail} /></>} />

      <Dialog open={confirmOut} onClose={() => setConfirmOut(false)} title="Sign out?"
        body="Your data is saved to your account. Sign in again to pick up where you left off."
        actions={<><Btn title="Cancel" onPress={() => setConfirmOut(false)} /><Btn variant="primary" icon="sign-out" title={outBusy ? 'Signing out…' : 'Sign out'} disabled={outBusy} onPress={doSignOut} /></>} />
    </Screen>
  );
}
