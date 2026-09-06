"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { uploadMenuItemImageAction } from "@/lib/actions/menu";
import { uploadLogoImageAction } from "@/lib/actions/settings";
import { compressToWebp, formatBytes } from "@/lib/client/image";
import { cn } from "@/lib/utils";

/** بيانات تعريف الصورة المضغوطة — محسوبة على الخادم وتُحفظ في القاعدة مع الـ URL */
export type UploadedImageMeta = { width: number; height: number; sizeKB: number };

type Props = {
  value: string | null;
  onChange: (url: string | null, meta?: UploadedImageMeta | null) => void;
  /** حدد `logo` لرفع شعار المطعم بدل صورة عنصر */
  kind?: "item" | "logo";
};

const MAX_BYTES = 12 * 1024 * 1024;

/** صيغ مقبولة للقراءة (يُحوِّل الكل إلى WebP تلقائيًا) */
const ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
  "image/heic",
  "image/heif",
];

export function ImageUploader({ value, onChange, kind = "item" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "compress" | "upload">(null);
  const [error, setError] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);

  const isLogo = kind === "logo";
  const uploadAction = isLogo ? uploadLogoImageAction : uploadMenuItemImageAction;
  const noun = isLogo ? "الشعار" : "الصورة";

  function reset(inputEl: HTMLInputElement | null) {
    if (inputEl) inputEl.value = "";
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResultSize(null);

    if (!file.type.startsWith("image/")) {
      setError("اختر ملف صورة (JPG / PNG / WebP / GIF / AVIF ...)");
      toast.error("هذا الملف ليس صورة");
      return;
    }

    if (file.type === "image/heic" || file.type === "image/heif") {
      setError("صور الآيفون HEIC غير مدعومة مباشرة — حوّلها إلى JPG أو PNG");
      toast.error("الصيغة HEIC غير مدعومة في المتصفح");
      return;
    }

    if (file.size > MAX_BYTES) {
      setError(`${noun} أكبر من ${formatBytes(MAX_BYTES)}`);
      toast.error(`${noun} كبيرة جدًا`);
      return;
    }

    try {
      setBusy("compress");
      const { blob, width, height } = await compressToWebp(file);
      setBusy("upload");

      const sizeKB = Math.max(1, Math.round(blob.size / 1024));

      const fd = new FormData();
      fd.append("file", blob, blob.type === "image/webp" ? "menu.webp" : "menu.jpg");
      fd.append("width", String(width));
      fd.append("height", String(height));
      fd.append("sizeKB", String(sizeKB));

      const res = await uploadAction(fd);
      setBusy(null);
      if (res.ok) {
        setResultSize(res.data.sizeKB * 1024);
        onChange(res.data.url, {
          width: res.data.width,
          height: res.data.height,
          sizeKB: res.data.sizeKB,
        });
        toast.success(`تم رفع ${noun} وضغطه تلقائيًا (${formatBytes(res.data.sizeKB * 1024)})`);
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    } catch (err) {
      setBusy(null);
      const msg = err instanceof Error ? err.message : `تعذّر معالجة ${noun}`;
      setError(msg);
      toast.error(msg);
    } finally {
      reset(inputRef.current);
    }
  }

  const baseInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED.join(",")}
      className="hidden"
      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
    />
  );

  return (
    <div className="space-y-2">
      {baseInput}

      {value ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-2.5",
            isLogo && "flex-col sm:flex-row",
          )}
        >
          <div
            className={cn(
              "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl",
              isLogo && "rounded-full ring-2 ring-gold/60 ring-offset-2 ring-offset-card",
            )}
          >
            <Image
              src={value}
              alt={noun}
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="truncate text-xs font-semibold text-foreground">
              {isLogo ? "شعار المطعم محفوظ ✓" : "الصورة محفوظة على التخزين ✓"}
            </p>
            <p className="text-xs text-muted-foreground">
              {resultSize
                ? `مضغوطة WebP (${formatBytes(resultSize)}) — سريعة التحميل`
                : isLogo
                  ? "يظهر في الهيرو والفوتر بإطار ذهبي"
                  : "تعرض فورًا في المنيو"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:border-gold/60 hover:bg-gold/10"
              >
                تغيير {noun}
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(null, null);
                  setResultSize(null);
                }}
                className="flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" />
                حذف
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0]);
          }}
          disabled={busy !== null}
          className={cn(
            "group flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-gold/60 hover:bg-gold/5",
            busy && "pointer-events-none opacity-60",
          )}
        >
          {busy === null && (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold transition-transform group-hover:scale-110">
                <UploadCloud className="h-5 w-5" />
              </span>
              <span className="font-semibold">
                {isLogo ? "اضغط أو اسحب شعار المطعم هنا" : "اضغط أو اسحب صورة هنا"}
              </span>
              <span className="text-xs text-muted-foreground/80">
                JPG · PNG · WebP · GIF · AVIF — تضغط وتتحول تلقائيًا لسرعة التحميل
              </span>
            </>
          )}
          {busy === "compress" && (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
              <span>جارٍ ضغط {noun} وتحسينه...</span>
            </>
          )}
          {busy === "upload" && (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
              <span>جارٍ الحفظ الآمن على التخزين...</span>
            </>
          )}
        </button>
      )}

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          <ImageIcon className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}