// After a rating: update the user's learned taste (locked fields untouched).
import * as tasteProfileService from '../services/tasteProfile.service.js';

export default async ({ userId }) => (await tasteProfileService.learn(userId)).data;
