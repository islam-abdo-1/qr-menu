import type { MetadataRoute } from "next";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://site-menu.ddnsfree.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/staff", "/login"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
