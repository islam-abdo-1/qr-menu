import type { Metadata, Viewport } from "next";
import { Amiri, Cairo } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PwaInstallBanner } from "@/components/pwa/install-banner";
import { RegisterPWA } from "@/components/pwa/register-sw";
import Script from "next/script";
import "./globals.css";

export const revalidate = 300;

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  weight: ["400", "500", "600", "700", "900"],
  display: "swap",
});

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  variable: "--font-display",
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://site-menu.ddnsfree.com",
  ),
  title: "QR Menu — مطعمك هنا",
  description: "قائمة طعام رقمية بأكواد QR",
  verification: {
    google: [
      "ydyxDPhkOymznnW5gw1dx_-IzQ-UbTb2uwVkNqi-gW0",
      "Wwor-SRE4siebWFVSC6IxQBIm8TMkWmJpHLZhAfJWik",
    ],
  },
  openGraph: {
    title: "QR Menu — مطعمك هنا",
    description: "قائمة طعام رقمية بأكواد QR",
    siteName: "QR Menu",
    locale: "ar_EG",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#C84C21",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${amiri.variable}`}
    >
      <head>
        {/* Prefetch critical routes for faster navigation */}
        <link rel="prefetch" href="/login" as="document" />
        <link rel="prefetch" href="/signup" as="document" />
        <link rel="prefetch" href="/admin" as="document" />
        <link rel="prefetch" href="/staff" as="document" />
        
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-N9PRRDXKS4"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-N9PRRDXKS4');
            `,
          }}
        />
        <Script
          id="turnstile"
          strategy="afterInteractive"
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        />
      </head>
      <body className="min-h-screen">
        {children}
        <Toaster position="top-center" richColors />
        <PwaInstallBanner />
        <RegisterPWA />
      </body>
    </html>
  );
}