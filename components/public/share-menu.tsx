"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

type Props = {
  /** رابط المنيو المطلق (مع حفظ اللغة) — يُبنى في الصفحة المخدمية */
  menuUrl: string;
  /** نص المشاركة من القاموس حسب اللغة */
  shareText: string;
};

/**
 * زر مشاركة المنيو: واتساب / تيليجرام / نسخ الرابط.
 * على الجوال يدعم navigator.share الأصلي (أفضل تجربة).
 */
export function ShareMenu({ menuUrl, shareText }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = `${shareText}: ${menuUrl}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareText, text, url: menuUrl });
        return;
      } catch {
        // أُغلق المستخدم نافذة المشاركة — قائمة الخيارات تتولى الأمر
      }
    }
    setOpen((v) => !v);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // بيئات قديمة
    }
  };

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${shareText}: ${menuUrl}`)}`;
  const telegram = `https://t.me/share/url?url=${encodeURIComponent(menuUrl)}&text=${encodeURIComponent(shareText)}`;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={share}
        aria-label="مشاركة المنيو"
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5 text-xs font-black text-gold transition-colors hover:bg-gold/20"
      >
        <Share2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">مشاركة</span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="إغلاق"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute end-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-gold/20 bg-[#1d1712]/95 p-1.5 shadow-elevated backdrop-blur-xl">
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-cream transition-colors hover:bg-gold/10"
            >
              <span className="text-gold">واتساب</span>
            </a>
            <a
              href={telegram}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-cream transition-colors hover:bg-gold/10"
            >
              <span className="text-gold">تيليجرام</span>
            </a>
            <button
              type="button"
              onClick={() => {
                void copy();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-cream transition-colors hover:bg-gold/10"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gold" />}
              {copied ? "تم النسخ" : "نسخ الرابط"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}