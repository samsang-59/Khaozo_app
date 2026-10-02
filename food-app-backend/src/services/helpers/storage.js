// storageService (helper) — Cloudinary upload / delete (used by photoService and, in Phase 8, userService).
// Credentials come from CLOUDINARY_URL in .env (the SDK reads it automatically).
// Photos are never stored in PostgreSQL — only the URL + public_id.
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({ secure: true });

const ROOT_FOLDER = 'khaozo';

// Cloudinary shrinks big phone photos on upload: max 1600 px side, automatic quality.
const INCOMING = [{ width: 1600, height: 1600, crop: 'limit' }, { quality: 'auto' }];

export const upload = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `${ROOT_FOLDER}/${folder}`, resource_type: 'image', transformation: INCOMING },
      (err, result) => (err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id })),
    );
    stream.end(buffer);
  });

export const destroy = async (publicId) => {
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
};

// Best effort for many files (e.g. after a failed DB write or a deleted rating)
export const destroyMany = async (publicIds) => {
  await Promise.allSettled(publicIds.map((id) => destroy(id)));
};
