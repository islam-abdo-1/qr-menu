# Image Proxy API

## Overview
The Image Proxy API optimizes and serves images from Supabase Storage via Vercel Edge Network with on-the-fly transformation.

## Endpoint
```
GET /api/image
```

## Parameters

| Parameter | Required | Type | Default | Description |
|-----------|----------|------|---------|-------------|
| `url` | Yes | string | - | Supabase Storage public URL |
| `w` | No | integer | 400 | Output width (max 1920) |
| `h` | No | integer | - | Output height (max 1920) |
| `q` | No | integer | 80 | Quality 10-100 |
| `f` | No | string | webp | Output format: `webp`, `avif`, `jpeg`, `png` |
| `fit` | No | string | cover | Resize mode: `cover`, `contain`, `fill`, `inside`, `outside` |

## Examples

### Basic usage
```
/api/image?url=https://project.supabase.co/storage/v1/object/public/menu/item.jpg
```

### Resized WebP (recommended)
```
/api/image?url=https://project.supabase.co/storage/v1/object/public/menu/item.jpg&w=400&q=75&f=webp
```

### Square thumbnail
```
/api/image?url=https://project.supabase.co/storage/v1/object/public/menu/item.jpg&w=200&h=200&fit=cover
```

### AVIF for modern browsers
```
/api/image?url=https://project.supabase.co/storage/v1/object/public/menu/item.jpg&w=800&f=avif
```

## Allowed Hosts
Only Supabase Storage URLs are allowed:
- `*.supabase.co`
- `*.supabase.in`
- `*.supabase.net`

## Response Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `image/webp`, `image/avif`, `image/jpeg`, `image/png` |
| `Cache-Control` | `public, max-age=31536000, immutable` |
| `ETag` | SHA256 hash (16 chars) |
| `Vary` | `Accept` |
| `X-Original-Size` | Original file size in bytes |
| `X-Optimized-Size` | Optimized file size in bytes |
| `X-Savings` | Compression percentage |

## Conditional Requests
Supports `If-None-Match` for 304 responses:
```
If-None-Match: "abc123def456"
```

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid or disallowed image URL | Missing/invalid URL or host not allowed |
| 400 | URL does not point to an image | Content-Type not `image/*` |
| 504 | Image fetch timeout | Supabase fetch exceeded 10s |
| 500 | Internal server error | Processing failed |

## Rate Limiting
- 100 requests/minute per IP
- Applied via Edge middleware

## Client Usage

### React/Next.js Component
```tsx
import { toImageProxyUrl } from '@/lib/utils';

<Image
  src={toImageProxyUrl(item.imageUrl, { width: 400, quality: 75 })}
  alt={item.name}
  placeholder="blur"
  blurDataURL={item.imageBlurDataURL}
/>
```

### Utility Function
```typescript
import { toImageProxyUrl } from '@/lib/utils';

const proxyUrl = toImageProxyUrl(imageUrl, {
  width: 400,
  height: 300,
  quality: 75,
  format: 'webp',
});
// Returns: /api/image?url=...&w=400&h=300&q=75&f=webp
```

## Performance
- **First request**: ~200-500ms (fetch + process)
- **Cached requests**: <50ms (Vercel Edge cache)
- **Bandwidth savings**: 60-80% vs original
- **Memory**: Constant (streaming, no full buffer)

## Limits
- **Max dimensions**: 1920x1920
- **Quality range**: 10-100
- **Fetch timeout**: 10 seconds
- **Max duration**: 15 seconds
- **Allowed formats**: webp, avif, jpeg, png
- **Allowed hosts**: `*.supabase.co`, `*.supabase.in`, `*.supabase.net`