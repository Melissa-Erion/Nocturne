/* Shared steps for the browser tests. */
import { expect, type Page } from '@playwright/test';

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 980;

/** Collect uncaught page errors and console errors; assert none at the end of a test. */
export function watchErrors(page: Page) {
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  return { expectNone: () => expect(errs, errs.join('\n')).toEqual([]) };
}

export async function skipTour(page: Page) {
  const skip = page.getByText('Skip tour', { exact: true });
  if (await skip.count()) await skip.first().click();
}

/** Fresh visitor → "Explore with sample data" → Today. */
export async function startWithSample(page: Page) {
  await page.goto('/');
  await page.getByText('Explore with sample data', { exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await skipTour(page);
}

/** Fresh visitor → completes the 6-step setup with sensible answers. */
export async function finishSetup(page: Page) {
  await page.goto('/');
  await expect(page.getByText(/step 1 of 6/)).toBeVisible();
  for (let i = 0; i < 8 && page.url().includes('onboarding'); i++) {
    if (await page.getByText('About you', { exact: true }).count()) {
      const inputs = page.locator('input:visible');
      const values = ['Sam', '72', '66', '168', '32']; // name, weight, goal weight, height, age
      for (let k = 0; k < values.length; k++) await inputs.nth(k).fill(values[k]);
    }
    await page.getByRole('button', { name: /^(Continue|Save & build schedule)$/ }).first().click();
    await page.waitForTimeout(500);
  }
  await expect(page).not.toHaveURL(/onboarding/);
}

/** Open a main tab (phone: bottom tab bar; desktop: sidebar). */
export async function openTab(page: Page, name: 'Today' | 'Train' | 'Eat' | 'Progress') {
  if (isPhone(page)) await page.getByRole('tab', { name, exact: true }).first().click();
  else await page.getByRole('link', { name, exact: true }).first().click();
}

export async function openMe(page: Page) {
  if (isPhone(page)) await page.getByRole('button', { name: 'Me: settings and account' }).click();
  else await page.getByRole('link', { name: 'Me', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
}

export const section = (page: Page, name: string) => page.getByRole('tab', { name, exact: true }).first();
