import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getMenuData } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { MenuHero } from "@/components/public/menu-hero";
import { MenuSections } from "@/components/public/menu-sections";
import type { MenuData } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n/dictionaries";

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

function MenuHeroWrapper({ dict, data, locale, slug, menuUrl }: {
  dict: Dictionary;
  data: MenuData;
  locale: "ar" | "en";
  slug: string;
  menuUrl: string;
}) {
  return <MenuHero dict={dict} data={data} locale={locale} _slug={slug} _menuUrl={menuUrl} />;
}

function MenuSectionsWrapper({ dict, data, locale, slug, menuUrl }: {
  dict: Dictionary;
  data: MenuData;
  locale: "ar" | "en";
  slug?: string;
  menuUrl: string;
}) {
  return <MenuSections dict={dict} data={data} locale={locale} slug={slug} menuUrl={menuUrl} />;
}

function HeroSkeleton() {
  return (
    <header className="texture-dots relative overflow-hidden text-cream min-h-[78vh] flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-b from-[#14100D] to-[#1B1510]" aria-hidden />
      <div className="container relative flex min-h-[78vh] flex-col items-center justify-center gap-6 py-20 text-center">
        <div className="animate-pulse flex h-6 w-48 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold" />
        <div className="animate-pulse h-28 w-28 rounded-full border-4 border-gold/80 bg-[#14100D]" />
        <div className="animate-pulse h-12 w-3/4 bg-gradient-to-r from-gray-700 to-gray-800 mx-auto rounded" />
        <div className="animate-pulse h-4 w-1/2 bg-gray-700 mx-auto rounded mt-4" />
        <div className="animate-pulse flex items-center gap-2 justify-center">
          <div className="h-12 w-32 rounded-full bg-gradient-to-l from-gold to-[#a87a2b]" />
        </div>
      </div>
    </header>
  );
}

function SectionsSkeleton() {
  return (
    <div className="container mt-14 max-w-5xl space-y-16 pb-4">
      {[1, 2, 3].map((i) => (
        <section key={i} className="animate-pulse">
          <div className="mb-8 text-center">
            <div className="h-10 w-48 bg-gradient-to-r from-gray-700 to-gray-800 mx-auto rounded" />
            <div className="mt-4 h-px w-32 bg-gradient-to-r from-transparent via-gold to-transparent mx-auto" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
                <div className="aspect-[4/3] w-full bg-gradient-to-r from-gray-700 to-gray-800" />
                <div className="flex flex-1 flex-col p-3 sm:p-4">
                  <div className="h-6 w-3/4 bg-gray-700 rounded mb-2" />
                  <div className="h-4 w-1/2 bg-gray-700 rounded" />
                  <div className="mt-2 h-6 w-20 bg-gradient-to-r from-gold to-[#a87a2b] rounded mx-auto" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
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
    <>
      <Suspense fallback={<HeroSkeleton />}>
        <MenuHeroWrapper dict={dict} data={data} locale="ar" slug={slug} menuUrl={`${siteUrl}/m/${slug}`} />
      </Suspense>
      <Suspense fallback={<SectionsSkeleton />}>
        <MenuSectionsWrapper dict={dict} data={data} locale="ar" slug={slug} menuUrl={`${siteUrl}/m/${slug}`} />
      </Suspense>
    </>
  );
}
