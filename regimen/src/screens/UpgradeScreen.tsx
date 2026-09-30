/* Upgrade / paywall. Shown after onboarding ("Your plan is ready" with a preview of the user's own plan)
   and in place of any locked screen (explaining what it unlocks). Checkout is RevenueCat Billing (Stripe) on the web. */
import type { Package } from '@revenuecat/purchases-js';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { buy, canPurchase, loadPackages } from '@/lib/billing';
import { billingLive, billingMode, FEATURE, PLANS, TRIAL_DAYS } from '@/lib/plans';
import { useAccess } from '@/store/access';
import { refreshSubscription, useUI } from '@/store/store';
import { useRG } from '@/store/rg';
import { Btn, Card, CardTitle, Grid, H, Icon, Kicker, Muted, NotMedical, Row, RuledRow, T, Tag, Tap } from '@/ui/kit';
import { alpha, C } from '@/ui/theme';
import { Screen } from './Shell';

const UNLOCKS: [string, string][] = [
  ['fork-knife', 'Meal builder with exact portions solved to hit your macros'],
  ['swap', 'Food substitutions matched on protein, carbs or fat'],
  ['cooking-pot', 'Meal prep amounts and an automatic grocery list'],
  ['calendar-blank', 'Workout scheduling that keeps your rotation on track'],
  ['barbell', 'Guided workouts with rest timers and set logging'],
  ['arrow-up-right', 'Progression: exact weight and rep targets every session'],
  ['chart-line-up', 'Check-ins, progress photos, records and analytics'],
];

export function Paywall({ feature }: { feature?: string }) {
  const RG = useRG();
  const access = useAccess();
  const [plan, setPlan] = useState<'yearly' | 'monthly'>('yearly');
  const f = feature ? FEATURE[feature] : null;
  const P = RG.s.profile;
  const T0 = RG.TODAY;
  const tgt = RG.dayTargets('training');
  const mon = RG.monday(T0);
  const week = [0, 1, 2, 3, 4, 5, 6].map(i => RG.add(mon, i)).flatMap(d => RG.entriesOn(d).filter(e => e.status !== 'missed').map(e => ({ d, w: RG.workout(e.workoutId, e.planId) })));
  const first = RG.plan()?.workouts[0];
  const live = billingLive();
  const userId = useUI(u => u.userId);
  const email = useUI(u => u.email);
  const [pkgs, setPkgs] = useState<{ yearly?: Package; monthly?: Package } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!userId || !canPurchase() || access.full) return;
    let on = true;
    loadPackages(userId).then(p => { if (on) setPkgs(p); }).catch(() => { if (on) setErr('Couldn’t load prices. Check your connection and refresh.'); });
    return () => { on = false; };
  }, [userId, access.full]);
  // Real prices from RevenueCat once loaded; the built-in ones until then.
  const priceOf = (id: 'yearly' | 'monthly') => pkgs?.[id]?.webBillingProduct.currentPrice.formattedPrice || PLANS.find(p => p.id === id)!.price;
  const chosen = { ...PLANS.find(p => p.id === plan)!, price: priceOf(plan) };
  const blocked = !live ? 'Payments open soon. You won’t be charged.'
    : Platform.OS !== 'web' ? 'Subscriptions in the phone app are coming soon. For now, subscribe on the Regimen website with the same account.'
    : !userId ? 'Create an account or sign in first, so your subscription is saved to your account.'
    : null;

  const start = async () => {
    const pkg = pkgs?.[plan];
    if (!userId || !pkg) { setErr('Prices are still loading. Try again in a moment.'); return; }
    setBusy(true); setErr('');
    const r = await buy(userId, pkg, email);
    setBusy(false);
    if (!r.ok) { if (!r.cancelled) setErr(r.message); return; }
    if (r.sub) useUI.setState({ subscription: r.sub });
    RG.toast('Welcome to Regimen Pro. Everything is unlocked.', false);
    // The server records the subscription a few seconds later; pick it up.
    setTimeout(refreshSubscription, 4000); setTimeout(refreshSubscription, 15000);
    if (!f) RG.go('dashboard');
  };

  if (access.full) return (
    <Card>
      <Row gap={8}><Icon name="check-circle" fill size={18} color={C.accent} /><CardTitle>You have full access</CardTitle></Row>
      <Muted size={13}>Everything in Regimen is unlocked on your account.</Muted>
      <Row><Btn variant="primary" title="Go to dashboard" onPress={() => RG.go('dashboard')} /></Row>
    </Card>
  );

  return (
    <View style={{ gap: 16, maxWidth: 880 }}>
      {f ? (
        <View style={{ gap: 6 }}>
          <Row gap={8}><Icon name="lock-simple" size={18} color={C.accent} /><Kicker>Included with Regimen Pro</Kicker></Row>
          <H size={28}>{f.title}</H>
          <T size={14} color={C.n300}>{f.body}</T>
        </View>
      ) : (
        <>
          <View style={{ gap: 6 }}>
            <Kicker>Your plan is ready</Kicker>
            <H size={28}>{P.name ? `${P.name}, here's your plan` : "Here's your plan"}</H>
            <T size={14} color={C.n300}>Built from your details. Start your free trial to unlock everything.</T>
          </View>
          <Grid min={300}>
            <Card>
              <CardTitle>Your daily targets</CardTitle>
              <Row gap={16} wrap>
                {[['Calories', `${RG.num(tgt.kcal)}`], ['Protein', `${tgt.protein} g`], ['Carbs', `${tgt.carbs} g`], ['Fat', `${tgt.fat} g`]].map(([k, v]) => (
                  <View key={k}><T size={22} tab>{v}</T><Muted size={11}>{k}</Muted></View>
                ))}
              </Row>
              <NotMedical />
            </Card>
            <Card gap={6}>
              <CardTitle>Your training week</CardTitle>
              {week.length ? week.map(({ d, w }, i) => (
                <RuledRow key={i} style={{ flexDirection: 'row', gap: 10 }}>
                  <Muted size={13} tab style={{ width: 90 }}>{RG.fmtD(d)}</Muted>
                  <T size={13} style={{ flex: 1 }}>{w?.name || 'Workout'}</T>
                </RuledRow>
              )) : <Muted size={13}>Your workouts start on your next training day.</Muted>}
              {first && <Muted size={12}>{`${first.name}: ${first.items.slice(0, 4).map(i => RG.ex(i.exId)?.name).filter(Boolean).join(', ')}${first.items.length > 4 ? '…' : ''}`}</Muted>}
            </Card>
          </Grid>
        </>
      )}

      <Card gap={10}>
        <CardTitle>What you get</CardTitle>
        {UNLOCKS.map(([ic, txt]) => (
          <Row key={txt} gap={10} align="flex-start">
            <Icon name={ic as never} size={16} color={C.accent} style={{ marginTop: 2 }} />
            <T size={14} style={{ flex: 1 }}>{txt}</T>
          </Row>
        ))}
      </Card>

      <Grid min={260} gap={12}>
        {PLANS.map(p => {
          const on = plan === p.id;
          return (
            <Tap key={p.id} onPress={() => setPlan(p.id)} label={`${p.name} plan`}
              style={{ padding: 16, borderRadius: 10, borderWidth: 1, borderColor: on ? C.accent : C.n800, backgroundColor: on ? alpha(C.accent, 0.1) : C.surface, gap: 4 }}>
              <Row><T size={15} w={500} style={{ flex: 1 }}>{p.name}</T>{p.recommended && <Tag variant="accent">Best value</Tag>}</Row>
              <T size={24} tab>{priceOf(p.id)}<T size={14} color={C.n400}>{` / ${p.per}`}</T></T>
              <Muted size={12}>{p.note}</Muted>
            </Tap>
          );
        })}
      </Grid>

      <View style={{ gap: 8 }}>
        {billingMode() === 'sandbox' && !blocked && (
          <Row gap={8} style={{ justifyContent: 'center' }}><Tag variant="outline">Test mode</Tag><Muted size={12}>No real charges. Use card 4242 4242 4242 4242, any future date and any CVC.</Muted></Row>
        )}
        <Btn variant="primary" size="lg" disabled={!!blocked || busy || !pkgs?.[plan]}
          title={busy ? 'Opening checkout…' : `Start ${TRIAL_DAYS}-day free trial`} onPress={start} />
        {!!err && <Row gap={8} style={{ justifyContent: 'center' }}><Icon name="warning" size={16} color={C.n300} /><T size={13} color={C.n300}>{err}</T></Row>}
        <Muted size={12} style={{ textAlign: 'center' }}>
          {blocked
            ?? `Free for ${TRIAL_DAYS} days, then ${chosen.price}/${chosen.per} (Canadian dollars, plus any sales tax). Cancel anytime before the trial ends and you won't be charged. If you cancel later, paid features lock at the end of the period you've paid for, and your data is kept.`}
        </Muted>
        {!blocked && !pkgs && !err && <Muted size={12} style={{ textAlign: 'center' }}>Loading prices…</Muted>}
        <Row style={{ justifyContent: 'center' }}><Btn variant="ghost" title={f ? 'Back to dashboard' : 'Not now, continue with the free version'} onPress={() => RG.go('dashboard')} /></Row>
      </View>
    </View>
  );
}

export default function UpgradeScreen() {
  return <Screen><Paywall /></Screen>;
}
