# ADR-005: Billing Core - Single Source of Truth

## Status
Accepted

## Context
Billing logic is used across multiple apps:
- `qr-menu` (customer-facing + admin)
- `owner-app` (platform admin)

Both apps must make **identical billing decisions** for:
- Restaurant status: `active` | `trial` | `expired` | `exempt`
- Trial period: 7 days free
- Subscription renewal: starts from `paidUntil` if active, else from `now`
- Price: 250 EGP/month, 2300 EGP/year

## Decision
**Single shared library** (`lib/billing-core.ts`) imported by both apps:

```typescript
// lib/billing-core.ts
export type BillingStatus = "exempt" | "active" | "trial" | "expired";

export function billingStatusOf(
  restaurant: BillingFields,
  billingEnabled: boolean
): BillingStatus {
  if (restaurant.billingExempt) return "exempt";
  if (!billingEnabled) return "active"; // Billing disabled = no restrictions
  
  const now = Date.now();
  const paidUntil = toDate(restaurant.paidUntil)?.getTime() ?? 0;
  const trialEndsAt = toDate(restaurant.trialEndsAt)?.getTime() ?? 0;
  
  if (paidUntil > now) return "active";
  if (trialEndsAt > now) return "trial";
  return "expired";
}

// Renewal logic: extend from paidUntil if active, else from now
export function subscriptionEndAfter(
  currentEnd: Date | null,
  from: Date,
  planDays: number
): Date {
  const base = currentEnd && currentEnd > from ? currentEnd : from;
  return new Date(base.getTime() + planDays * 24 * 60 * 60 * 1000);
}
```

### Source of Truth
- **Single file**: `lib/billing-core.ts` in `qr-menu`
- **Copied via build**: `owner-app` imports via relative path
- **Test**: Unit test verifies both files identical (`billing-core.test.ts`)

```typescript
// tests/billing-core.test.ts
it("both apps share identical billing-core", () => {
  const a = readFileSync("../lib/billing-core.ts", "utf8");
  const b = readFileSync("../../owner-app/lib/billing-core.ts", "utf8");
  expect(a).toBe(b);
});
```

## Billing Rules

| Scenario | Status |
|----------|--------|
| `billingExempt = true` | `exempt` (always) |
| `billingEnabled = false` | `active` (no restrictions) |
| `paidUntil > now` | `active` |
| `trialEndsAt > now` | `trial` |
| `paidUntil <= now` AND `trialEndsAt <= now` | `expired` |

### Renewal Logic
```typescript
// Renew BEFORE expiry: extend from current paidUntil
subscriptionEndAfter(FUTURE, NOW, 30) === FUTURE + 30 days

// Renew AFTER expiry: start from NOW
subscriptionEndAfter(PAST, NOW, 30) === NOW + 30 days

// No previous period: start from NOW
subscriptionEndAfter(null, NOW, 7) === NOW + 7 days
```

## Consequences

### Positive
- **Zero drift**: Impossible for apps to diverge
- **Testable**: Pure functions, 100% unit test coverage
- **Single fix**: Bug fix in one place propagates everywhere
- **Type-safe**: TypeScript types shared via import

### Negative
- **Coupling**: Both apps depend on same file
- **Deploy coordination**: Change requires both apps deploy
- **Path coupling**: `owner-app` uses relative import

## Alternatives Considered
1. **NPM package** - Overhead for 2 apps, version management
2. **Supabase RPC** - Network latency, not available in Edge
3. **Database view** - Logic in SQL, harder to test

## Testing Strategy
- **Unit tests**: 100% coverage of `billingStatusOf`, `subscriptionEndAfter`, `trialDaysLeft`
- **Edge cases**: Millisecond boundaries, timezone neutrality, string dates
- **Cross-app sync test**: File content equality check in CI

## Related
- ADR-002: Staff Session (billing affects staff access)
- ADR-003: Rate Limiting (billing status affects API access)