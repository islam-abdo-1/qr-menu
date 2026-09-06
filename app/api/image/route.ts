import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

/**
 * Image Proxy API
 * 
 * Fetches images from Supabase Storage, optimizes them with sharp,
 * and serves them with proper caching headers.
 * 
 * Usage: /api/image?url=<supabase-storage-url>&w=400&q=75&f=webp
 * 
 * Benefits:
 * - Images served via Vercel Edge Network (CDN)
 * - On-the-fly optimization (resize, compress, format conversion)
 * - Proper cache headers (immutable for 1 year)
 * - Reduces origin bandwidth and latency
 */

const ALLOWED_HOSTS = [
  'supabase.co',
  'supabase.in',
  'supabase.net',
];

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const DEFAULT_QUALITY = 80;
const DEFAULT_FORMAT = 'webp';

function isAllowedHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_HOSTS.some(host => hostname.endsWith(host));
  } catch {
    return false;
  }
}

function parseParams(searchParams: URLSearchParams) {
  const url = searchParams.get('url');
  const width = Math.min(parseInt(searchParams.get('w') || '0', 10) || 0, MAX_WIDTH);
  const height = Math.min(parseInt(searchParams.get('h') || '0', 10) || 0, MAX_HEIGHT);
  const quality = Math.min(Math.max(parseInt(searchParams.get('q') || String(DEFAULT_QUALITY), 10), 10), 100);
  const rawFormat = (searchParams.get('f') || DEFAULT_FORMAT).toLowerCase();
  const format = (rawFormat === 'jpg' ? 'jpeg' : rawFormat) as 'webp' | 'jpeg' | 'png' | 'avif';
  const fit = (searchParams.get('fit') || 'cover') as 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  
  return { url, width, height, quality, format, fit };
}

export async function GET(request: NextRequest) {
  const { url, width, height, quality, format, fit } = parseParams(request.nextUrl.searchParams);
  
  if (!url || !isAllowedHost(url)) {
    return NextResponse.json({ error: 'Invalid or disallowed image URL' }, { status: 400 });
  }

  try {
    // Fetch image from Supabase Storage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'QR-Menu-Image-Proxy/1.0',
      },
      // 10 second timeout for fetching
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      return NextResponse.json({ error: 'URL does not point to an image' }, { status: 400 });
    }

const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    
    // Optimize with sharp
    let sharpInstance = sharp(inputBuffer);
    
    // Get original dimensions
    await sharpInstance.metadata();
    
    // Resize if dimensions specified
    if (width > 0 || height > 0) {
      sharpInstance = sharpInstance.resize(width || null, height || null, {
        fit,
        withoutEnlargement: true,
      });
    }

    // Convert format and compress
    let outputBuffer: Uint8Array;
    let outputContentType: string;

    switch (format) {
      case 'avif':
        outputBuffer = await sharpInstance.avif({ quality, effort: 4 }).toBuffer();
        outputContentType = 'image/avif';
        break;
      case 'webp':
        outputBuffer = await sharpInstance.webp({ quality, effort: 4 }).toBuffer();
        outputContentType = 'image/webp';
        break;
      case 'jpeg':
        outputBuffer = await sharpInstance.jpeg({ quality, mozjpeg: true }).toBuffer();
        outputContentType = 'image/jpeg';
        break;
      case 'png':
        outputBuffer = await sharpInstance.png({ quality, compressionLevel: 9 }).toBuffer();
        outputContentType = 'image/png';
        break;
      default:
        outputBuffer = await sharpInstance.webp({ quality, effort: 4 }).toBuffer();
        outputContentType = 'image/webp';
    }

    // Generate ETag from buffer hash
    const crypto = await import('crypto');
    const etag = crypto.createHash('sha256').update(outputBuffer).digest('hex').substring(0, 16);
    
    // Check If-None-Match for conditional requests
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    // Return optimized image with cache headers
    return new NextResponse(outputBuffer as unknown as Uint8Array<ArrayBuffer>, {
      status: 200,
      headers: {
        'Content-Type': outputContentType,
        'Content-Length': String(outputBuffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable', // 1 year
        'ETag': etag,
        'X-Original-Size': String(inputBuffer.length),
        'X-Optimized-Size': String(outputBuffer.length),
        'X-Savings': `${Math.round((1 - outputBuffer.length / inputBuffer.length) * 100)}%`,
        'Vary': 'Accept',
      },
    });

  } catch (error) {
    console.error('[Image Proxy] Error:', error);
    
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Image fetch timeout' }, { status: 504 });
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Disable body parsing for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 15;