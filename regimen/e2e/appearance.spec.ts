/* Light / dark switch in Me › Settings, remembered after a reload. */
import { expect, test } from '@playwright/test';
import { startWithSample, watchErrors } from './helpers';

const bg = (page: import('@playwright/test').Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('switch to light, reload, switch back', async ({ page }) => {
  const errors = watchErrors(page);
  await startWithSample(page);
  await page.goto('/settings');
  await page.getByText('Light', { exact: true }).first().click();
  await expect.poll(() => bg(page)).toBe('rgb(243, 239, 231)');
  for (const r of ['dashboard', 'meals', 'schedule', 'analytics']) {
    await page.goto('/' + r); // a full reload: the choice is remembered
    await expect.poll(() => bg(page)).toBe('rgb(243, 239, 231)');
  }
  await page.goto('/settings');
  await page.getByText('Dark', { exact: true }).first().click();
  await expect.poll(() => bg(page)).toBe('rgb(18, 19, 29)');
  errors.expectNone();
});
