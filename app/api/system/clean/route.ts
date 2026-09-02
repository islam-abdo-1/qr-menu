import { NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { runMaintenance } from "@/lib/maintenance";
import { rateLimit } from "@/lib/rate-limit";
import logger from '@/lib/logger';

/**
 * SEC-015 — مهمة الصيانة المجدولة (Vercel Cron يوميًا عبر vercel.json):
 * الاحتفاظ لكل جدول بسياسة زمنية، دفعات محدودة، معالجة أخطاء معزولة،
 * نتيجة كاملة قابلة للملاحظة — كلها خارج مسار إنشاء طلبات العملاء.
 *
 * الحماية: Vercel Cron يرسل `Authorization: Bearer <CRON_SECRET>` تلقائيًا.
 * بلا متغير CRON_SECRET → النقطة معطّلة (404) — رفض صامت بدل هجوم يومي.
 */
const AUTH_OK = 1;
const AUTH_404 = 2;
const AUTH_BAD = 3;

function authorize(request: Request): number {
  const secret = process.env.CRON_SECRET;
  if (!secret) return AUTH_404; // غير مكوّن → النقطة غير موجودة إطلاقًا
  const a = createHash("sha256").update(request.headers.get("authorization") ?? "").digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return a.length && b.length && timingSafeEqual(a, b) ? AUTH_OK : AUTH_BAD;
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const limited = await rateLimit("system-clean", request, 10, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "طلبات كثيرة — انتظر ثم أعد المحاولة" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  const auth = authorize(request);
  if (auth === AUTH_404) return NextResponse.json({ ok: false, error: "غير موجود" }, { status: 404 });
  if (auth !== AUTH_OK) return NextResponse.json({ ok: false, error: "رفض" }, { status: 401 });

  try {
    const result = await runMaintenance(prisma, new Date());
    logger.info({ result }, "[system-clean] result");
    return NextResponse.json({ ok: result.ok, total: result.total, tables: result.tables, errors: result.errors });
  } catch (e) {
    logger.error({ err: e }, "[system-clean] failed");
    return NextResponse.json({ ok: false, error: "فشلت الصيانة — راجع سجل الخادم" }, { status: 500 });
  }
}