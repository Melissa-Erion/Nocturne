/* A user with no subscription while the paywall is on. Meals is free for today; the rest asks for the trial. */
import { expect, test } from '@playwright/test';
import { finishSetup, skipTour, watchErrors } from './helpers';

test.beforeEach(async ({ page }) => {
  await finishSetup(page);
  await expect(page).toHaveURL(/\/upgrade$/); // free users see their plan and the trial offer after setup
  await page.goto('/dashboard');
  await skipTour(page);
});

const closePrompt = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Not now', exact: true }).click();

test('Meals is free for today; other days, swaps and favourites ask for the trial', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/meals');
  await expect(page.getByText('Included with Regimen Pro')).toHaveCount(0);
  await page.getByLabel('Search foods').fill('chicken');
  await page.getByRole('button', { name: /^Add .*[Cc]hicken/ }).first().click();
  await expect(page.getByText(/Portions updated/)).toBeVisible();
  await page.getByRole('button', { name: 'Next day (Regimen Pro)' }).click();
  await expect(page.getByText('Planning the rest of your week is part of Regimen Pro')).toBeVisible();
  await closePrompt(page);
  await page.getByRole('button', { name: 'Swap', exact: true }).first().click();
  await expect(page.getByText('Food substitutions is part of Regimen Pro')).toBeVisible();
  await closePrompt(page);
  await page.getByRole('button', { name: 'Mark as eaten' }).first().click();
  await expect(page.getByText('Eaten · undo').first()).toBeVisible();
  await page.getByRole('button', { name: 'Save as favourite meal' }).click();
  await expect(page.getByText('Saved meals is part of Regimen Pro')).toBeVisible();
  await page.getByRole('button', { name: /Start 7-day free trial/ }).first().click();
  await expect(page).toHaveURL(/\/upgrade$/);
  // the page opens at the plans, so the checkout is in view without scrolling (matters on a phone)
  await expect(page.getByRole('button', { name: 'Monthly plan' })).toBeInViewport();
  errors.expectNone();
});

test('Pro pages show the upgrade screen; Today still works', async ({ page }) => {
  const errors = watchErrors(page);
  for (const r of ['schedule', 'nutrition', 'checkins']) {
    await page.goto('/' + r);
    await expect(page.getByText('Included with Regimen Pro')).toBeVisible();
  }
  await page.goto('/dashboard');
  await page.getByText('Ate it', { exact: true }).click();
  await expect(page.getByText(/marked as eaten/)).toBeVisible();
  errors.expectNone();
});
