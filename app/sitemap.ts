import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://qr-menu-lyart-gamma.vercel.app";

/** خريطة الموقع — تُبنى تلقائيًا من المطاعم المسجلة (تُحدَّث عند كل بناء) */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const restaurants = await prisma.restaurant.findMany({
    select: { slug: true, createdAt: true },
  });

  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...restaurants.map((r) => ({
      url: `${BASE}/m/${r.slug}`,
      lastModified: r.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
