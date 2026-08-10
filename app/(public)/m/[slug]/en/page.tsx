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
      ? `${data.settings.restaurantName} — Menu`
      : "Menu — QR Menu",
    description: "Digital restaurant menu — scan the code and order",
  };
}

export default async function RestaurantMenuEnPage({
  params: { slug },
}: {
  params: { slug: string };
}) {
  const [data, dict] = await Promise.all([
    getMenuData(slug),
    Promise.resolve(getDictionary("en")),
  ]);
  if (!data) notFound();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  return (
    <div dir="ltr" lang="en">
      <MenuView
        dict={dict}
        data={data}
        locale="en"
        slug={slug}
        langHref={`/m/${slug}`}
        menuUrl={`${siteUrl}/m/${slug}/en`}
      />
    </div>
  );
}
