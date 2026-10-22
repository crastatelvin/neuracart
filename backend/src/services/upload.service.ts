import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

const UPLOAD_ROOT = path.resolve(__dirname, '../../', env.UPLOAD_DIR);
const PRODUCT_DIR = path.join(UPLOAD_ROOT, 'products');

export async function saveProductImage(
  file: Express.Multer.File,
): Promise<string> {
  try {
    const metadata = await sharp(file.buffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new AppError('Invalid image file', 422, 'INVALID_IMAGE');
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid image file', 422, 'INVALID_IMAGE');
  }

  await fs.mkdir(PRODUCT_DIR, { recursive: true });
  const filename = `${randomUUID()}.webp`;
  const filePath = path.join(PRODUCT_DIR, filename);

  try {
    await sharp(file.buffer)
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filePath);
  } catch {
    throw new AppError('Could not process image', 422, 'IMAGE_PROCESSING_FAILED');
  }

  return `/uploads/products/${filename}`;
}

export async function deleteProductImage(imageUrl?: string | null): Promise<void> {
  if (!imageUrl || !imageUrl.startsWith('/uploads/products/')) return;
  const filename = path.basename(imageUrl);
  const filePath = path.join(PRODUCT_DIR, filename);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      // Cleanup is best-effort; a missing old image must not fail a product write.
      console.warn('Could not delete product image', imageUrl);
    }
  }
}
