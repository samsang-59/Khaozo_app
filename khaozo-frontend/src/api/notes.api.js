import { api } from './client.js';

export const listNotes = () => api.get('/me/notes');
export const createNote = (body) => api.post('/me/notes', body); // { placeId | menuItemId, text }
export const updateNote = (id, text) => api.patch(`/me/notes/${id}`, { text });
export const deleteNote = (id) => api.del(`/me/notes/${id}`);
