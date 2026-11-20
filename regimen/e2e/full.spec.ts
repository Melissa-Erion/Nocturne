/* Full access (paywall off), with the sample data set. */
import { expect, test } from '@playwright/test';
import { isPhone, openMe, openTab, section, startWithSample, watchErrors } from './helpers';

test.beforeEach(async ({ page }) => { await startWithSample(page); });

test('Today: quick log weight and water, mark the next meal as eaten', async ({ page }) => {
  const errors = watchErrors(page);
  await expect(page.getByText('Food left today')).toBeVisible();
  await page.getByRole('button', { name: 'Weight' }).first().click();
  await page.getByRole('dialog').locator('input').first().fill('70.5');
  await page.getByText('Save', { exact: true }).click();
  await expect(page.getByText(/Weight logged/)).toBeVisible();
  await page.getByRole('button', { name: /Water \+250/ }).click();
  await expect(page.getByText('250 ml of water added.')).toBeVisible();
  await page.getByText('Ate it', { exact: true }).click();
  await expect(page.getByText(/marked as eaten/)).toBeVisible();
  errors.expectNone();
});

test('every tab and section opens', async ({ page }) => {
  const errors = watchErrors(page);
  const tabs: [Parameters<typeof openTab>[1], [string, string][]][] = [
    ['Train', [['Schedule', 'schedule'], ['Plans', 'plans'], ['History', 'history']]],
    ['Eat', [['Meals', 'meals'], ['Macros', 'nutrition'], ['Prep', 'prep'], ['Recipes', 'recipes'], ['Groceries', 'grocery']]],
    ['Progress', [['Check-ins', 'checkins'], ['Photos', 'photos'], ['Records', 'records'], ['Analytics', 'analytics']]],
  ];
  for (const [tab, secs] of tabs) {
    await openTab(page, tab);
    for (const [label, route] of secs) {
      await section(page, label).click();
      await expect(page).toHaveURL(new RegExp(`/${route}$`));
      await expect(page.getByText('Included with Regimen Pro')).toHaveCount(0);
    }
  }
  // tabs reopen the section used last
  await openTab(page, 'Train'); await section(page, 'History').click();
  await openTab(page, 'Today'); await openTab(page, 'Train');
  await expect(page).toHaveURL(/\/history$/);
  await openMe(page);
  await section(page, 'Account').click();
  await expect(page).toHaveURL(/\/account$/);
  errors.expectNone();
});

test('Meals: add a food, swap it, expand the target split', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/meals');
  await expect(page.getByText(/already planned for you/)).toBeVisible();
  await expect(page.getByText('Calculate portions')).toHaveCount(0);
  await page.getByLabel('Search foods').fill('chicken');
  await page.getByRole('button', { name: /^Add .*[Cc]hicken/ }).first().click();
  await expect(page.getByText(/Portions updated to fit this meal/)).toBeVisible();
  await page.getByRole('button', { name: 'Swap', exact: true }).first().click();
  await expect(page).toHaveURL(/\/alternatives$/);
  await page.getByRole('button', { name: /^Use \d/ }).first().click();
  await expect(page).toHaveURL(/\/meals$/);
  await expect(page.getByText(/refitted around it/)).toBeVisible();
  await page.getByLabel('Show how targets are split').click();
  await expect(page.getByText('Sum of meals')).toBeVisible();
  errors.expectNone();
});

test('Workout: start, minimise, resume, discard', async ({ page }) => {
  const errors = watchErrors(page);
  const start = page.getByText('Start workout', { exact: true });
  test.skip(!(await start.count()), 'rest day in the sample schedule');
  await start.first().click();
  await expect(page).toHaveURL(/\/workout$/);
  if (isPhone(page)) {
    await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveCount(0); // full screen, no tab bar
    await page.getByRole('button', { name: 'Minimise workout' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByText(/tap to resume/).click();
    await expect(page).toHaveURL(/\/workout$/);
  }
  await page.getByText('Discard session', { exact: true }).click();
  await page.getByText('Discard', { exact: true }).click();
  await expect(page.getByText(/tap to resume/)).toHaveCount(0);
  errors.expectNone();
});

test('check-in form and upgrade page open', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/checkins');
  await page.getByText('New check-in', { exact: true }).first().click();
  await expect(page.getByText('Save check-in')).toBeVisible();
  await page.goto('/upgrade');
  await expect(page.getByText('You have full access')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Something went wrong/);
  errors.expectNone();
});

test('Log something else trims the remaining meals, and removing it restores them', async ({ page }) => {
  const errors = watchErrors(page);
  await page.getByRole('button', { name: 'Log something else' }).click();
  await page.getByText('Quick estimate', { exact: true }).click();
  await page.getByLabel('What you ate').fill('Latte');
  await page.getByLabel('Calories').fill('190');
  await page.getByRole('button', { name: 'Log it' }).click();
  await expect(page.getByText(/Latte logged \(190 kcal\)\. Your remaining meals were trimmed/)).toBeVisible();
  await page.goto('/meals');
  await expect(page.getByText('Latte', { exact: true })).toBeVisible();
  await expect(page.getByText(/Trimmed from/).first()).toBeVisible();
  // a library food, by search
  await page.getByRole('button', { name: 'Log something else' }).click();
  await page.getByLabel('Search foods to log').fill('banana');
  await page.getByRole('button', { name: /^Pick Banana/ }).first().click();
  await page.getByRole('button', { name: 'Log it' }).click();
  await expect(page.getByText(/Banana logged/)).toBeVisible();
  await page.getByRole('button', { name: 'Remove Latte' }).click();
  await expect(page.getByText(/Latte removed/)).toBeVisible();
  errors.expectNone();
});
