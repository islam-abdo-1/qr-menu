import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/session";
import { getSessionCookieOptions } from "@/lib/session-cookies";

/**
 * Reserved system paths — always excluded from tenant rewrites.
 * (Admin, auth, Staff, /m pages, API routes, and public assets).
 */
const RESERVED = new Set([
  "admin",
  "login",
  "signup",
  "forgot-password",
  "update-password",
  "staff",
  "m",
  "api",
  "monitoring",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
  "googlecbbd9aafd505a6e3.html",
  ".well-known",
]);
const FILE_EXT = /\.(?:a?png|jpe?g|svg|webp|gif|ico|txt|xml|map|json|woff2?|wasm|css|js)$/i;

/**
 * Multi-tenant routing (rewrite, not redirect):
 *   domain.com/kafy  ->  /m/kafy (internal)
 * - REWRITE keeps browser URL clean (/kafy) for QR codes
 * - No DB lookup here (Edge runtime has no pg)
 * - Page /m/[slug] validates restaurant existence and returns 404 if missing
 * - Any non-reserved path segment treated as tenant — legacy /m/... QR links still work
 */
function tenantRewrite(pathname: string): string | null {
  if (pathname === "/") return null;
  const parts = pathname.split("/").filter(Boolean);
  const slug = parts[0];
  if (!slug || RESERVED.has(slug) || FILE_EXT.test(slug)) return null;
  if (parts.length === 1) return `/m/${slug}`;
  return null;
}

/**
 * ============================================================
 * EDGE RATE LIMITING + CIRCUIT BREAKER (In-Memory, Free Tier)
 * ============================================================
 */

// In-Memory Rate Limit Store (per Edge Runtime Instance)
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

// Circuit Breaker State
const circuitBreakerState = {
  isOpen: false,
  failureCount: 0,
  lastFailure: 0,
  nextAttempt: 0,
};

// Restaurant ID Cache (In-Memory LRU, 5 min TTL)
const restaurantIdCache = new Map<string, { id: string; expires: number }>();

// Circuit Breaker Config
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  recoveryTimeout: 30_000,
  halfOpenRequests: 3,
};

// Rate Limit Config
const RATE_LIMIT_CONFIG = {
  menu: { limit: 300, windowMs: 60_000 },
  order: { limit: 30, windowMs: 60_000 },
  staffLogin: { limit: 5, windowMs: 300_000 },
  staffPin: { limit: 5, windowMs: 900_000 },
  api: { limit: 100, windowMs: 60_000 },
};

// Cleanup Rate Limit Store (prevents Memory Leak)
function cleanupRateLimitStore() {
  const now = Date.now();
  if (rateLimitStore.size > 10000) {
    rateLimitStore.forEach((value, key) => {
      if (now - value.windowStart > 60_000) rateLimitStore.delete(key);
    });
  }
}

// Cleanup Restaurant ID Cache
function cleanupRestaurantCache() {
  const now = Date.now();
  restaurantIdCache.forEach((value, key) => {
    if (value.expires < now) restaurantIdCache.delete(key);
  });
}

// Generic Rate Limiter (In-Memory, Fixed Window)
function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = 60_000
): { ok: boolean; retryAfterSeconds: number; remaining: number } {
  cleanupRateLimitStore();
  
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  
  if (!entry || now - entry.windowStart >= windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { ok: true, retryAfterSeconds: 0, remaining: limit - 1 };
  }
  
  entry.count++;
  rateLimitStore.set(key, entry);
  
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.windowStart + windowMs - Date.now()) / 1000);
    return { ok: false, retryAfterSeconds: Math.max(1, retryAfter), remaining: 0 };
  }
  
  return { ok: true, retryAfterSeconds: 0, remaining: limit - entry.count };
}

// Circuit Breaker Logic
function checkCircuitBreaker(): { allow: boolean; reason?: string } {
  const now = Date.now();
  
  if (circuitBreakerState.isOpen) {
    if (now >= circuitBreakerState.nextAttempt) {
      circuitBreakerState.isOpen = false;
      circuitBreakerState.failureCount = 0;
      return { allow: true, reason: 'half-open' };
    }
    return { allow: false, reason: 'circuit_open' };
  }
  
  return { allow: true, reason: 'closed' };
}

function recordFailure() {
  circuitBreakerState.failureCount++;
  circuitBreakerState.lastFailure = Date.now();
  
  if (circuitBreakerState.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    circuitBreakerState.isOpen = true;
    circuitBreakerState.nextAttempt = Date.now() + CIRCUIT_BREAKER_CONFIG.recoveryTimeout;
  }
}

function recordSuccess() {
  if (!circuitBreakerState.isOpen) {
    circuitBreakerState.failureCount = 0;
  }
}

// Restaurant ID Cache (In-Memory LRU, 5 min TTL)
async function getRestaurantIdFromSlug(slug: string): Promise<string | null> {
  const cached = restaurantIdCache.get(slug);
  if (cached && cached.expires > Date.now()) return cached.id;
  return null;
}

// Security Headers
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://www.google-analytics.com https://www.googletagmanager.com",
    "connect-src 'self' https://*.supabase.co https://checkout.paymob.com https://challenges.cloudflare.com https://www.google-analytics.com https://region1.google-analytics.com",
    "frame-src https://checkout.paymob.com https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

/**
 * Middleware: Supabase SSR session + i18n + tenant routing + Rate Limiting + Circuit Breaker.
 */
export async function updateSession(request: NextRequest) {
  const createSupabaseResponse = () => NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
      cookieOptions: getSessionCookieOptions(60 * 60 * 24 * 30),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, cacheHeaders) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = createSupabaseResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(cacheHeaders).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  let supabaseResponse = createSupabaseResponse();

  const pathname = request.nextUrl.pathname;
  const isAdminPath = pathname.startsWith("/admin");
  const isLoginPath = pathname === "/login" || pathname.startsWith("/login");

  // ============================================================
  // RATE LIMITING + CIRCUIT BREAKER (Early Exit)
  // ============================================================
  
  // Get client IP (Cloudflare provides cf-connecting-ip)
  const ip = request.headers.get('cf-connecting-ip') || 
             request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             'unknown';
  
  // 1. Circuit Breaker Check (Early Exit)
  const circuitCheck = checkCircuitBreaker();
  if (!circuitCheck.allow) {
    const res = NextResponse.json(
      { error: 'Service temporarily unavailable', reason: circuitCheck.reason },
      { status: 503, headers: { 'Retry-After': '30' } }
    );
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => res.headers.set(key, value));
    return res;
  }

  // 2. Rate Limiting
  // Menu Pages Rate Limit: 300 req/min per IP per Restaurant
  if (pathname.startsWith('/m/')) {
    const slug = pathname.split('/')[2];
    const rl = checkRateLimit(`menu:${slug}:${ip}`, 300, 60_000);
    if (!rl.ok) {
      const res = new NextResponse('Rate Limited', { 
        status: 429, 
        headers: { 'Retry-After': String(rl.retryAfterSeconds) }
      });
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => res.headers.set(key, value));
      return res;
    }
  }

  // Order Creation Rate Limit: 30 req/min per IP
  if (pathname === '/api/orders' && request.method === 'POST') {
    const rl = checkRateLimit(`order:${ip}`, 30, 60_000);
    if (!rl.ok) {
      const res = NextResponse.json({ error: 'Rate Limited' }, { 
        status: 429, 
        headers: { 'Retry-After': String(rl.retryAfterSeconds) }
      });
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => res.headers.set(key, value));
      return res;
    }
  }

  // Staff Login Rate Limit: 5 attempts per 5 min
  if (pathname === '/api/staff/login') {
    const rl = checkRateLimit(`staff-login:${ip}`, 5, 300_000);
    if (!rl.ok) {
      const res = NextResponse.json({ error: 'Too many attempts' }, { 
        status: 429, 
        headers: { 'Retry-After': String(rl.retryAfterSeconds) }
      });
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => res.headers.set(key, value));
      return res;
    }
  }

  // Staff Pin Rate Limit: 5 attempts per 15 min
  if (pathname === '/api/staff/pin') {
    const rl = checkRateLimit(`staff-pin:${ip}`, 5, 900_000);
    if (!rl.ok) {
      const res = NextResponse.json({ error: 'Too many attempts' }, { 
        status: 429, 
        headers: { 'Retry-After': String(rl.retryAfterSeconds) }
      });
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => res.headers.set(key, value));
      return res;
    }
  }

  // General API Rate Limit: 100 req/min per IP
  if (pathname.startsWith('/api/')) {
    const rl = checkRateLimit(`api:${ip}`, 100, 60_000);
    if (!rl.ok) {
      const res = NextResponse.json({ error: 'Rate Limited' }, { 
        status: 429, 
        headers: { 'Retry-After': String(rl.retryAfterSeconds) }
      });
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => res.headers.set(key, value));
      return res;
    }
  }

  // Session check only for protected routes (performance + ISR stability)
  let hasSession = false;
  if (isAdminPath || isLoginPath) {
    hasSession = hasValidSession(request.cookies.getAll());
    if (!hasSession) {
      const { data } = await supabase.auth.getUser();
      hasSession = !!data.user;
    }
  }

  /**
   * Redirect or rewrite while preserving session cookies:
   */
  const inheritCookies = (res: NextResponse) => {
    supabaseResponse.cookies
      .getAll()
      .forEach((c) => res.cookies.set(c.name, c.value, c));
    return res;
  };

  // 1) Tenant rewrite: rewrite to internal menu page
  const rewrite = tenantRewrite(pathname);
  if (rewrite) {
    const url = request.nextUrl.clone();
    url.pathname = rewrite;
    const res = inheritCookies(NextResponse.rewrite(url));
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => res.headers.set(key, value));
    return res;
  }

  // 2) Admin protection — redirect to login if no session
  if (isAdminPath && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return inheritCookies(NextResponse.redirect(url));
  }

  // 3) Logged-in user opening /login -> redirect to admin
  if (isLoginPath && hasSession) {
    return inheritCookies(NextResponse.redirect(new URL("/admin", request.url)));
  }

  // Apply Security Headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => supabaseResponse.headers.set(key, value));

  // Add Circuit Breaker header for monitoring
  supabaseResponse.headers.set('X-Circuit-Breaker', circuitBreakerState.isOpen ? 'open' : 'closed');

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};

export default updateSession;