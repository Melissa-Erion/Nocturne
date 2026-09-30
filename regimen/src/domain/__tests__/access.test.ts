/* Access rules: comp is permanent; trial/active/canceled keep access until the paid period ends; expired is locked;
   with billing off (and no preview) nobody is locked out. */
import { hasFullAccess, type Subscription } from '@/lib/plans';

const NOW = Date.parse('2026-09-30T12:00:00Z');
const sub = (status: Subscription['status'], periodEnd: string | null): Subscription => ({ status, plan: 'yearly', periodEnd });

describe('access rules', () => {
  it('billing off: everyone has full access', () => {
    expect(hasFullAccess(null, NOW, false)).toBe(true);
    expect(hasFullAccess(sub('expired', null), NOW, false)).toBe(true);
  });

  it('billing live: paid access follows the subscription', () => {
    expect(hasFullAccess(null, NOW, true)).toBe(false);                                   // free version
    expect(hasFullAccess(sub('comp', null), NOW, true)).toBe(true);                       // owner / complimentary
    expect(hasFullAccess(sub('trialing', '2026-10-05T00:00:00Z'), NOW, true)).toBe(true); // in trial
    expect(hasFullAccess(sub('active', '2026-10-30T00:00:00Z'), NOW, true)).toBe(true);
    expect(hasFullAccess(sub('canceled', '2026-10-15T00:00:00Z'), NOW, true)).toBe(true); // canceled: keeps access until period end
    expect(hasFullAccess(sub('canceled', '2026-09-29T00:00:00Z'), NOW, true)).toBe(false);// ...then locked
    expect(hasFullAccess(sub('active', '2026-09-01T00:00:00Z'), NOW, true)).toBe(false);  // lapsed renewal
    expect(hasFullAccess(sub('expired', '2026-12-01T00:00:00Z'), NOW, true)).toBe(false);
  });
});
