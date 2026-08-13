"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  Copy,
  Download,
  Loader2,
  MonitorSmartphone,
  RefreshCcw,
  Smartphone,
} from "lucide-react";

type Props = {
  /** رابط لوحة الإدارة — يُنسخ ويُرمّز في QR */
  dashboardUrl: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const isIOS = () =>
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod/i.test(navigator.userAgent);

const isAndroid = () =>
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

/**
 * قسم التطبيق في إعدادات الأدمن: نسخ رابط اللوحة + رمز QR + زر تثبيت مباشر.
 * الزر بثلاث مراحل: نافذة تثبيت فورية ← انتظار ذكي (10 ثوانٍ) ← شرح فوري في نفس المكان.
 * يلتقط قبلinstallprompt بنفسه (مصدر مباشر مستقل عن شريط التثبيت السفلي).
 */
export function PwaSettingsShare({ dashboardUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [ios] = useState(isIOS);
  const [android] = useState(isAndroid);
  /** هل التثبيت الفوري متاح؟ (حدث beforeinstallprompt وصل فعلًا) */
  const [installReady, setInstallReady] = useState(false);
  /** هل تم التثبيت بالفعل؟ */
  const [installed, setInstalled] = useState(false);
  /** idle | waiting | guide */
  const [phase, setPhase] = useState<"idle" | "waiting" | "guide">("idle");
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** نسخة خاصة بنا من حدث التثبيت — لا نعتمد على شريط التثبيت السفلي */
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    QRCode.toDataURL(dashboardUrl, { width: 256, margin: 1, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [dashboardUrl]);

  // مصدر مستقل: نلتقط قبلinstallprompt بأنفسنا
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      // صفحة الإعدادات تتعامل بنفسها — الشريط السفلي لن يفتح نافذة ثانية
      (window as unknown as { __qrSelfHandled?: boolean }).__qrSelfHandled = true;
      (window as unknown as { __qrInstallReady?: boolean }).__qrInstallReady = true;
      setInstallReady(true);
      // أخبر العالم الخارجي (والشريط السفلي) بالجاهزية
      window.dispatchEvent(new CustomEvent("qr:install-ready"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ((window as unknown as { __qrInstallReady?: boolean }).__qrInstallReady) {
      setInstallReady(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const clearWait = useCallback(() => {
    if (waitTimer.current) {
      clearTimeout(waitTimer.current);
      waitTimer.current = null;
    }
  }, []);

  useEffect(() => clearWait, [clearWait]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(dashboardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // البيئات القديمة — بديل هامشي فقط
    }
  };

  /** فتح نافذة التثبيت — يعتمد على نسختنا الخاصة أولًا ثم شريط التثبيت السفلي */
  const triggerInstall = useCallback(async () => {
    const local = deferredRef.current;
    if (local) {
      try {
        await local.prompt();
        const choice = await local.userChoice.catch(() => ({ outcome: "dismissed" as const }));
        deferredRef.current = null;
        (window as unknown as { __qrSelfHandled?: boolean }).__qrSelfHandled = false;
        (window as unknown as { __qrInstallReady?: boolean }).__qrInstallReady = false;
        if (choice.outcome === "accepted") {
          setInstalled(true);
          window.dispatchEvent(new CustomEvent("qr:install-done"));
        } else {
          setInstallReady(false);
          setPhase("idle");
          window.dispatchEvent(new CustomEvent("qr:install-unavailable"));
        }
      } catch {
        setInstallReady(false);
        setPhase("idle");
      }
      return;
    }
    // لا نسخة خاصة — نمرر الأمر للشريط السفلي الذي ربما التقط الحدث
    window.dispatchEvent(new CustomEvent("qr:request-install"));
  }, []);

  /** زر التثبيت: فوري ← انتظار ذكي ← شرح في نفس المكان */
  const goInstall = () => {
    if (installReady || deferredRef.current) {
      void triggerInstall();
      return;
    }
    setPhase("waiting");
    waitTimer.current = setTimeout(() => {
      waitTimer.current = null;
      setPhase("guide");
    }, 10_000);
  };

  // استمع لحدث التثبيت — يفتح النافذة تلقائيًا أثناء مرحلة الانتظار
  useEffect(() => {
    const onReady = () => {
      setInstallReady(true);
      if (phase === "waiting") {
        clearWait();
        setPhase("idle");
        void triggerInstall();
      }
    };
    const onDone = () => {
      setInstalled(true);
      setPhase("idle");
      clearWait();
    };
    const onUnavailable = () => setInstallReady(false);
    window.addEventListener("qr:install-ready", onReady);
    window.addEventListener("qr:install-done", onDone);
    window.addEventListener("qr:install-unavailable", onUnavailable);
    return () => {
      window.removeEventListener("qr:install-ready", onReady);
      window.removeEventListener("qr:install-done", onDone);
      window.removeEventListener("qr:install-unavailable", onUnavailable);
    };
  }, [phase, clearWait, triggerInstall]);

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
              width={256}
              height={256}
              className="mx-auto h-28 w-28 rounded-xl border border-border bg-white p-1.5 sm:mx-0 sm:h-36 sm:w-36"
            />
          ) : (
            <div className="mx-auto h-28 w-28 animate-pulse rounded-xl border border-dashed border-border bg-muted/40 sm:mx-0 sm:h-36 sm:w-36" />
          )}
          <p className="mt-1 text-center text-[10px] text-muted-foreground">
            امسح الرمز لفتح اللوحة
          </p>
        </div>
      </div>

      {/* زر التثبيت المباشر */}
      <div className="mt-4 space-y-3">
        {installed ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-500">
              <Check className="h-5 w-5" />
            </span>
            <div className="text-sm">
              <p className="font-black text-cream">تم تثبيت التطبيق</p>
              <p className="text-xs text-muted-foreground">
                افتحه من الشاشة الرئيسية — يعمل دائم الدخول بدون متصفح.
              </p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={goInstall}
            disabled={phase === "waiting"}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-gold to-[#a87a2b] px-6 text-sm font-black text-background shadow-[0_12px_36px_-10px_rgba(212,168,83,0.55)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-80 sm:w-auto"
          >
            {phase === "waiting" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري تجهيز نافذة التثبيت...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                ثبّت التطبيق الآن
              </>
            )}
          </button>
        )}

        {/* شرح يدوي فقط عند الاستحالة — في نفس المكان */}
        {phase === "guide" ? (
          <div className="flex items-start gap-2 rounded-xl border border-gold/20 bg-gold/5 p-3.5 text-xs text-cream/80">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <div className="flex-1">
              {ios ? (
                <p>
                  هذا المتصفح لا يدعم التثبيت الفوري. افتح اللوحة في <span className="font-black text-gold">Safari</span> ثم اضغط زر المشاركة أسفل الشاشة واختر «إضافة إلى الشاشة الرئيسية».
                </p>
              ) : android ? (
                <p>
                  لم يصل حدث التثبيت من المتصفح (يحدث غالبًا في أول زيارة). أعد تحميل الصفحة ثم اضغط «ثبّت التطبيق الآن» مرة أخرى — أو افتح من قائمة <span className="font-black text-gold">⋯</span> في Chrome واختر «إضافة إلى الشاشة الرئيسية».
                </p>
              ) : (
                <p>
                  لم يصل حدث التثبيت من المتصفح. أعد تحميل الصفحة ثم اضغط «ثبّت التطبيق الآن» — أو من شريط العنوان اضغط أيقونة التثبيت واختر «تثبيت».
                </p>
              )}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-1.5 flex items-center gap-1 font-black text-gold underline decoration-gold/50 underline-offset-2 transition-colors hover:text-[#f2d589]"
              >
                <RefreshCcw className="h-3 w-3" />
                إعادة تحميل الصفحة الآن
              </button>
            </div>
          </div>
        ) : null}

        {/* إرشادات التثبيت */}
        <div className="flex items-start gap-2 rounded-xl border border-border bg-background/60 p-3.5 text-xs text-muted-foreground">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          {ios ? (
            <p>
              للتثبيت على iPhone: اضغط زر المشاركة أسفل Safari ثم اختر «إضافة إلى الشاشة الرئيسية».
            </p>
          ) : (
            <p>
              للتثبيت على Android: افتح اللوحة في المتصفح ثم اختر «إضافة إلى الشاشة الرئيسية» (أو استخدم زر التثبيت الذي يظهر أسفل الشاشة).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}