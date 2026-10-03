// Flow 6: Group mode with 2 browser contexts — host creates, a guest joins with a name,
// both get ready, host picks a spot, suggestions, both vote → winner on both screens.
import { test, expect } from './fixtures.js';

test('create, join as guest, vote, winner', async ({ browser, page, context, signIn }) => {
  await signIn(context, 'Group Host');
  await page.goto('/groups');
  await page.getByRole('button', { name: 'Start a group' }).click();
  await expect(page).toHaveURL(/\/g\/[A-Z0-9]{6}\/room/);
  const code = page.url().match(/\/g\/([A-Z0-9]{6})\/room/)[1];
  await expect(page.getByRole('heading', { name: `Group ${code}` })).toBeVisible();

  // Guest in a separate browser (no account)
  const guestCtx = await browser.newContext({ geolocation: { latitude: 20.3589, longitude: 85.8231 }, permissions: ['geolocation'] });
  const guest = await guestCtx.newPage();
  await guest.goto(`/g/${code}`);
  await guest.getByLabel('Your name').fill('Neha');
  await guest.getByRole('button', { name: 'Join as guest' }).click();
  await expect(guest).toHaveURL(new RegExp(`/g/${code}/room`));
  await expect(page.getByText('Neha', { exact: false }).first()).toBeVisible(); // live snapshot on the host

  // Both ready
  for (const p of [page, guest]) {
    await p.getByRole('button', { name: /My prefs|I'm ready/ }).first().click();
    await p.getByRole('dialog', { name: 'What do you want?' }).getByRole('button', { name: "I'm ready" }).click();
    await expect(p.getByRole('dialog', { name: 'What do you want?' })).toBeHidden();
  }
  await expect(page.getByText('2 ready')).toBeVisible();

  // Host picks a spot and gets suggestions
  await page.getByRole('button', { name: 'Patia' }).click();
  await page.getByRole('button', { name: 'Get suggestions' }).click();
  await expect(page.getByRole('heading', { name: 'Vote for one' })).toBeVisible({ timeout: 15000 });
  await expect(guest.getByRole('heading', { name: 'Vote for one' })).toBeVisible();

  // Both vote for the first suggestion → everyone voted → auto-end
  await page.getByRole('button', { name: 'Vote', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '✓ Your vote' })).toBeVisible();
  await guest.getByRole('button', { name: 'Vote', exact: true }).first().click();

  for (const p of [page, guest]) {
    await expect(p.getByText("You're eating at")).toBeVisible({ timeout: 15000 });
    await expect(p.getByRole('link', { name: /Open in Maps/ })).toBeVisible();
  }
  await expect(page.getByText('Saved to your past groups')).toBeVisible();
  await guestCtx.close();
});
