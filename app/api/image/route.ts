import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { Readable } from 'stream';

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
 * - On-the-fly optimization (resize, compress, format conversion) with STREAMING
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

function buildSharpPipeline(
  inputStream: ReadableStream<Uint8Array>,
  width: number,
  height: number,
  quality: number,
  format: 'webp' | 'jpeg' | 'png' | 'avif',
  fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
): ReadableStream<Uint8Array> {
  const sharpInstance = sharp();
  
  // Configure sharp pipeline
  if (width > 0 || height > 0) {
    sharpInstance.resize(width || null, height || null, { fit, withoutEnlargement: true });
  }
  
  switch (format) {
    case 'avif':
      sharpInstance.avif({ quality, effort: 4 });
      break;
    case 'webp':
      sharpInstance.webp({ quality, effort: 4 });
      break;
    case 'jpeg':
      sharpInstance.jpeg({ quality, mozjpeg: true });
      break;
    case 'png':
      sharpInstance.png({ quality, compressionLevel: 9 });
      break;
  }
  
  // Convert web stream to node stream for sharp
  const reader = inputStream.getReader();
  const nodeStream = new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
      } else {
        this.push(Buffer.from(value));
      }
    }
  });
  
  const sharpStream = sharpInstance;
  nodeStream.pipe(sharpStream);
  
  // Convert sharp output back to web stream
  const outputStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      sharpStream.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      
      sharpStream.on('end', () => {
        controller.close();
      });
      
      sharpStream.on('error', (err: Error) => {
        controller.error(err);
      });
    }
  });
  
  return outputStream;
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

    // Get content length for potential Content-Length header
    const contentLength = response.headers.get('content-length');
    
    // Build streaming pipeline
    const outputStream = buildSharpPipeline(response.body!, width, height, quality, format, fit);
    
    // Determine output content type
    const outputContentTypeMap: Record<string, string> = {
      avif: 'image/avif',
      webp: 'image/webp',
      jpeg: 'image/jpeg',
      png: 'image/png',
    };
    const outputContentType = outputContentTypeMap[format] || 'image/webp';
    
    // Generate a weak ETag based on URL and params (for conditional requests)
    const etagBase = `${url}:${width}:${height}:${quality}:${format}:${fit}`;
    const crypto = await import('crypto');
    const etag = crypto.createHash('sha256').update(etagBase).digest('hex').substring(0, 16);
    
    // Check If-None-Match for conditional requests
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    // Build response headers
    const headers = new Headers();
    headers.set('Content-Type', outputContentType);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    headers.set('ETag', etag);
    headers.set('Vary', 'Accept');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    // Return streaming response
    return new NextResponse(outputStream, {
      status: 200,
      headers,
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