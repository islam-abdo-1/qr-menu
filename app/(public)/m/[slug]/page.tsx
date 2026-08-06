import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMenuData } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { MenuView } from "@/components/public/menu-view";

export const revalidate = 300;

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
    Promise.resolve(getDictionary("ar")),
  ]);
  if (!data) notFound();
  return <MenuView dict={dict} data={data} locale="ar" slug={slug} langHref={`/m/${slug}/en`} />;
}
