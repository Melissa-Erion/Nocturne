/* Access to paid features. See src/lib/plans.ts for the rules. */
import { billingLive, FREE_ROUTES, hasFullAccess, paywallPreview } from '@/lib/plans';
import { useUI } from './store';

export function useAccess() {
  const sub = useUI(u => u.subscription);
  const full = hasFullAccess(sub);
  return {
    full,
    sub,
    /** true when the paywall is actually in force (billing live or preview) */
    enforced: billingLive() || paywallPreview(),
    canOpen: (route: string) => full || FREE_ROUTES.has(route),
  };
}
