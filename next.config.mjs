import withPWAInit from "@ducanh2912/next-pwa";

/**
 * PWA — استراتيجية كاش صارمة:
 *  - الاستاتيك والصور (Supabase Storage): Cache First → تقليل باندودث التخزين.
 *  - صفحة HTML والـ API: Network First — الأدمن يرى البيانات الحية دائمًا.
 *  - POST/PUT/DELETE: لا تدخل أي قاعدة (workbox يطابق GET فقط) → شبكة مباشرة.
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
      // الصفحات (HTML) — Network First: الجلسة والمحتوى دائمًا أحدث ما في الخادم
      {
        urlPattern: ({ request }) => request.mode === "navigate",
        handler: "NetworkFirst",
        options: {
          cacheName: "pages",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
        },
      },
      // الـ API (GET) — Network First بلا خلط (التخزين المؤقت احتياطي فقط)
      {
        urlPattern: /^\/api\/.*/,
        handler: "NetworkFirst",
        method: "GET",
        options: {
          cacheName: "api",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 },
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
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co https://checkout.paymob.com",
      "frame-src https://checkout.paymob.com",
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
  experimental: {
    // مكتبات Node لا تُدخلها webpack في الحزمة — تُحمَّل من node_modules
    serverComponentsExternalPackages: [
      "@prisma/client",
      "@prisma/adapter-pg",
      "pg",
    ],
  },
};

export default withPWA(nextConfig);