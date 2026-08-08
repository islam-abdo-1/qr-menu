"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * شريط تثبيت التطبيق (PWA):
 * - يخزن حدث beforeinstallprompt لعرض زر التثبيت عند الطلب.
 * - يختفي تلقائيًا في وضع standalone (التطبيق مثبَّت أصلًا) أو عند تأسيسه.
 * - استعلامان في useEffect مع تنظيف كامل — لا تسريبات ولا hydration mismatch.
 */
export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // وضع التثبيت (standalone): لا نعرض الشريط إطلاقًا
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }, [deferred]);

  if (installed || !deferred) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-[#191310]/95 px-4 py-3 shadow-elevated backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-[#a87a2b] text-background">
            <Download className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-cream">ثبّت تطبيق QR Menu</p>
            <p className="truncate text-xs text-cream/60">افتح موقعك من الشاشة الرئيسية كتطبيق</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={install}
            className="flex h-9 items-center rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] px-4 text-xs font-black text-background transition-all hover:brightness-110 active:scale-95"
          >
            تثبيت
          </button>
          <button
            type="button"
            onClick={() => setDeferred(null)}
            aria-label="إغلاق"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-cream/50 transition-colors hover:bg-gold/10 hover:text-gold"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}