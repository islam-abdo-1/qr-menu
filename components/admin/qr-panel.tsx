"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Check, Copy, Download, QrCode as QrIcon, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const QR_DARK = "#1F1A17";
const QR_LIGHT = "#FFFFFF";

export function QrPanel({
  restaurantName = "QR Menu",
  menuUrl,
}: {
  restaurantName?: string;
  menuUrl?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
    setUrl(menuUrl || base || window.location.origin);
  }, [menuUrl]);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    QRCode.toCanvas(
      canvasRef.current,
      url,
      { width: 540, margin: 3, color: { dark: QR_DARK, light: QR_LIGHT } },
      (err) => {
        if (err) console.error("[qr]", err);
      },
    );
  }, [url]);

  const downloadPng = useCallback(async () => {
    if (!url.trim()) {
      toast.error("أدخل رابط المنيو أولًا");
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(url.trim(), {
        width: 1024,
        margin: 3,
        color: { dark: QR_DARK, light: QR_LIGHT },
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `qr-${restaurantName.replace(/\s+/g, "-") || "menu"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("تم تجهيز PNG للطباعة");
    } catch {
      toast.error("تعذّر توليد الرمز");
    }
  }, [url, restaurantName]);

  const copyUrl = useCallback(async () => {
    if (!url.trim()) return;
    try {
      await navigator.clipboard.writeText(url.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("تعذّر النسخ");
    }
  }, [url]);

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <div className="flex flex-col gap-3 border-b border-gold/15 bg-gradient-to-l from-gold/10 via-transparent to-gold/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-cream">
            <QrIcon className="h-5 w-5 text-gold" />
            رمز QR للمنيو
          </h2>
          <p className="mt-0.5 text-sm text-cream/75">
            اطبع هذا الرمز وضعه على كل طاولة ليفتح العملاء المنيو مباشرة
          </p>
        </div>
        <span className="flex w-fit items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-bold text-gold">
          <Ruler className="h-3.5 w-3.5" />
          جاهز للطباعة 1024px
        </span>
      </div>

      <div className="flex flex-col items-center gap-7 p-6 sm:p-8">
        <div className="rounded-2xl p-3 shadow-elevated">
          <div className="rounded-xl border-8 border-white bg-white">
            <canvas ref={canvasRef} aria-label="QR code" className="h-60 w-60 sm:h-80 sm:w-80" />
          </div>
          <p className="mt-3 text-center font-display text-sm font-bold text-cream/80">{restaurantName}</p>
        </div>

        <div className="w-full max-w-md space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qr-url">رابط المنيو العام</Label>
            <div className="flex gap-2">
              <Input
                id="qr-url"
                dir="ltr"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-restaurant.vercel.app"
                className="text-end"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyUrl}
                className="shrink-0 rounded-xl"
                aria-label="نسخ الرابط"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Button onClick={downloadPng} className="w-full rounded-xl py-6" size="lg">
            <Download className="h-4 w-4" />
            تحميل PNG للطباعة (1024px)
          </Button>
        </div>
      </div>
    </div>
  );
}