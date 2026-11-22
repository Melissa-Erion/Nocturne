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
  await page.getByRole('button', { name: /^Use / }).first().click();
  await expect(page.getByText(/^Swapped in /)).toBeVisible();
  await page.getByRole('button', { name: 'Just this once' }).click();
  await expect(page).toHaveURL(/\/meals$/);
  await page.getByLabel('Show how targets are split').click();
  await expect(page.getByText('Sum of meals')).toBeVisible();
  errors.expectNone();
});

test('Meals: choose foods, change one meal, fix an amount, swap for good', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/meals');
  await expect(page.getByText(/^Based on your goal/)).toBeVisible();
  await page.getByRole('button', { name: 'Choose my foods' }).click();
  for (const f of ['Greek yogurt, 0% plain', 'Rolled oats', 'Chicken breast, skinless', 'White rice, long-grain', 'Broccoli, steamed', 'Banana', 'Almonds'])
    await page.getByRole('button', { name: 'Add ' + f }).click();
  await page.getByRole('button', { name: 'Build my meals' }).click();
  await expect(page.getByText(/Your meals are built/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change my foods' })).toBeVisible();
  // the sample day already has breakfast and lunch eaten (those stay as they were), so check tomorrow
  await page.getByRole('button', { name: 'Next day' }).click();
  await page.getByLabel(/^Open Breakfast/).click();
  await expect(page.getByLabel('Rolled oats grams')).toBeVisible();
  await page.getByLabel(/^Open Lunch/).click();
  await expect(page.getByLabel('Chicken breast, skinless grams')).toBeVisible();
  await expect(page.getByLabel('Broccoli, steamed grams')).toBeVisible();

  // change just this meal: chicken out, tofu in
  await page.getByRole('button', { name: 'Change foods' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: /^Change / });
  await dialog.getByRole('button', { name: 'Remove Chicken breast, skinless' }).click();
  await dialog.getByRole('button', { name: 'Add Tofu, firm' }).click();
  await dialog.getByRole('button', { name: 'Save meal' }).click();
  await expect(page.getByLabel('Tofu, firm grams')).toBeVisible();
  await expect(page.getByLabel('Chicken breast, skinless grams')).toHaveCount(0);

  // typing an amount fixes it; Auto gives it back
  await page.getByLabel('White rice, long-grain grams').fill('60');
  await page.getByLabel('White rice, long-grain grams').blur();
  await expect(page.getByText('Fixed at 60 g')).toBeVisible();
  await page.getByRole('button', { name: 'Work out White rice, long-grain automatically' }).click();
  await expect(page.getByText(/^Fixed at/)).toHaveCount(0);

  // swap for good
  await page.getByRole('button', { name: 'Swap', exact: true }).first().click();
  await expect(page.getByText(/^Swap .* for…$/)).toBeVisible();
  await page.getByRole('button', { name: /^Use / }).first().click();
  await page.getByRole('button', { name: 'Yes, always' }).click();
  await expect(page).toHaveURL(/\/meals$/);
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

test('workout rotation: drag a row to reorder, or use its arrows', async ({ page }) => {
  const errors = watchErrors(page);
  await openTab(page, 'Train'); await section(page, 'Plans').click();
  const names = async () => (await page.getByRole('button', { name: /^Move .* up$/ }).evaluateAll(els => els.map(e => (e.getAttribute('aria-label') || '').replace(/^Move | up$/g, ''))));
  const before = await names();
  await page.getByRole('button', { name: `Move ${before[0]} down` }).click();
  expect(await names()).toEqual([before[1], before[0], ...before.slice(2)]);
  // drag the last row to the top by its handle
  const order = await names();
  const handle = page.getByLabel(`Drag ${order[order.length - 1]} to reorder`);
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let k = 1; k <= 10; k++) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - k * 52 * (order.length - 1) / 10);
  await page.mouse.up();
  expect((await names())[0]).toBe(order[order.length - 1]);
  errors.expectNone();
});

test('grocery list comes from the meal plan; items can be removed and put back', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/grocery');
  await expect(page.getByText(/Everything in your meals for the next 7 days/)).toBeVisible();
  await page.getByRole('button', { name: '3 days' }).click();
  await expect(page.getByText(/next 3 days/)).toBeVisible();
  const remove = page.getByRole('button', { name: /^Remove (?!sample)/ }).first();
  const name = (await remove.getAttribute('aria-label'))!.replace(/^Remove /, '');
  await remove.click();
  await expect(page.getByRole('button', { name: `Remove ${name}` })).toHaveCount(0);
  await page.getByRole('button', { name: /Show removed items \(1\)/ }).click();
  await page.getByRole('button', { name: `Put back ${name}` }).click();
  await expect(page.getByRole('button', { name: `Remove ${name}` })).toBeVisible();
  errors.expectNone();
});

test('meal prep from the plan updates with the chosen meals', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/prep');
  await expect(page.getByText('Prep from my meal plan')).toBeVisible();
  const count = async () => Number((await page.getByText(/^1\. Cook this \(\d+ containers\)$/).textContent())!.match(/\d+ containers/)![0].split(' ')[0]);
  const n0 = await count();
  await page.getByRole('button', { name: 'Breakfast' }).click();
  expect(await count()).toBeGreaterThan(n0);
  await expect(page.getByText('2. Pack your containers')).toBeVisible();
  errors.expectNone();
});
