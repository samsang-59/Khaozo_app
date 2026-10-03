import { api, cleanParams } from './client.js';

export const getJournal = (params) => api.get('/me/journal', cleanParams(params));
export const getStats = (period = 'all') => api.get('/me/stats', { period });
export const getContributions = () => api.get('/me/contributions');
export const getPublicJournal = (userId, params) => api.get(`/users/${userId}/journal`, cleanParams(params));
