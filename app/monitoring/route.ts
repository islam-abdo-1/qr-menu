import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Sentry Tunnel — يمرر أحداث المتصفح إلى Sentry (يتجاوز مانع الإعلانات + CSP).
 * يُستخدم مع tunnelRoute: "/monitoring" في withSentryConfig.
 * تمرير شفاف: لا يقرأ المحتوى ولا يسجل شيئاً — مجرد إحالة.
 */
export async function POST(req: Request) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return new NextResponse(null, { status: 204 });
  }
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.split("/").pop();
    if (!projectId) return new NextResponse(null, { status: 400 });

    const body = await req.text();
    const authHeader = req.headers.get("x-sentry-auth") ?? "";

    const upstream = await fetch(
      `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-sentry-envelope",
          ...(authHeader ? { "X-Sentry-Auth": authHeader } : {}),
        },
        body,
        cache: "no-store",
      },
    );
    return new NextResponse(null, { status: upstream.status });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
