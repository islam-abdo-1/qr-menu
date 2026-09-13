# ADR-003: Rate Limiting Strategy

## Status
Accepted

## Context
The platform needs to protect against:
- Abuse of public endpoints (menu pages, order creation)
- Brute force attacks on staff login
- API abuse from malicious actors
- Resource exhaustion on Free Tier (Vercel + Supabase)

Constraints:
- Free Tier: No Redis, no external services
- Edge runtime: No persistent storage
- Must work across multiple Vercel regions/instances

## Decision
**Two-layer rate limiting:**

### Layer 1: Edge Middleware (In-Memory)
- Runs in Next.js Middleware (Edge runtime)
- Per-instance in-memory Map with sliding window
- Applied to ALL requests via middleware
- Fast, zero external dependencies
- Trade-off: Not shared across instances

```typescript
// middleware.ts
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number) {
  // Fixed window with cleanup
}
```

### Layer 2: Distributed Rate Limiting (Cloudflare KV)
- Optional: Enabled via `CF_ACCOUNT_ID`, `CF_KV_NAMESPACE_ID`, `CF_API_TOKEN`
- Shared across all instances via Cloudflare KV REST API
- Falls back to in-memory if not configured
- Used for critical endpoints (auth, orders, staff login)

```typescript
// lib/distributed-rate-limit.ts
async function distributedRateLimit(keyPrefix, req, limit, windowMs) {
  if (isKvConfigured()) {
    // Use Cloudflare KV REST API
  }
  // Fallback to in-memory
  return memoryRateLimit(key, limit, windowMs);
}
```

## Rate Limit Config

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| Menu pages (`/m/*`) | 300 | 60s | `menu:{slug}:{ip}` |
| Order creation | 30 | 60s | `order:{ip}` |
| Staff login | 5 | 15min | `staff-login:{ip}` |
| Staff PIN | 5 | 15min | `staff-pin:{ip}` |
| General API | 100 | 60s | `api:{ip}` |
| Auth (signin/signup) | 10 | 15min | `auth-{type}:{ip}` |
| Customer auth | 10 | 15min | `customer-{type}:{ip}` |

## Circuit Breaker
- Opens after 5 consecutive failures
- 30s recovery timeout
- Half-open state allows 3 test requests
- Returns 503 with `Retry-After: 30`

## Consequences

### Positive
- Works on Free Tier (no Redis)
- Defense in depth: Edge + Distributed
- Graceful degradation (KV optional)
- Circuit breaker prevents cascade failures
- IP extraction supports Cloudflare headers

### Negative
- In-memory not shared across instances (acceptable for Free Tier)
- Cloudflare KV adds latency (~50ms)
- KV writes count toward Free Tier limits (1k/day)
- No distributed rate limiting without Cloudflare account

## Alternatives Considered
1. **Vercel Edge Config** - Limited to 8KB, not suitable for counters
2. **Upstash Redis** - Not on Free Tier
3. **Custom SQLite** - Not available in Edge runtime

## Related
- ADR-001: Multi-tenant Routing (menu rate limiting per slug)
- ADR-002: Staff Session (staff login rate limiting)