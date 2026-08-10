import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** تاريخ اليوم بتوقيت القاهرة — نفس أسلوب عدّاد الطلبات (يوم عمل المطعم) */
function cairoDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * عدّاد فتحات المنيو (QR visits):
 * يُستدعى مرة واحدة من كل زيارة صفحة منيو — يزيد DayStat.scans لليوم الحالي.
 * يعمل خارج كاش ISR تمامًا (لا يؤثر على الصفحة المعروضة).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { slug?: string } | null;
    const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
    if (!slug || slug.length > 100) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!restaurant) return NextResponse.json({ ok: false }, { status: 404 });

    await prisma.$executeRaw`
      INSERT INTO "DayStat" ("id", "restaurantId", "date", "scans")
      VALUES (${crypto.randomUUID()}, ${restaurant.id}, ${cairoDate(new Date())}::date, 1)
      ON CONFLICT ("restaurantId", "date") DO UPDATE SET
        "scans" = "DayStat"."scans" + EXCLUDED."scans"
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[visits] failed:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}