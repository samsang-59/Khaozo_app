// Flow 1: Discover (no login) — search → place → dish → "Best … in town"; back keeps the page
import { test, expect, world } from './fixtures.js';

test('search → place → dish → best for dish', async ({ page }) => {
  const w = world();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Stop guessing/ })).toBeVisible();

  const search = page.getByRole('searchbox').first();
  await search.fill('chicken dum biryani');
  await search.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=chicken/);

  const row = page.getByRole('link', { name: new RegExp(w.placeName) }).first();
  await expect(row).toBeVisible();
  await row.click();

  // Search rows for a dish open the dish page; the place link is on it
  await expect(page).toHaveURL(new RegExp(`/menu-items/${w.biryaniItemId}`));
  await expect(page.getByRole('heading', { name: 'Chicken Dum Biryani' })).toBeVisible();
  await expect(page.getByText('Must order').first()).toBeVisible();

  await page.getByRole('link', { name: `at ${w.placeName}` }).click();
  await expect(page).toHaveURL(new RegExp(`/places/${w.placeId}`));
  await expect(page.getByRole('heading', { name: w.placeName })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order this' })).toBeVisible();

  await page.getByRole('link', { name: /Chicken Dum Biryani/ }).first().click();
  await page.getByRole('link', { name: /Best Chicken Dum Biryani in town/ }).click();
  await expect(page).toHaveURL(new RegExp(`/dishes/${w.biryaniDishId}`));
  await expect(page.getByText('Best in Bhubaneswar')).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(w.placeName) })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/menu-items/${w.biryaniItemId}`));
});

test('logged out: Rate opens the Login sheet', async ({ page }) => {
  const w = world();
  await page.goto(`/menu-items/${w.dalmaItemId}`);
  await page.getByRole('button', { name: 'Rate this dish' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Save this to your journal' })).toBeVisible();
});
