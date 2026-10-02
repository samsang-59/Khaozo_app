// Cloudinary files that could not be deleted during account deletion (retried by BullMQ).
import * as photoService from '../services/photo.service.js';

export default async ({ publicIds }) => (await photoService.destroyFiles(publicIds)).data;
