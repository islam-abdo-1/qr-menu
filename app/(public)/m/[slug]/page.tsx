import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMenuData } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { MenuView } from "@/components/public/menu-view";

export const revalidate = 300;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const restaurants = await prisma.restaurant.findMany({
      select: { slug: true },
    });
    return restaurants.map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params: { slug },
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await getMenuData(slug);
  return {
    title: data?.settings?.restaurantName
      ? `${data.settings.restaurantName} — قائمة الطعام`
      : "قائمة الطعام — QR Menu",
    description: "قائمة طعام رقمية — امسح الرمز واطلب مباشرة",
  };
}

export default async function RestaurantMenuPage({
  params: { slug },
}: {
  params: { slug: string };
}) {
  const [data, dict] = await Promise.all([
    getMenuData(slug),
    Promise.resolve(getDictionary()),
  ]);
  if (!data) notFound();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  return (
    <MenuView
      dict={dict}
      data={data}
      locale="ar"
      slug={slug}
      menuUrl={`${siteUrl}/m/${slug}`}
    />
  );
}
