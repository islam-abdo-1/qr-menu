import { cloudinary } from '@/lib/cloudinary';
import { Readable } from 'stream';

export interface UploadResult {
  url: string;
  width: number;
  height: number;
  sizeKB: number;
  publicId: string;
}

export interface UploadOptions {
  folder: string;
  publicId?: string;
  transformation?: ReadonlyArray<Record<string, unknown>>;
  buffer: Buffer;
}

export interface DeleteResult {
  ok: boolean;
  error?: string;
}

/**
 * رفع صورة إلى Cloudinary باستخدام streaming
 */
export async function uploadToCloudinary(options: UploadOptions): Promise<{ ok: boolean; data?: UploadResult; error?: string }> {
  const { folder, transformation, buffer } = options;

  try {
    const generatedPublicId = options.publicId || `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = await new Promise<{ secure_url: string; width: number; height: number; bytes: number; public_id: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: generatedPublicId,
          resource_type: 'image',
          transformation: transformation || [
            { quality: 'auto', fetch_format: 'auto' },
            { width: 1200, crop: 'limit' }
          ],
          overwrite: true,
          invalidate: true,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result as { secure_url: string; width: number; height: number; bytes: number; public_id: string });
        }
      );

      const bufferStream = new Readable();
      bufferStream.push(buffer);
      bufferStream.push(null);
      bufferStream.pipe(uploadStream);
    });

    return {
      ok: true,
      data: {
        url: result.secure_url,
        width: result.width,
        height: result.height,
        sizeKB: Math.round(result.bytes / 1024),
        publicId: result.public_id,
      },
    };
  } catch (error) {
    console.error('[Cloudinary Upload]', error);
    return { ok: false, error: 'فشل رفع الصورة إلى Cloudinary' };
  }
}

/**
 * حذف صورة من Cloudinary
 */
export async function deleteFromCloudinary(publicId: string): Promise<DeleteResult> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { invalidate: true });
    if (result.result === 'ok' || result.result === 'not found') {
      return { ok: true };
    }
    return { ok: false, error: `فشل الحذف: ${result.result}` };
  } catch (error) {
    console.error('[Cloudinary Delete]', error);
    return { ok: false, error: 'فشل حذف الصورة من Cloudinary' };
  }
}