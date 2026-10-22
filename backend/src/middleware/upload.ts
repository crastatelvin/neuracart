import multer from 'multer';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      callback(
        new AppError(
          'Only JPG, PNG, and WebP images are allowed',
          422,
          'INVALID_FILE_TYPE',
        ),
      );
      return;
    }
    callback(null, true);
  },
});
