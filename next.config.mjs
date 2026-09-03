import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * PWA — استراتيجية كاش هجينة محسّنة للأداء:
 *  - صفحات المنيو العامة (/m/*): StaleWhileRevalidate → عرض فوري من الكاش + تحديث في الخلفية
 *  - لوحات محمية (/admin/*, /staff/*): NetworkOnly — بلا كاش، بيانات حية دائماً
 *  - API (GET): StaleWhileRevalidate مع timeout 3 ثوانٍ — سرعة + بيانات حديثة
 *  - الاستاتيك والصور: Cache First → تقليل باندودث
 *  - POST/PUT/DELETE: شبكة مباشرة (workbox يطابق GET فقط)
 */
const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  workbox: {
    cleanupOutdatedCaches: true,
    navigateFallback: null,
    runtimeCaching: [
      // لوحات محمية (أدمن/موظفون) — بلا كاش إطلاقًا
      {
        urlPattern: ({ url, request }) =>
          request.mode === "navigate" &&
          (url.pathname.startsWith("/admin") || url.pathname.startsWith("/staff")),
        handler: "NetworkOnly",
      },
      // صفحات المنيو العامة (/m/*) — StaleWhileRevalidate: فوري من الكاش + تحديث صامت
      {
        urlPattern: ({ url, request }) =>
          request.mode === "navigate" && url.pathname.startsWith("/m/"),
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "menu-pages",
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
        },
      },
      // باقي الصفحات العامة (الرئيسية، login، signup...) — NetworkFirst مع timeout مخفض
      {
        urlPattern: ({ request }) => request.mode === "navigate",
        handler: "NetworkFirst",
        options: {
          cacheName: "pages",
          networkTimeoutSeconds: 2,
          expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
        },
      },
      // الـ API (GET) — StaleWhileRevalidate مع timeout 3 ثوانٍ
      {
        urlPattern: /^\/api\/.*/,
        handler: "StaleWhileRevalidate",
        method: "GET",
        options: {
          cacheName: "api-get",
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
        },
      },
      // إحصائيات البناء (webpack) — Cache First مع مدة سنة
      {
        urlPattern: /\/_next\/static\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "static-assets",
          expiration: { maxEntries: 150, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
      // صور Supabase + أي صور عامة — Cache First يقلل باندودث التخزين
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "supabase-images",
          expiration: { maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /\.(png|jpg|jpeg|webp|svg|gif|ico|woff2?)$/,
        handler: "CacheFirst",
        options: {
          cacheName: "static-files",
          expiration: { maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
    ],
  },
});

/** ترويسات أمان موحّدة لكل المسارات */
const isDev = process.env.NODE_ENV === "development";
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://www.google-analytics.com https://www.googletagmanager.com",
      "connect-src 'self' https://*.supabase.co https://checkout.paymob.com https://challenges.cloudflare.com https://www.google-analytics.com https://region1.google-analytics.com",
      "frame-src https://checkout.paymob.com https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // صورة محسّنة عبر Vercel (sharp + CDN) — دون unoptimized
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // إخفاء ترويسة خادم Next (أمن + ريسة أسرع قليلًا)
  poweredByHeader: false,
  // ضغط gzip/brotli لبايتات الاستجابة (Vercel serverless يدعمه)
  compress: true,
  // استبعاد مجلد scripts من الـ build
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  experimental: {
    // مكتبات Node لا تُدخلها webpack في الحزمة — تُحمَّل من node_modules
    serverComponentsExternalPackages: [
      "@prisma/client",
      "@prisma/adapter-pg",
      "pg",
    ],
    staleTimes: {
      dynamic: 300,        // 5 دقائق للمحتوى الديناميكي
      static: 3600,        // ساعة للمحتوى الستاتيكي
    },
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /scripts\/.*\.ts$/,
      use: 'ignore-loader',
    });
    return config;
  },
};

export default withSentryConfig(withPWA(nextConfig), {
  org: "qr-menu-o1",
  project: "javascript-nextjs",
  silent: true,
  disableLogger: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});