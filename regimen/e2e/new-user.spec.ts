/* A brand-new user (no sample data) completes setup and every page opens without errors. */
import { expect, test } from '@playwright/test';
import { finishSetup, skipTour, watchErrors } from './helpers';

const ROUTES = ['dashboard', 'schedule', 'plans', 'history', 'workout', 'meals', 'nutrition', 'prep', 'recipes', 'grocery',
  'alternatives', 'checkins', 'photos', 'records', 'analytics', 'settings', 'account', 'upgrade'];

test('setup, then every page', async ({ page }) => {
  const errors = watchErrors(page);
  await finishSetup(page);
  await skipTour(page);
  for (const r of ROUTES) {
    await page.goto('/' + r);
    await expect(page.locator('body')).not.toContainText(/Something went wrong|Unmatched Route|NaN|undefined/);
  }
  errors.expectNone();
});
