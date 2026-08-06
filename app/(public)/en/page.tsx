import type { Metadata } from "next";
import { getMenuData } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { MenuView } from "@/components/public/menu-view";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Menu — QR Menu",
  description: "Digital restaurant menu — scan the code and order",
};

export default async function PublicMenuEnPage() {
  const [data, dict] = await Promise.all([getMenuData(), Promise.resolve(getDictionary("en"))]);
  return (
    <div dir="ltr" lang="en">
      <MenuView dict={dict} data={data} locale="en" />
    </div>
  );
}