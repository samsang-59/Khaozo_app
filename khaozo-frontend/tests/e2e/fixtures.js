import { readFileSync } from 'node:fs';
import { test as base, expect } from '@playwright/test';
import { closeDb, createUser, refreshCookie } from './backend.js';

export const world = () => JSON.parse(readFileSync(new URL('./.auth/world.json', import.meta.url), 'utf8'));

// signIn(context, name) → a fresh user, signed in through a real refresh session
export const test = base.extend({
  signIn: async ({}, use) => {
    await use(async (context, name = 'E2E Tester') => {
      const user = await createUser(name);
      await context.addCookies([await refreshCookie(user)]);
      return user;
    });
    await closeDb();
  },
});
export { expect };
