import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Health check endpoint for monitoring and load balancer probes.
 * Checks: Database connectivity, Supabase Auth, Storage.
 * Critical checks (database, supabaseAuth) must pass for healthy.
 * Storage is non-critical (warning only) — does not affect HTTP status.
 */
export async function GET() {
  const checks = {
    database: false,
    supabaseAuth: false,
    storage: false,
  };
  const warnings: string[] = [];

  // Check database connectivity (CRITICAL)
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (e) {
    console.error("[health] Database check failed:", e);
  }

  // Check Supabase Auth (basic connectivity) (CRITICAL)
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await supabase.auth.getSession();
    checks.supabaseAuth = !error;
  } catch (e) {
    console.error("[health] Supabase Auth check failed:", e);
  }

  // Check Storage (basic connectivity) — NON-CRITICAL (warning only)
  // Use REST API directly to avoid "Invalid Compact JWS" with sb_secret_* keys
  const storagePromise = (async () => {
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "")}/storage/v1/bucket`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
        signal: AbortSignal.timeout(3000),
      });
      return { ok: res.ok, error: res.ok ? null : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, error: e };
    }
  })();

  const storageResult = await Promise.race([
    storagePromise,
    new Promise<{ ok: false; error: string }>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
  ]).catch(() => ({ ok: false as const, error: "timeout" as const }));
  
  checks.storage = storageResult.ok;
  if (!storageResult.ok) {
    warnings.push("storage");
    console.warn("[health] Storage check failed:", storageResult.error);
  }

  // Healthy only if CRITICAL checks pass (database + supabaseAuth)
  const criticalHealthy = checks.database && checks.supabaseAuth;
  const status = criticalHealthy ? 200 : 503;
  const statusText = criticalHealthy ? "healthy" : "degraded";

  return NextResponse.json(
    {
      status: statusText,
      timestamp: new Date().toISOString(),
      checks,
      warnings,
      version: process.env.npm_package_version || "unknown",
    },
    { status }
  );
}