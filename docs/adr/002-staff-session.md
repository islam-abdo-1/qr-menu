# ADR-002: Staff Session Architecture

## Status
Accepted

## Context
Staff members need to access a real-time order dashboard (`/staff/[slug]`) using:
- Restaurant slug (from URL or auto-detected)
- Staff name
- Shared 4-digit PIN per restaurant

Requirements:
- No full authentication system (no email/password per staff)
- Sessions persist for 12h (or 30d with "Remember me")
- HMAC-signed cookies for tamper-proof sessions
- Separate secret from Supabase keys (credential isolation)
- Backward compatibility for existing cookies (30-day migration window)

## Decision
Use **HMAC-signed cookies** with dual-key verification:

```typescript
// lib/staff-session.ts
const COOKIE = "staff-auth";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

// Primary secret (required in production)
function primarySecret(): string {
  const s = process.env.STAFF_SESSION_SECRET;
  if (!s || /^(your-|dummy|staff-dev-secret)/i.test(s)) {
    throw new Error("STAFF_SESSION_SECRET not set — fail closed");
  }
  return s;
}

// Legacy secret for 30-day migration window
function legacySecret(): string | null {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s || /^(your-|dummy)/i.test(s)) return null;
  return s;
}

// Verify against both keys (legacy accepted during migration window)
function verify(token: string): boolean {
  return candidates.some(key => safeEqual(sign(payload, key), signature));
}
```

## Cookie Format
```
base64url({slug, name, expires}).HMAC_SHA256(secret)
```

## Consequences
### Positive
- Zero database queries for session validation (fast)
- Credential isolation: STAFF_SESSION_SECRET separate from Supabase keys
- Fail-closed: Missing/invalid secret = no sessions (secure)
- Graceful migration: 30-day window for existing cookies
- No JWT library needed (native crypto)

### Negative
- No server-side session revocation (short TTL mitigates)
- Clock skew sensitivity (use NTP on servers)
- Secret rotation requires coordinated deploy

## Alternatives Considered
1. **JWT tokens** - Larger cookies, requires JWT library
2. **Database sessions** - Adds latency, more infrastructure
3. **Supabase Auth per staff** - Overkill, requires email/password per staff

## Related
- ADR-001: Multi-tenant Routing
- ADR-003: Rate Limiting Strategy