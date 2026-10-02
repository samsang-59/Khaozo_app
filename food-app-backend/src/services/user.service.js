// userService — profile, journal visibility (account deletion added in Phase 8).
import * as userRepo from '../repositories/user.repo.js';
import { ok, fail } from '../utils/result.js';

const toProfile = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatarUrl,
  role: u.role,
  journalVisibility: u.journalVisibility,
  createdAt: u.createdAt,
});

export const getProfile = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) return fail('USER_NOT_FOUND');
  return ok(toProfile(user));
};

export const updateProfile = async (userId, { name, journalVisibility }) => {
  const user = await userRepo.updateProfile(userId, { name, journalVisibility });
  if (!user) return fail('USER_NOT_FOUND');
  return ok(toProfile(user));
};
