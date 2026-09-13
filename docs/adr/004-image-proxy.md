# ADR-004: Image Proxy Architecture

## Status
Accepted

## Context
Restaurants upload images to Supabase Storage. Direct serving from Supabase has issues:
- No automatic optimization (WebP/AVIF conversion, resizing)
- No CDN caching (Vercel Edge Network not utilized)
- Large original images waste bandwidth
- No blur placeholders for LQIP
- Images served with short cache headers

## Decision
**Image Proxy API** (`/api/image`) with streaming Sharp optimization:

```
Client → /api/image?url=<supabase-url>&w=400&q=75&f=webp
         ↓
   Fetch from Supabase Storage
         ↓
   Sharp streaming pipeline (resize → convert → compress)
         ↓
   Stream to client + 1-year immutable cache + ETag
```

### Implementation
```typescript
// app/api/image/route.ts
export async function GET(request: NextRequest) {
  const { url, width, height, quality, format, fit } = parseParams(request.nextUrl.searchParams);
  
  // Stream from Supabase
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  
  // Build Sharp pipeline with streaming
  const outputStream = buildSharpPipeline(response.body!, width, height, quality, format, fit);
  
  // Return streaming response
  return new NextResponse(outputStream, { headers: { ... } });
}
```

### Features
- **Streaming**: No full image buffer in memory
- **Formats**: WebP, AVIF, JPEG, PNG
- **Resize**: cover/contain/fill/inside/outside
- **Quality**: 10-100 (default 80)
- **Cache**: 1-year immutable + ETag for 304 responses
- **Security**: Allowed hosts list (supabase.co only), 10s timeout

### Client Usage
```tsx
// Components use toImageProxyUrl()
<Image
  src={toImageProxyUrl(item.imageUrl, { width: 400, quality: 75 })}
  alt={item.name}
  placeholder="blur"
  blurDataURL={item.imageBlurDataURL}
/>
```

## Consequences

### Positive
- **Bandwidth savings**: ~60-80% reduction vs original
- **CDN caching**: Served via Vercel Edge Network
- **LQIP**: Blur placeholders from `imageBlurDataURL`
- **Format negotiation**: Auto WebP/AVIF based on Accept header
- **Zero buffer**: Streaming = constant memory regardless of image size

### Negative
- Added latency for first request (fetch + process)
- Sharp processing uses CPU (Vercel Free Tier limits)
- 10s timeout may fail for huge images
- Requires `sharp` native dependency (build time)

## Alternatives Considered
1. **Next.js Image Optimization** - Requires `next/image` with remote patterns, less control
2. **Supabase Transform** - Limited to basic resize, no AVIF, no CDN
3. **Cloudflare Images** - Paid, vendor lock-in
3. **Direct Supabase URLs** - No optimization, no CDN

## Security
- **Allowed hosts**: `supabase.co`, `supabase.in`, `supabase.net`
- **Timeout**: 10s fetch + 15s max duration
- **Content-Type validation**: Must be `image/*`
- **Max dimensions**: 1920x1920

## Related
- ADR-001: Multi-tenant Routing (images served per restaurant)
- ADR-003: Rate Limiting (image proxy has its own limits)