import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createHash, timingSafeEqual } from "crypto";

/**
 * نقطة تطهير الكاش — تُستدعى من تطبيق لوحة المالك بعد حذف/تعديل مطعم
 * (تعديل فوري على المنيو العام بدل انتظار دورة الـ ISR).
 * محمية بسر مشترك (PURGE_SECRET) بين الموقعين — بلا سر ترفض.
 */
export async function POST(request: Request) {
  const secret = process.env.PURGE_SECRET;
  if (!secret) return NextResponse.json({ ok: false }, { status: 501 });

  const raw = await request.text();
  if (raw.length > 16 * 1024) return NextResponse.json({ ok: false }, { status: 413 });
  let body: { secret?: string; slug?: string } | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  // مقارنة ثابتة الزمن (مطابق-هضمي SHA-256 لتفادي عدم تطابق الطول)
  const a = createHash("sha256").update(body?.secret ?? "").digest();
  const b = createHash("sha256").update(secret).digest();
  if (!a.length || !b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (typeof body.slug === "string" && body.slug) {
    revalidatePath(`/m/${body.slug}`);
    revalidatePath(`/${body.slug}`);
  }
  revalidateTag("menu");
  return NextResponse.json({ ok: true });
}
