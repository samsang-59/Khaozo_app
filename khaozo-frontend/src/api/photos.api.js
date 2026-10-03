import { api, cleanParams } from './client.js';

// target: 'ratings' | 'reviews' | 'places'; files: already-compressed File/Blob list (max 3)
export const uploadPhotos = (target, id, files) => {
  const form = new FormData();
  files.forEach((f, i) => form.append('photos', f, f.name ?? `photo-${i + 1}.jpg`));
  return api.post(`/${target}/${id}/photos`, form, { timeout: 60000 });
};
export const deletePhoto = (id) => api.del(`/photos/${id}`);
export const listPlacePhotos = (placeId, params) => api.get(`/places/${placeId}/photos`, cleanParams(params));
