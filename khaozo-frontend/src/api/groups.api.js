import { api } from './client.js';

// A guest acts with their guest pass; a signed-in user with the normal access token.
const asGuest = (guestPass) => (guestPass ? { headers: { Authorization: `Bearer ${guestPass}` }, skipAuthRefresh: true } : undefined);

export const createGroup = ({ name, guestPass } = {}) => api.post('/groups', name ? { name } : {}, asGuest(guestPass));
export const joinGroup = (code, { name, guestPass } = {}) => api.post(`/groups/${code}/join`, name ? { name } : {}, asGuest(guestPass));
export const peekGroup = (code) => api.get(`/groups/${code}`);
export const listMyGroups = () => api.get('/me/groups');
