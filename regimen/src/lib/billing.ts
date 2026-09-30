/* Payments on the web through RevenueCat Billing (Stripe). The app user id is the Supabase user id, so the
   RevenueCat webhook (supabase/functions/revenuecat-webhook) can write public.subscriptions for that user.
   Phone apps will use the App Store / Google Play through react-native-purchases later. */
import { Platform } from 'react-native';
import type { CustomerInfo, Offering, Package, Purchases as RCPurchases } from '@revenuecat/purchases-js';
import { billingMode, type Subscription } from './plans';

/** Public (publishable) RevenueCat keys, safe to ship. Sandbox = Stripe test mode, no real charges. */
const KEY = billingMode() === 'sandbox'
  ? process.env.EXPO_PUBLIC_REVENUECAT_WEB_SANDBOX_KEY
  : process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY;

/** Payments can be made on this device. */
export const canPurchase = () => Platform.OS === 'web' && !!KEY && billingMode() !== 'off';

let rc: RCPurchases | null = null;
let rcUser: string | null = null;

async function client(userId: string): Promise<RCPurchases> {
  const { Purchases } = await import('@revenuecat/purchases-js');
  if (!rc) { rc = Purchases.configure({ apiKey: KEY!, appUserId: userId }); rcUser = userId; }
  else if (rcUser !== userId) { await rc.changeUser(userId); rcUser = userId; }
  return rc;
}

/** The current offering's yearly and monthly packages (real prices from RevenueCat). */
export async function loadPackages(userId: string): Promise<{ yearly?: Package; monthly?: Package } | null> {
  if (!canPurchase()) return null;
  const o: Offering | null = (await (await client(userId)).getOfferings({ currency: 'CAD' })).current;
  if (!o) return null;
  const pick = (type: string, word: string) =>
    o.availablePackages.find(p => p.packageType === type) || o.availablePackages.find(p => p.identifier.toLowerCase().includes(word));
  return { yearly: pick('$rc_annual', 'annual'), monthly: pick('$rc_monthly', 'month') };
}

/** Access derived from RevenueCat directly: used right after a purchase, before the webhook has updated the database. */
export function subFromCustomerInfo(ci: CustomerInfo): Subscription | null {
  const ent = Object.values(ci.entitlements.active)[0];
  if (!ent) return null;
  return {
    status: ent.willRenew ? 'active' : 'canceled',
    plan: /year|annual/i.test(ent.productIdentifier) ? 'yearly' : 'monthly',
    periodEnd: ent.expirationDate ? ent.expirationDate.toISOString() : null,
  };
}

export async function currentAccess(userId: string): Promise<{ sub: Subscription | null; manageUrl: string | null } | null> {
  if (!canPurchase()) return null;
  const ci = await (await client(userId)).getCustomerInfo();
  return { sub: subFromCustomerInfo(ci), manageUrl: ci.managementURL };
}

export type BuyResult = { ok: true; sub: Subscription | null } | { ok: false; cancelled: boolean; message: string };

/** Opens RevenueCat's checkout (card entry, trial terms) over the app. */
export async function buy(userId: string, pkg: Package, email?: string | null): Promise<BuyResult> {
  try {
    const r = await (await client(userId)).purchase({ rcPackage: pkg, customerEmail: email || undefined });
    return { ok: true, sub: subFromCustomerInfo(r.customerInfo) };
  } catch (e) {
    const code = (e as { errorCode?: number }).errorCode;
    if (code === 1) return { ok: false, cancelled: true, message: '' }; // UserCancelledError
    if (code === 6) return { ok: false, cancelled: false, message: 'You already have Regimen Pro. Refresh the page if it isn’t showing yet.' };
    return { ok: false, cancelled: false, message: e instanceof Error && e.message ? e.message : 'The payment didn’t go through. Please try again.' };
  }
}
