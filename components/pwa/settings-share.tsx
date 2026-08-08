"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, MonitorSmartphone, Smartphone } from "lucide-react";

type Props = {
  /** رابط لوحة الإدارة — يُنسخ ويُرمّز في QR */
  dashboardUrl: string;
};

const isIOS = () =>
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * قسم التطبيق في إعدادات الأدمن: نسخ رابط اللوحة + رمز QR + إرشادات التثبيت.
 * يعمل فقط بعد الطلاء (useEffect) — لا يشير إلى window أثناء الرندر.
 */
export function PwaSettingsShare({ dashboardUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [ios] = useState(isIOS);

  useEffect(() => {
    QRCode.toDataURL(dashboardUrl, { width: 168, margin: 1, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [dashboardUrl]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(dashboardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // البيئات القديمة — بديل هامشي فقط
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex items-center gap-2">
        <MonitorSmartphone className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-base font-black">تطبيقك على الهاتف (PWA)</h3>
          <p className="text-xs text-muted-foreground">
            أضف اللوحة إلى الشاشة الرئيسية لفتحها كتطبيق سريع دائم الدخول
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {/* الرابط + نسخ */}
        <div className="flex w-full flex-col gap-2">
          <p className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs font-bold text-muted-foreground break-all" dir="ltr">
            {dashboardUrl}
          </p>
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 text-sm font-black text-gold transition-all hover:bg-gold/20 active:scale-[0.98]"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "تم النسخ" : "نسخ رابط اللوحة"}
          </button>
        </div>

        {/* رمز QR حقيقي */}
        <div className="w-full shrink-0 sm:w-auto">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="QR code — فتح لوحة الإدارة"
              width={168}
              height={168}
              className="rounded-xl border border-border bg-white p-2"
            />
          ) : (
            <div className="h-[168px] w-[168px] animate-pulse rounded-xl border border-dashed border-border bg-muted/40" />
          )}
          <p className="mt-1 text-center text-[10px] text-muted-foreground">
            امسح الرمز لفتح اللوحة
          </p>
        </div>
      </div>

      {/* إرشادات التثبيت */}
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-gold/20 bg-gold/5 p-3.5 text-xs text-cream/80">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <p>
          {ios
            ? "للتثبيت على iPhone: اضغط زر المشاركة أسفل Safari ثم اختر «إضافة إلى الشاشة الرئيسية»."
            : "للتثبيت على Android: افتح اللوحة في المتصفح ثم اختر «إضافة إلى الشاشة الرئيسية» (أو استخدم زر التثبيت الذي يظهر أسفل الشاشة)."}
        </p>
      </div>
    </div>
  );
}