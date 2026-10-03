// Flow 3: Rate a dish (signed in) — ★ + order again → Save → toast → journal; then edit mode
import { test, expect, world } from './fixtures.js';

test('rate a dish, see it in the journal, reopen in edit mode', async ({ page, context, signIn }) => {
  const w = world();
  await signIn(context, 'Rate Tester');
  await page.goto(`/menu-items/${w.dalmaItemId}`);

  await page.getByRole('button', { name: 'Rate this dish' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Dalma' });
  await expect(sheet).toBeVisible();
  const save = sheet.getByRole('button', { name: 'Save rating' });
  await expect(save).toBeDisabled(); // stars + order again are required

  await sheet.getByRole('radio', { name: '5 stars' }).click();
  await expect(save).toBeDisabled();
  await sheet.getByRole('radio', { name: 'Yes' }).click();
  await sheet.getByRole('button', { name: /More details/ }).click();
  await sheet.getByLabel('Short review').fill('Comforting, just like home.');
  await save.click();

  await expect(page.getByText('Added to your journal')).toBeVisible();
  await expect(page.getByText('Your rating ·', { exact: false }).first()).toBeVisible();

  // Edit mode within 30 days
  await page.getByRole('button', { name: 'Edit rating' }).click();
  await expect(page.getByRole('dialog', { name: 'Dalma' }).getByRole('button', { name: 'Save changes' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/journal');
  await expect(page.getByRole('link', { name: 'Dalma' }).first()).toBeVisible();
  await expect(page.getByText('Comforting, just like home.')).toBeVisible();
});

test('reload keeps you signed in (silent refresh)', async ({ page, context, signIn }) => {
  await signIn(context, 'Reload Tester');
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: 'Reload Tester' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Reload Tester' })).toBeVisible();
});
