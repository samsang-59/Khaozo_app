import { api } from './client.js';

export const loginWithGoogle = (idToken) => api.post('/auth/google', { idToken });
export const logout = () => api.post('/auth/logout');
export const logoutAll = () => api.post('/auth/logout-all');
