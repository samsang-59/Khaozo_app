// Phone photos are 4–8 MB and the API takes ≤ 5 MB → shrink in the browser first (~1600 px, < 1 MB).
import imageCompression from 'browser-image-compression';

export const MAX_PHOTOS = 3;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export const isAcceptedImage = (file) => ACCEPTED.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);

export const compressImage = async (file) => {
  // HEIC can't be decoded by most browsers' canvas → send as is (backend accepts HEIC ≤ 5 MB)
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) return file;
  const out = await imageCompression(file, { maxWidthOrHeight: 1600, maxSizeMB: 1, useWebWorker: true, initialQuality: 0.82 });
  return new File([out], file.name.replace(/\.\w+$/, '') + '.jpg', { type: out.type || 'image/jpeg' });
};
