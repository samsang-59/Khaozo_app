// One-time: give the ADMIN_EMAIL user the admin role (they must have logged in once).
//   npm run make-admin
import { pathToFileURL } from 'node:url';
import { env } from '../src/config/env.js';
import { closeDb } from '../src/config/db.js';
import * as userRepo from '../src/repositories/user.repo.js';

export const makeAdmin = async (email = env.adminEmail) => {
  if (!email) throw new Error('ADMIN_EMAIL is not set in .env');
  const user = await userRepo.setRoleByEmail(email, 'admin');
  if (!user) throw new Error(`No user with email ${email} — log in with Google once first`);
  return user;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const user = await makeAdmin();
    console.log(`[make-admin] ${user.email} (id ${user.id}) is now admin`);
  } catch (err) {
    console.error(`[make-admin] ${err.message}`);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}
