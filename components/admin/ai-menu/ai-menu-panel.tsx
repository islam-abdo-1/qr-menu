"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Sparkles, UploadCloud, Loader2, Check, X, AlertTriangle,
  ImageIcon, PartyPopper,
  Tags as TagsIcon, UtensilsCrossed as UtensilsIcon,
  Pencil, CheckCircle2, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/* ═══════════════ الأنواع ═══════════════ */

type AiItem = {
  id: string;
  categoryName: string;
  categoryType: string | null;
  categoryOrder: number;
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  variants: { name: string; price: number }[] | null;
  needsReview: boolean;
  reviewReasons: string[] | null;
  priceConfidence: number | null;
  imageDetected: boolean;
  imageSource: string;
  imageConfidence: number | null;
  finalImageUrl: string | null;
  finalImageMeta: { width: number; height: number; sizeKB: number } | null;
  generationStatus: string | null;
  generationError: string | null;
  imageModeOverride: string | null;
  regenerateImage?: boolean;
};

type AiStyle = {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  description: string | null;
  categoryType: string;
  colors: string[];
};

type JobData = {
  id: string;
  status: string;
  imageMode: string;
  detectedCategoryCount: number;
  detectedItemCount: number;
  extractedImageCount: number;
  generatedImageCount: number;
  failedImageCount: number;
  errorMessage: string | null;
};

type Props = {
  restaurantId: string;
  currency: string;
  onChanged: () => void;
};

type Step = "upload" | "analyzing" | "review" | "publish" | "done";

const REASON_LABELS: Record<string, string> = {
  price_unclear: "السعر غير واضح",
  low_confidence: "قراءة غير مؤكدة",
  category_uncertain: "القسم غير مؤكد",
  image_low_confidence: "الصورة غير مؤكدة",
};

function formatPrice(p: number | null, currency: string): string {
  if (p === null) return "—";
  return `${p} ${currency === "EGP" ? "ج.م" : currency}`;
}

/* ═══════════════ المكوّن الرئيسي ═══════════════ */

export function AiMenuPanel({ currency, onChanged }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [job, setJob] = useState<JobData | null>(null);
  const [items, setItems] = useState<AiItem[]>([]);
  const [styles, setStyles] = useState<AiStyle[]>([]);
  const [imageMode, setImageMode] = useState<"SMART" | "MENU_ONLY" | "AI_ONLY">("SMART");
  const [categoryStyles, setCategoryStyles] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [importResult, setImportResult] = useState<{
    categories: number; items: number; images: number; warnings: string[];
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  /* ───── 1. الرفع ───── */
  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setBusy(true);
      try {
        const fd = new FormData();
        Array.from(files).forEach((f) => fd.append("files", f));
        const res = await fetch("/api/ai-menu/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!json.ok) {
          toast.error(json.error);
          return;
        }
        setJob({
          id: json.jobId, status: "UPLOADED", imageMode: "SMART",
          detectedCategoryCount: 0, detectedItemCount: 0,
          extractedImageCount: 0, generatedImageCount: 0,
          failedImageCount: 0, errorMessage: null,
        });
        toast.success("تم رفع الملفات — جارٍ التحليل بالذكاء الاصطناعي...");
        setStep("analyzing");
        void runAnalyze(json.jobId);
      } catch {
        toast.error("فشل الرفع — تحقق من الاتصال");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  /* ───── 2. التحليل ───── */
  const runAnalyze = useCallback(async (jobId: string) => {
    try {
      const res = await fetch("/api/ai-menu/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error);
        setStep("upload");
        return;
      }
      toast.success(
        `اكتمل التحليل: ${json.categoryCount} أقسام · ${json.itemCount} صنف`,
      );
      await loadJob(jobId);
      setStep("review");
    } catch {
      toast.error("فشل التحليل — حاول مجدداً");
      setStep("upload");
    }
  }, []);

  const loadJob = useCallback(async (jobId: string) => {
    const res = await fetch(`/api/ai-menu/jobs/${jobId}`);
    const json = await res.json();
    if (json.ok) {
      setJob(json.job);
      setItems(json.items);
      setStyles(json.styles);
      setImageMode(json.job.imageMode);
      // توزيع الأنماط تلقائياً حسب نوع القسم
      const auto: Record<string, string> = {};
      const catTypes: string[] = [];
      for (const it of json.items as AiItem[]) {
        const ct = it.categoryType ?? "other";
        if (!catTypes.includes(ct)) catTypes.push(ct);
      }
      for (const ct of catTypes) {
        const match = json.styles.find((s: AiStyle) => s.categoryType === ct);
        if (match) auto[ct] = match.id;
      }
      setCategoryStyles(auto);
    }
  }, []);

  /* ───── 3. حفظ المراجعة ───── */
  const saveReview = useCallback(
    async (updates: Record<string, unknown>[]) => {
      if (!job) return;
      const res = await fetch(`/api/ai-menu/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: updates, imageMode }),
      });
      const json = await res.json();
      if (!json.ok) toast.error(json.error);
      return json;
    },
    [job, imageMode],
  );

  const saveItemEdit = useCallback(
    async (id: string, patch: Partial<AiItem>) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      await saveReview([{ id, ...patch }]);
    },
    [saveReview],
  );

  const removeItem = useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      await saveReview([{ id, remove: true }]);
      toast.success("تم حذف الصنف");
    },
    [saveReview],
  );

  /* ───── 4. النشر ───── */
  const runImport = useCallback(async () => {
    if (!job) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ai-menu/jobs/${job.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error);
        return;
      }
      setImportResult({
        categories: json.categoriesCreated,
        items: json.itemsCreated,
        images: json.imagesAttached,
        warnings: json.warnings ?? [],
      });
      setStep("done");
      onChanged();
      router_refresh();
    } catch {
      toast.error("فشل الاستيراد");
    } finally {
      setBusy(false);
    }
  }, [job, onChanged]);

  const router_refresh = () => {
    // refresh عبر تحديث خفيف — onChanged يكفي للـ RSC
  };

  /* ───── تجميع الأصناف حسب القسم ───── */
  const grouped = items.reduce<Record<string, AiItem[]>>((acc, item) => {
    (acc[item.categoryName] ??= []).push(item);
    return acc;
  }, {});

  const needsReviewCount = items.filter((i) => i.needsReview).length;
  const withImages = items.filter((i) => i.finalImageUrl).length;

  /* ═══════════════ العرض ═══════════════ */
  return (
    <div className="space-y-6">
      {/* الترويسة */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-3 border-b border-gold/15 bg-gradient-to-l from-primary/10 via-transparent to-gold/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-cream">
              <Sparkles className="h-5 w-5 text-gold" />
              المستورد الذكي — حوّل منيوك الورقي لرقمي
            </h2>
            <p className="mt-0.5 text-sm text-cream/70">
              ارفع صورة أو PDF لمنيوك الحالي — الذكاء الاصطناعي يقرأه ويبني منيوك الرقمي تلقائياً
            </p>
          </div>
          {/* مؤشر الخطوات */}
          <div className="flex items-center gap-1 text-[10px] font-bold text-cream/50">
            {["رفع", "تحليل", "مراجعة", "صور", "نشر"].map((s, i) => {
              const order: Step[] = ["upload", "analyzing", "review", "publish"];
              const active = order.indexOf(step) >= i;
              const current = order.indexOf(step) === i;
              return (
                <span
                  key={s}
                  className={cn(
                    "rounded-full px-2 py-1",
                    current && "bg-gold text-background",
                    active && !current && "text-gold",
                  )}
                >
                  {s}
                </span>
              );
            })}
          </div>
        </div>

        <div className="p-5 sm:p-8">
          {/* ═══ 1. الرفع ═══ */}
          {step === "upload" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void handleUpload(e.dataTransfer.files);
              }}
              className={cn(
                "flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed p-10 text-center transition-colors",
                dragOver ? "border-gold bg-gold/5" : "border-border",
              )}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                {busy ? <Loader2 className="h-8 w-8 animate-spin" /> : <UploadCloud className="h-8 w-8" />}
              </div>
              <div>
                <p className="font-black text-cream">اسحب منيوك هنا أو اختر ملفاً</p>
                <p className="mt-1 text-sm text-cream/60">
                  صور (JPG/PNG/WebP) أو ملف PDF — حتى 10 ملفات
                </p>
                <p className="mt-0.5 text-xs text-cream/40">
                  الملفات تُحذف تلقائياً بعد الاستيراد — لا تبقى في النظام
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => void handleUpload(e.target.files)}
                disabled={busy}
              />
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="rounded-xl bg-gradient-to-l from-gold to-[#a87a2b] font-black text-background"
                size="lg"
              >
                <Sparkles className="h-4 w-4" />
                اختر ملف المنيو
              </Button>
            </div>
          )}

          {/* ═══ 2. التحليل ═══ */}
          {step === "analyzing" && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-gold" />
              <p className="text-lg font-black text-cream">جارٍ قراءة منيوك بالذكاء الاصطناعي...</p>
              <div className="w-full max-w-sm space-y-2 text-sm text-cream/60">
                <p>✓ قراءة الصفحات</p>
                <p>⏳ استخراج الأقسام والأصناف والأسعار</p>
                <p>○ مطابقة الصور</p>
              </div>
              <p className="text-xs text-cream/40">قد يستغرق حتى دقيقة — لا تغلق الصفحة</p>
            </div>
          )}

          {/* ═══ 3. المراجعة ═══ */}
          {step === "review" && job && (
            <div className="space-y-5">
              {/* ملخص */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryCard icon={TagsIcon} value={String(job.detectedCategoryCount)} label="قسم" />
                <SummaryCard icon={UtensilsIcon} value={String(items.length)} label="صنف" />
                <SummaryCard icon={ImageIcon} value={String(withImages)} label="صورة جاهزة" />
                <SummaryCard
                  icon={AlertTriangle}
                  value={String(needsReviewCount)}
                  label="تحتاج مراجعة"
                  warn={needsReviewCount > 0}
                />
              </div>

              {/* نمط الصور العام */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <Label className="text-sm font-black text-cream">نمط الصور</Label>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(["SMART", "MENU_ONLY", "AI_ONLY"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setImageMode(m)}
                      className={cn(
                        "rounded-xl border p-3 text-center text-xs font-bold transition-all",
                        imageMode === m
                          ? "border-gold bg-gold/10 text-gold"
                          : "border-border text-cream/60 hover:border-gold/40",
                      )}
                    >
                      {m === "SMART" && "🧠 ذكي"}
                      {m === "MENU_ONLY" && "📄 صور المنيو فقط"}
                      {m === "AI_ONLY" && "✨ توليد AI فقط"}
                      <span className="mt-1 block text-[10px] font-normal text-cream/40">
                        {m === "SMART" && "أصلي إن وُجد، وإلا AI"}
                        {m === "MENU_ONLY" && "بدون توليد"}
                        {m === "AI_ONLY" && "توليد للجميع"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* الأصناف حسب القسم */}
              {Object.entries(grouped).map(([catName, catItems]) => (
                <div key={catName} className="rounded-2xl border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h4 className="flex items-center gap-2 font-black text-cream">
                      <TagsIcon className="h-4 w-4 text-gold" />
                      {catName}
                      <span className="text-xs font-normal text-cream/40">
                        ({catItems.length} صنف)
                      </span>
                    </h4>
                  </div>
                  {/* كروت اختيار النمط البصري */}
                  <div className="flex flex-wrap gap-2 px-4 pb-3 pt-1">
                    {styles.map((s) => {
                      const selected = categoryStyles[catItems[0]?.categoryType ?? ""] === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setCategoryStyles((prev) => ({
                              ...prev,
                              [catItems[0]?.categoryType ?? ""]: s.id,
                            }))
                          }
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-3 py-2 text-start transition-all",
                            selected
                              ? "border-gold bg-gold/10 shadow-[0_0_12px_rgba(212,168,83,0.15)]"
                              : "border-border hover:border-gold/40",
                          )}
                        >
                          {/* دائرتا لون */}
                          <span className="flex shrink-0 -space-x-1.5">
                            <span
                              className="h-5 w-5 rounded-full border border-white/20"
                              style={{ backgroundColor: s.colors[0] }}
                            />
                            <span
                              className="h-5 w-5 rounded-full border border-white/20"
                              style={{ backgroundColor: s.colors[1] }}
                            />
                          </span>
                          <span>
                            <span className={cn("block text-xs font-black", selected ? "text-gold" : "text-cream")}>
                              {s.nameAr}
                            </span>
                            {s.description && (
                              <span className="block text-[10px] text-cream/40">{s.description}</span>
                            )}
                          </span>
                          {selected && <Check className="h-3.5 w-3.5 shrink-0 text-gold" />}
                        </button>
                      );
                    })}
                  </div>
                  <ul className="divide-y divide-border/50">
                    {catItems.map((item) => (
                      <ReviewItemRow
                        key={item.id}
                        item={item}
                        currency={currency}
                        editing={editingId === item.id}
                        onEdit={() => setEditingId(editingId === item.id ? null : item.id)}
                        onSave={(patch) => {
                          void saveItemEdit(item.id, patch);
                          setEditingId(null);
                        }}
                        onRemove={() => void removeItem(item.id)}
                      />
                    ))}
                  </ul>
                </div>
              ))}

              {/* أزرار */}
              <div className="flex gap-3">
                <Button
                  onClick={() => setStep("publish")}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-gradient-to-l from-gold to-[#a87a2b] py-6 font-black text-background"
                  size="lg"
                >
                  <PartyPopper className="h-5 w-5" />
                  نشر المنيو الآن ({items.length} صنف)
                </Button>
              </div>
            </div>
          )}

          {/* ═══ 4. النشر ═══ */}
          {step === "publish" && job && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryCard icon={TagsIcon} value={String(items.length)} label="صنف جاهز" />
                <SummaryCard icon={ImageIcon} value={String(withImages)} label="بصورة" />
                <SummaryCard icon={CheckCircle2} value={String(job.extractedImageCount)} label="أصلي من المنيو" />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep("review")}
                  className="rounded-xl"
                >
                  <ChevronLeft className="h-4 w-4" />
                  رجوع للمراجعة
                </Button>
                <Button
                  onClick={() => void runImport()}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-gradient-to-l from-gold to-[#a87a2b] py-6 font-black text-background"
                  size="lg"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <PartyPopper className="h-5 w-5" />}
                  نشر المنيو الآن ({items.length} صنف)
                </Button>
              </div>
            </div>
          )}

          {/* ═══ تم! ═══ */}
          {step === "done" && importResult && (
            <div className="flex flex-col items-center gap-5 py-12 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <PartyPopper className="h-10 w-10" />
              </div>
              <div>
                <p className="text-2xl font-black text-gold-gradient">منيوك جاهز! 🎉</p>
                <p className="mt-2 text-sm text-cream/70">
                  {importResult.categories} أقسام · {importResult.items} صنف ·{" "}
                  {importResult.images} صورة — ظاهرة الآن في المنيو العام
                </p>
              </div>
              {importResult.warnings.length > 0 && (
                <div className="w-full max-w-lg space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-start">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-amber-200">
                    <AlertTriangle className="h-4 w-4" />
                    {importResult.warnings.length} تنبيه:
                  </p>
                  {importResult.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-200/80">• {w}</p>
                  ))}
                </div>
              )}
              <Button variant="outline" onClick={() => { setStep("upload"); setJob(null); setItems([]); }}>
                <UploadCloud className="h-4 w-4" />
                استيراد منيو آخر
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ عناصر مساعدة ═══════════════ */

function SummaryCard({
  icon: Icon, value, label, warn,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3",
        warn ? "border-amber-500/40 bg-amber-500/5" : "border-gold/20 bg-card",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          warn ? "bg-amber-500/15 text-amber-400" : "bg-gold/10 text-gold",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className={cn("text-xl font-black", warn ? "text-amber-300" : "text-gold")}>{value}</p>
        <p className="text-[11px] font-semibold text-cream/60">{label}</p>
      </div>
    </div>
  );
}

function ReviewItemRow({
  item, currency, editing, onEdit, onSave, onRemove,
}: {
  item: AiItem;
  currency: string;
  editing: boolean;
  onEdit: () => void;
  onSave: (patch: Partial<AiItem>) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price?.toString() ?? "");

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {/* الصورة */}
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted/30">
        {item.finalImageUrl ? (
          <Image src={item.finalImageUrl} alt={item.name} fill sizes="56px" className="object-cover" unoptimized />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-cream/30">
            {item.imageDetected ? <ImageIcon className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
          </span>
        )}
        {item.imageSource === "AI_GENERATED" && (
          <span className="absolute bottom-0 end-0 rounded-tl bg-gold px-1 text-[8px] font-black text-background">
            AI
          </span>
        )}
      </div>

      {/* البيانات */}
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 w-40 text-xs"
              dir="auto"
            />
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              placeholder="السعر"
              className="h-8 w-24 text-xs"
            />
            <button
              type="button"
              onClick={() => onSave({ name, price: price ? Number(price) : null })}
              className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-400"
              aria-label="حفظ"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg bg-muted p-1.5 text-cream/60"
              aria-label="إلغاء"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <p className="flex items-center gap-1.5 truncate text-sm font-bold text-cream">
              {item.name}
              {item.needsReview && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black text-amber-300"
                  title={item.reviewReasons?.map((r) => REASON_LABELS[r] ?? r).join(" · ")}
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  مراجعة
                </span>
              )}
              {item.variants && item.variants.length > 0 && (
                <span className="rounded-full bg-gold/10 px-1.5 py-0.5 text-[9px] text-gold">
                  {item.variants.map((v) => v.name).join(" · ")}
                </span>
              )}
            </p>
            {item.description && (
              <p className="mt-0.5 text-xs text-cream/60 line-clamp-1">
                {item.description}
              </p>
            )}
            <div className="mt-1 flex items-center gap-2">
              <p className="text-xs font-semibold text-gold">
                {formatPrice(item.price, currency)}
              </p>
              {item.imageSource === "AI_GENERATED" && (
                <span className="rounded-full bg-gold/10 px-1.5 py-0.5 text-[9px] text-gold">
                  مولّد بالـ AI
                </span>
              )}
              {item.imageSource === "MENU_ORIGINAL" && (
                <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-400">
                  من المنيو الأصلي
                </span>
              )}
              {item.imageSource === "NONE" && (
                <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] text-destructive">
                  بلا صورة
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* أزرار */}
      <div className="flex shrink-0 items-center gap-1">
        {editing ? null : (
          <>
            {/* إعادة توليد الصورة - معطلة لأن توليد الصور أُزيل */}
            {/* {(!item.finalImageUrl || item.imageSource === "AI_GENERATED") && (
              <button
                type="button"
                onClick={() => onSave({ regenerateImage: true })}
                className="rounded-lg p-2 text-cream/50 hover:bg-gold/10 hover:text-gold"
                aria-label="إعادة توليد الصورة"
                title="إعادة توليد الصورة بالـ AI"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </button>
            )} */}
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg p-2 text-cream/50 hover:bg-gold/10 hover:text-gold"
              aria-label="تعديل"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-2 text-cream/50 hover:bg-destructive/10 hover:text-destructive"
          aria-label="حذف"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
