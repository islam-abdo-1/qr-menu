/**
 * دوال مساعدة لـ Cloudinary
 */

/**
 * استخراج publicId من رابط Cloudinary
 * يدعم تنسيقات متعددة:
 * - https://res.cloudinary.com/cloud/image/upload/v1234567890/folder/public_id.jpg
 * - https://res.cloudinary.com/cloud/image/upload/folder/public_id.jpg
 * - https://res.cloudinary.com/cloud/image/upload/v1234567890/folder/public_id
 */
export function extractPublicIdFromUrl(url: string): string | null {
  if (!url || !url.includes('res.cloudinary.com')) return null;

  try {
    // نمط 1: مع رقم الإصدار
    const withVersion = url.match(/\/upload\/v\d+\/(.+?)(?:\.\w+)?$/);
    if (withVersion?.[1]) return withVersion[1];

    // نمط 2: بدون رقم إصدار
    const withoutVersion = url.match(/\/upload\/(.+?)(?:\.\w+)?$/);
    if (withoutVersion?.[1]) return withoutVersion[1];

    return null;
  } catch {
    return null;
  }
}

/**
 * بناء رابط Cloudinary مع تحويلات مخصصة
 */
export function buildCloudinaryUrl(
  publicId: string,
  options?: {
    width?: number;
    height?: number;
    quality?: number | 'auto';
    format?: 'auto' | 'webp' | 'jpeg' | 'png' | 'avif';
    crop?: 'limit' | 'fill' | 'scale' | 'fit';
    gravity?: string;
  }
): string {
  const base = `https://res.cloudinary.com/h78euh5v/image/upload/`;

  const transformations: string[] = [];

  if (options?.width) transformations.push(`w_${options.width}`);
  if (options?.height) transformations.push(`h_${options.height}`);
  
  const quality = options?.quality ?? 'auto';
  transformations.push(`q_${quality}`);
  
  transformations.push('f_auto');

  if (options?.crop) transformations.push(`c_${options.crop}`);
  if (options?.gravity) transformations.push(`g_${options.gravity}`);

  const transformStr = transformations.join(',');
  return `${base}${transformStr}/${publicId}`;
}

/**
 * بناء رابط البروكسي القديم (للصور القديمة من Supabase)
 */
export function buildProxyUrl(
  originalUrl: string,
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png' | 'avif';
  }
): string {
  const params = new URLSearchParams();
  params.set('url', originalUrl);
  if (options?.width) params.set('w', String(options.width));
  if (options?.height) params.set('h', String(options.height));
  if (options?.quality) params.set('q', String(options.quality));
  if (options?.format) params.set('f', options.format);
  return `/api/image?${params.toString()}`;
}

/**
 * دالة موحدة لتحويل أي رابط إلى الرابط المحسن المناسب
 * - روابط Cloudinary: تحويل مباشر مع التحويلات
 * - روابط Supabase: تمر عبر البروكسي للتوافق العكسي
 * - روابط أخرى: تُعاد كما هي
 */
export function toOptimizedImageUrl(
  url: string | null | undefined,
  options?: {
    width?: number;
    height?: number;
    quality?: number | 'auto';
    format?: 'auto' | 'webp' | 'jpeg' | 'png' | 'avif';
    crop?: 'limit' | 'fill' | 'scale' | 'fit';
    gravity?: string;
  }
): string | undefined {
  if (!url) return undefined;

  // روابط Cloudinary - بناء مباشر مع التحويلات
  if (url.includes('res.cloudinary.com')) {
    const publicId = extractPublicIdFromUrl(url);
    if (publicId) {
      return buildCloudinaryUrl(publicId, {
        width: options?.width,
        height: options?.height,
        quality: options?.quality,
        format: options?.format,
        crop: options?.crop,
        gravity: options?.gravity,
      });
    }
    return url;
  }

  // روابط Supabase القديمة - تمر بالبروكسي للتوافق العكسي
  if (url.includes('supabase.co') || url.includes('supabase.in') || url.includes('supabase.net')) {
    const params = new URLSearchParams();
    params.set('url', url);
    if (options?.width) params.set('w', String(options.width));
    if (options?.height) params.set('h', String(options.height));
    if (options?.quality) params.set('q', String(options.quality));
    if (options?.format) params.set('f', options.format);
    return `/api/image?${params.toString()}`;
  }

  return url;
}