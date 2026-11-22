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
  await expect(page.getByText(/Your meals$/)).toBeVisible();
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

test('Meals: choose my foods builds every meal from the picks and survives a reload', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/meals');
  await page.getByRole('button', { name: 'Choose my foods' }).click();
  await expect(page.getByText(/step 1 of 4/)).toBeVisible();
  // breakfast: keep what's there and add oats; lunch: start from scratch with chicken and rice
  await page.getByRole('button', { name: 'Add Rolled oats' }).click();
  await page.getByRole('button', { name: /^Next: / }).click();
  const picked = page.getByRole('button', { name: /^Remove / }).filter({ hasText: '✓' });
  while (await picked.count()) await picked.first().click();
  await page.getByRole('button', { name: 'Add Chicken breast, skinless' }).click();
  await page.getByRole('button', { name: 'Add White rice, long-grain' }).click();
  await page.getByRole('button', { name: /^Next: / }).click();
  await page.getByRole('button', { name: /^Next: / }).click();
  await page.getByRole('button', { name: 'Build my meals' }).click();
  await expect(page.getByText(/Your meals are built/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change my foods' })).toBeVisible();
  // the sample day already has breakfast and lunch eaten (those stay as they were), so check tomorrow
  await page.getByRole('button', { name: 'Next day' }).click();
  await page.getByLabel(/^Open Breakfast/).click();
  await expect(page.getByLabel('Rolled oats grams')).toBeVisible();
  await page.getByLabel(/^Open Lunch/).click();
  await expect(page.getByLabel('Chicken breast, skinless grams')).toBeVisible();
  await expect(page.getByLabel('White rice, long-grain grams')).toBeVisible();
  await expect(page.getByLabel('Tuna, canned in water grams')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Change my foods' })).toBeVisible();
  errors.expectNone();
});

test('Workout: start, minimise, resume, discard', async ({ page }) => {
  const errors = watchErrors(page);
  const start = page.getByText('Start workout', { exact: true });
  test.skip(!(await start.count()), 'rest day in the sample schedule');
  await start.first().click();
  await expect(page).toHaveURL(/\/workout$/);
  // one exercise at a time: log a set with the big button, the rest timer starts
  await expect(page.getByText(/^Target today/).first()).toBeVisible();
  await page.getByRole('button', { name: /^Log (set 1|warm-up)/ }).click();
  await expect(page.getByText('Skip rest', { exact: true })).toBeVisible();
  await page.getByText('Skip rest', { exact: true }).click();
  // jump to the second exercise from the row at the top
  await page.getByRole('tab', { name: /^Exercise 2:/ }).click();
  await expect(page.getByRole('button', { name: /^Log (set 1|warm-up)/ })).toBeVisible();
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

test('2-week calorie check can be answered and goes away', async ({ page }) => {
  const errors = watchErrors(page);
  const card = page.getByText('Your 2-week calorie check');
  test.skip(!(await card.count()), 'the sample weight trend gave too little data on this date');
  const apply = page.getByRole('button', { name: /^(Lower|Raise) to / });
  if (await apply.count()) {
    await apply.click();
    await expect(page.getByText(/Daily calories set to/)).toBeVisible();
  } else {
    await page.getByRole('button', { name: 'Got it' }).click();
  }
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Your 2-week calorie check')).toHaveCount(0); // remembered
  errors.expectNone();
});

test('a plan that is not active can be deleted; the active one cannot', async ({ page }) => {
  const errors = watchErrors(page);
  await openTab(page, 'Train'); await section(page, 'Plans').click();
  await expect(page.getByRole('button', { name: 'Delete plan' })).toHaveCount(0); // active plan shown
  await page.getByRole('button', { name: 'New plan' }).click();
  await expect(page.getByRole('button', { name: 'My plan' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete plan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete plan' }).click();
  await expect(page.getByText(/My plan deleted/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'My plan' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'My plan' })).toHaveCount(0);
  errors.expectNone();
});
