# Incident Response Runbook

## Quick Reference

| Severity | Response Time | Escalation |
|----------|---------------|------------|
| SEV-1 (Production down) | 15 min | Page on-call immediately |
| SEV-2 (Major degradation) | 30 min | Page on-call within 1 hour |
| SEV-3 (Minor issue) | 4 hours | Next business day |

## Common Incidents

### 1. Database Connection Failure
**Symptoms**: Health check returns `degraded`, API errors `P2010` / `P2010`

**Diagnosis**:
```bash
# Check health endpoint
curl https://site-menu.ddnsfree.com/api/health

# Check Vercel logs for P2010 errors
vercel logs --follow
```

**Resolution**:
1. Check Supabase Dashboard → Database → Connections
2. If connections > 80: Restart Vercel deployment (clears pool)
3. If Supabase down: Check status.supabase.com
4. Increase `PRISMA_POOL_SIZE` if sustained high load

### 2. Circuit Breaker Open (503 Errors)
**Symptoms**: `X-Circuit-Breaker: open` header, 503 responses

**Diagnosis**:
```bash
# Check circuit breaker header
curl -I https://site-menu.ddnsfree.com/api/health
```

**Resolution**:
1. Wait 30s for auto-recovery (half-open state)
2. Check Vercel logs for upstream errors
3. If persistent: Check upstream service health (Supabase, Cloudflare)

### 3. High Latency / Timeouts
**Symptoms**: p99 > 5s, Vercel function timeouts

**Diagnosis**:
```bash
# Check Vercel Analytics
vercel inspect <deployment-url>

# Check Supabase query performance
# Dashboard → Database → Query Performance
```

**Resolution**:
1. Check for missing indexes (run `rls-probe.cjs`)
2. Reduce `PRISMA_POOL_SIZE` if connection contention
3. Enable Image Proxy streaming if not enabled
4. Check for runaway queries in Vercel logs

### 4. Rate Limiting False Positives
**Symptoms**: Legitimate users getting 429 errors

**Diagnosis**:
```bash
# Check rate limit headers
curl -I https://site-menu.ddnsfree.com/m/kafy
# Look for: Retry-After, X-RateLimit-*
```

**Resolution**:
1. Check if Cloudflare KV configured (`isDistributedRateLimitActive()`)
2. Increase limits in `middleware.ts` or `lib/rate-limit.ts`
3. Check for shared IP (corporate proxy, VPN)

### 5. Image Proxy Failures
**Symptoms**: Broken images, 504 from `/api/image`

**Diagnosis**:
```bash
# Test image proxy directly
curl -I "https://site-menu.ddnsfree.com/api/image?url=<supabase-url>&w=400"
```

**Resolution**:
1. Check Supabase Storage accessibility
2. Verify `sharp` installed in Vercel build
3. Check 10s fetch timeout (large images)
4. Verify allowed hosts in `app/api/image/route.ts`

### 5. Staff Session Issues
**Symptoms**: Staff can't login, "session expired" errors

**Diagnosis**:
```bash
# Check STAFF_SESSION_SECRET set
vercel env ls | grep STAFF_SESSION_SECRET

# Check cookie in browser DevTools
# Application → Cookies → staff-auth
```

**Resolution**:
1. Verify `STAFF_SESSION_SECRET` in Vercel env (32+ chars)
2. Check cookie not blocked (HTTPS, SameSite=lax)
3. Clear browser cookies, re-login

### 6. Rate Limiting Not Working (Cloudflare KV)
**Symptoms**: `isDistributedRateLimitActive()` returns false

**Resolution**:
1. Verify Cloudflare credentials in Vercel:
   - `CF_ACCOUNT_ID`
   - `CF_KV_NAMESPACE_ID`
   - `CF_API_TOKEN` (with KV:Edit)
2. Check KV namespace exists in Cloudflare Dashboard
3. Verify API token has `KV:Edit` permissions

### 7. Supabase Auth Issues
**Symptoms**: Login/signup fails, "Invalid login credentials"

**Diagnosis**:
```bash
# Check Supabase Auth config
# Dashboard → Authentication → Providers → Email

# Check email confirm setting
# Dashboard → Authentication → Settings → Enable email confirmations
```

**Resolution**:
1. Verify `NEXT_PUBLIC_SUPABASE_URL` and `ANON_KEY`
2. Check email provider (SMTP) configured
3. For dev: Disable email confirm in Supabase Dashboard

## Monitoring Dashboards

| Dashboard | URL |
|-----------|-----|
| Vercel Analytics | https://vercel.com/dashboard/analytics |
| Vercel Logs | `vercel logs` or Dashboard → Logs |
| Supabase Dashboard | https://supabase.com/dashboard |
| Cloudflare Analytics | https://dash.cloudflare.com |

## Key Metrics to Watch

| Metric | Alert Threshold |
|--------|-----------------|
| Health check status | != healthy |
| p99 latency | > 3s |
| Error rate | > 1% |
| DB connections | > 80 |
| Circuit breaker | open |
| Error rate (5xx) | > 0.5% |

## Useful Commands

```bash
# Deploy to production
vercel --prod

# View production logs
vercel logs --follow

# Run health check
curl https://site-menu.ddnsfree.com/api/health

# Run RLS probe
node scripts/rls-probe.cjs

# Run load test
node scripts/load-test.mjs https://site-menu.ddnsfree.com

# Check environment variables
vercel env ls

# Rollback deployment
vercel rollback <deployment-url>

# Check circuit breaker status
curl -I https://site-menu.ddnsfree.com/api/health | grep X-Circuit-Breaker
```

## Contacts

| Service | Support |
|---------|---------|
| Vercel | https://vercel.com/support |
| Supabase | https://supabase.com/support |
| Cloudflare | https://support.cloudflare.com |