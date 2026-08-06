import type { Metadata } from "next";
import { getMenuData } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { MenuView } from "@/components/public/menu-view";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "قائمة الطعام — QR Menu",
  description: "قائمة طعام رقمية — امسح الرمز واطلب مباشرة",
};

export default async function PublicMenuPage() {
  const [data, dict] = await Promise.all([getMenuData(), Promise.resolve(getDictionary("ar"))]);
  return <MenuView dict={dict} data={data ?? { settings: null, categories: [] }} locale="ar" />;
}