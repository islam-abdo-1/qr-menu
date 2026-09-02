import "server-only";

/**
 * Distributed Rate Limiter using Cloudflare KV (REST API).
 * Free tier: 100k reads/day, 1k writes/day, 1GB storage.
 * Falls back to in-memory if not configured.
 * 
 * Setup:
 * 1. Create KV namespace in Cloudflare Dashboard
 * 2. Get Account ID, Namespace ID, API Token (with KV:Edit permissions)
 * 3. Set env vars: CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_API_TOKEN
 */

type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

interface KvEntry {
  count: number;
  windowStart: number;
}

const MEMORY_BUCKETS = new Map<string, KvEntry>();

/**
 * Get client IP from request headers
 */
function getClientIp(req: Request): string {
  const raw =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for") ??
    "";
  return raw.split(",")[0].trim() || "unknown";
}

/**
 * Check if Cloudflare KV is configured
 */
function isKvConfigured(): boolean {
  return !!(
    process.env.CF_ACCOUNT_ID &&
    process.env.CF_KV_NAMESPACE_ID &&
    process.env.CF_API_TOKEN
  );
}

/**
 * Build KV REST API URL
 */
function getKvUrl(key: string): string {
  const accountId = process.env.CF_ACCOUNT_ID!;
  const namespaceId = process.env.CF_KV_NAMESPACE_ID!;
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
}

/**
 * Get headers for KV API requests
 */
function getKvHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

/**
 * Read rate limit entry from KV
 */
async function readFromKv(key: string): Promise<KvEntry | null> {
  if (!isKvConfigured()) return null;
  
  try {
    const response = await fetch(getKvUrl(key), {
      method: "GET",
      headers: getKvHeaders(),
    });
    
    if (response.status === 404) return null;
    if (!response.ok) {
      console.warn("[rate-limit] KV read failed:", response.status);
      return null;
    }
    
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch (e) {
    console.warn("[rate-limit] KV read error:", e);
    return null;
  }
}

/**
 * Write rate limit entry to KV
 */
async function writeToKv(key: string, entry: KvEntry, windowMs: number): Promise<boolean> {
  if (!isKvConfigured()) return false;
  
  try {
    const expirationTtl = Math.ceil(windowMs / 1000) + 60; // TTL slightly longer than window
    
    const response = await fetch(getKvUrl(key), {
      method: "PUT",
      headers: {
        ...getKvHeaders(),
        "Expiration-Ttl": String(expirationTtl),
      },
      body: JSON.stringify(entry),
    });
    
    return response.ok;
  } catch (e) {
    console.warn("[rate-limit] KV write error:", e);
    return false;
  }
}

/**
 * Memory fallback rate limiter
 */
function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Cleanup old entries periodically
  if (MEMORY_BUCKETS.size > 2000) {
    const keysToDelete: string[] = [];
    MEMORY_BUCKETS.forEach((v, k) => {
      if (now - v.windowStart >= windowMs) keysToDelete.push(k);
    });
    keysToDelete.forEach(k => MEMORY_BUCKETS.delete(k));
  }

  const entry = MEMORY_BUCKETS.get(key);
  
  if (!entry || now - entry.windowStart >= windowMs) {
    MEMORY_BUCKETS.set(key, { count: 1, windowStart: now });
    return { ok: true, retryAfterSeconds: 0 };
  }
  
  entry.count++;
  if (entry.count > limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((entry.windowStart + windowMs - now) / 1000),
    };
  }
  
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Distributed rate limiter with Cloudflare KV + memory fallback
 * 
 * @param keyPrefix - Unique prefix for this rate limit (e.g., "order-burst", "login")
 * @param req - Request object (for IP extraction)
 * @param limit - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 * @returns { ok: boolean, retryAfterSeconds: number }
 */
export async function distributedRateLimit(
  keyPrefix: string,
  req: Request,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const ip = getClientIp(req);
  const key = `ratelimit:${keyPrefix}:${ip}`;
  
  // Try distributed KV first
  if (isKvConfigured()) {
    const existing = await readFromKv(key);
    const now = Date.now();
    
    if (!existing || now - existing.windowStart >= windowMs) {
      const entry: KvEntry = { count: 1, windowStart: now };
      await writeToKv(key, entry, windowMs);
      return { ok: true, retryAfterSeconds: 0 };
    }
    
    existing.count++;
    if (existing.count > limit) {
      return {
        ok: false,
        retryAfterSeconds: Math.ceil((existing.windowStart + windowMs - now) / 1000),
      };
    }
    
    await writeToKv(key, existing, windowMs);
    return { ok: true, retryAfterSeconds: 0 };
  }
  
  // Fallback to memory
  return memoryRateLimit(key, limit, windowMs);
}

/**
 * IP-only version for use in Server Actions (no Request object)
 */
export async function distributedRateLimitIp(
  keyPrefix: string,
  ip: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const key = `ratelimit:${keyPrefix}:${ip}`;
  
  if (isKvConfigured()) {
    const existing = await readFromKv(key);
    const now = Date.now();
    
    if (!existing || now - existing.windowStart >= windowMs) {
      const entry: KvEntry = { count: 1, windowStart: now };
      await writeToKv(key, entry, windowMs);
      return { ok: true, retryAfterSeconds: 0 };
    }
    
    existing.count++;
    if (existing.count > limit) {
      return {
        ok: false,
        retryAfterSeconds: Math.ceil((existing.windowStart + windowMs - now) / 1000),
      };
    }
    
    await writeToKv(key, existing, windowMs);
    return { ok: true, retryAfterSeconds: 0 };
  }
  
  // Memory fallback
  return memoryRateLimit(key, limit, windowMs);
}

/**
 * Check if distributed rate limiting is active (KV configured)
 */
export function isDistributedRateLimitActive(): boolean {
  return isKvConfigured();
}