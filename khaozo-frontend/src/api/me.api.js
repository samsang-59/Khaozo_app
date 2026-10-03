import { api } from './client.js';

export const getMe = () => api.get('/me');
export const updateMe = (fields) => api.patch('/me', fields); // { name?, journalVisibility? }
export const deleteMe = () => api.del('/me', { confirm: 'DELETE' });

export const getTasteProfile = () => api.get('/me/taste-profile');
export const saveTasteQuiz = (answers) => api.put('/me/taste-profile', answers);
export const editTasteProfile = (fields) => api.patch('/me/taste-profile', fields);
