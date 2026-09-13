# ADR-001: Multi-tenant Routing Strategy

## Status
Accepted

## Context
The QR Menu SaaS platform needs to serve multiple restaurants from a single codebase. Each restaurant needs:
- A unique public URL for their menu (e.g., `site-menu.ddnsfree.com/m/kafy`)
- Clean URLs for QR codes (e.g., `site-menu.ddnsfree.com/kafy`)
- Isolated data per restaurant

## Decision
Use **Next.js Middleware rewrite** for multi-tenant routing:

1. **External URLs**: `/kafy` → **Internal rewrite**: `/m/kafy`
2. **Reserved paths** (`admin`, `staff`, `api`, `login`, `signup`, etc.) are excluded from tenant rewrites
3. **No database lookup** in middleware (Edge runtime has no PostgreSQL)
4. **Validation** happens in `/m/[slug]` page component

## Implementation
```typescript
// middleware.ts
function tenantRewrite(pathname: string): string | null {
  if (pathname === "/") return null;
  const parts = pathname.split("/").filter(Boolean);
  const slug = parts[0];
  if (!slug || RESERVED.has(slug) || FILE_EXT.test(slug)) return null;
  if (parts.length === 1) return `/m/${slug}`;
  return null;
}
```

## Consequences
### Positive
- Clean URLs for QR codes (no `/m/` prefix visible)
- Zero database queries in middleware (fast, scalable)
- Legacy `/m/...` links still work
- Easy to add new reserved paths

### Negative
- Requires careful RESERVED list maintenance
- 404 handling delegated to page component
- No early tenant validation at Edge

## Alternatives Considered
1. **Subdomain routing** (`kafy.site-menu.ddnsfree.com`) - Requires wildcard DNS, SSL complexity
2. **Path-based with DB lookup** - Too slow for Edge middleware
3. **Separate deployments per restaurant** - Not cost-effective for Free Tier

## Related
- ADR-003: Rate Limiting Strategy
- ADR-002: Staff Session Architecture