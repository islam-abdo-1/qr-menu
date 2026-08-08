import type { Metadata, Viewport } from "next";
import { Amiri, Cairo } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PwaInstallBanner } from "@/components/pwa/install-banner";
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
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://qr-menu-lyart-gamma.vercel.app",
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
      <body className="min-h-screen">
        {children}
        <Toaster position="top-center" richColors />
        <PwaInstallBanner />
      </body>
    </html>
  );
}