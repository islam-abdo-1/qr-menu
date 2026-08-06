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
  return (
    <div dir="ltr" lang="en">
      <MenuView dict={dict} data={data} locale="en" langHref={`/m/${slug}`} />
    </div>
  );
}
