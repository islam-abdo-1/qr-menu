"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, Loader2, Percent, Plus, Ruler } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader } from "@/components/admin/image-uploader";
import { createMenuItemAction, updateMenuItemAction } from "@/lib/actions/menu";
import { cn } from "@/lib/utils";
import type { AdminItem } from "./types";

const SIZE_LETTERS = ["S", "M", "L"] as const; // حُذف XL

const WEIGHT_PRESETS = ["ربع كيلو", "نص كيلو", "كيلو"] as const;

type SizeMode = "letters" | "weight";

export type ItemFormValue = {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  isAvailable: boolean;
  imageUrl: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageSizeKB?: number | null;
  discountPercentage: number | null;
  sizeMode: SizeMode;
  sizes: { sizeCode: string; price: string }[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  categories: { id: string; name: string }[];
  initial?: { item: AdminItem; categoryId: string } | null;
  presetCategoryId?: string;
};

export function ItemFormDialog({ open, onOpenChange, onSaved, categories, initial, presetCategoryId }: Props) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.item.name ?? "");
  const [description, setDescription] = useState(initial?.item.description ?? "");
  const [price, setPrice] = useState(initial ? String(initial.item.price) : "");
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? presetCategoryId ?? categories[0]?.id ?? "",
  );
  const [isAvailable, setIsAvailable] = useState(initial?.item.isAvailable ?? true);
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.item.imageUrl ?? null,
  );
  const [imageMeta, setImageMeta] = useState<{
    width: number;
    height: number;
    sizeKB: number;
  } | null>(
    initial?.item.imageWidth && initial?.item.imageHeight && initial?.item.imageSizeKB
      ? {
          width: initial.item.imageWidth,
          height: initial.item.imageHeight,
          sizeKB: initial.item.imageSizeKB,
        }
      : null,
  );

  // خصم النسبة
  const discountPct = initial?.item.discountPercentage ?? null;
  const [discountEnabled, setDiscountEnabled] = useState(discountPct != null && discountPct > 0);
  const [discountValue, setDiscountValue] = useState(discountPct != null && discountPct > 0 ? String(discountPct) : "");

  // المقاسات: الوضع (أحرف/وزن) + المقاسات المفعلة + أسعارها + الأوزان المخصصة
  const [sizeMode, setSizeMode] = useState<SizeMode>(initial?.item.sizeMode ?? "letters");
  const [activeSizes, setActiveSizes] = useState<string[]>(
    initial?.item.sizes.map((s) => s.sizeCode) ?? [],
  );
  const [sizePrices, setSizePrices] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of initial?.item.sizes ?? []) map[s.sizeCode] = String(s.price);
    return map;
  });
  // أوزان مخصصة أضافها الأدمن (بخلاف ربع/نص/كيلو)
  const [customWeights, setCustomWeights] = useState<string[]>(() =>
    (initial?.item.sizes ?? [])
      .map((s) => s.sizeCode)
      .filter((c) => !(WEIGHT_PRESETS as readonly string[]).includes(c)),
  );
  const [customWeightInput, setCustomWeightInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function toggleSize(code: string) {
    setFieldErrors((f) => ({ ...f, sizes: [] }));
    setActiveSizes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function setSizePrice(code: string, value: string) {
    setFieldErrors((f) => ({ ...f, sizes: [] }));
    setSizePrices((m) => ({ ...m, [code]: value }));
  }

  // التبديل بين الوضعين يصفّر كل المقاسات — وضع واحد فقط لكل صنف (لا خلط)
  function switchSizeMode(mode: SizeMode) {
    if (mode === sizeMode) return;
    setSizeMode(mode);
    setActiveSizes([]);
    setSizePrices({});
    setCustomWeights([]);
    setFieldErrors((f) => ({ ...f, sizes: [] }));
  }

  function addCustomWeight() {
    const name = customWeightInput.trim();
    if (!name) return;
    setFieldErrors((f) => ({ ...f, sizes: [] }));
    if (customWeights.includes(name)) {
      setCustomWeightInput("");
      setActiveSizes((prev) => (prev.includes(name) ? prev : [...prev, name]));
      return;
    }
    const next = [...customWeights, name];
    setCustomWeights(next);
    setCustomWeightInput("");
    setActiveSizes((prev) => [...prev, name]);
  }

  function removeCustomWeight(name: string) {
    setCustomWeights((prev) => prev.filter((w) => w !== name));
    setActiveSizes((prev) => prev.filter((c) => c !== name));
    setSizePrices((m) => {
      const next = { ...m };
      delete next[name];
      return next;
    });
  }

  const sizeOptions: string[] =
    sizeMode === "letters"
      ? [...SIZE_LETTERS]
      : [...WEIGHT_PRESETS, ...customWeights];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // لا نسمح بمقاس مفعّل بدون سعر واضح
    const missingSize = activeSizes.find((code) => !(sizePrices[code] ?? "").trim());
    if (missingSize) {
      setFieldErrors({
        sizes: [`اكتب سعر مقاس ${missingSize} قبل الحفظ`],
      });
      toast.error(`اكتب سعر مقاس ${missingSize}`);
      return;
    }

    setSaving(true);
    setFieldErrors({});

    const input: ItemFormValue = {
      name,
      description,
      price,
      categoryId,
      isAvailable,
      imageUrl,
      imageWidth: imageUrl ? (imageMeta?.width ?? null) : null,
      imageHeight: imageUrl ? (imageMeta?.height ?? null) : null,
      imageSizeKB: imageUrl ? (imageMeta?.sizeKB ?? null) : null,
      discountPercentage:
        discountEnabled && Number(discountValue) > 0 ? Number(discountValue) : null,
      sizeMode,
      sizes: activeSizes.map((code) => ({ sizeCode: code, price: sizePrices[code] })),
    };

    const res = isEdit && initial
      ? await updateMenuItemAction(initial.item.id, input)
      : await createMenuItemAction(input);

    setSaving(false);

    if (res.ok) {
      toast.success(isEdit ? "تم تحديث العنصر" : "تمت إضافة العنصر");
      onOpenChange(false);
      onSaved();
    } else {
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      if (res.error) toast.error(res.error);
    }
  }

  const field = (key: string) => (
    <>
      {fieldErrors[key]?.[0] && (
        <span className="text-xs font-medium text-destructive">{fieldErrors[key][0]}</span>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل العنصر" : "إضافة عنصر جديد"}</DialogTitle>
          <DialogDescription>
            جميع البيانات تُفحص وتُنقّى تلقائيًا لحماية المنيو.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="item-name">اسم العنصر *</Label>
            <input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(
                "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring",
                fieldErrors.name && "border-destructive",
              )}
              placeholder="مثال: كباب بلدي"
            />
            {field("name")}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-desc">الوصف</Label>
            <textarea
              id="item-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="وصف مختصر للمكونات أو طريقة التحضير"
            />
            {field("description")}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {activeSizes.length > 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-gold/25 bg-gold/5 px-4 py-3">
                <Ruler className="h-4 w-4 shrink-0 text-gold" />
                <p className="text-xs font-semibold text-cream/80">
                  السعر يُحسب تلقائيًا من أقل مقاس — ما فيش حاجة تكتبها هنا
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="item-price">السعر *</Label>
                <input
                  id="item-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={cn(
                    "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring",
                    fieldErrors.price && "border-destructive",
                  )}
                  placeholder="0.00"
                />
                {field("price")}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>القسم *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field("categoryId")}
            </div>
          </div>

          {/* خصم النسبة */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">خصم على العنصر؟</p>
                <p className="text-xs text-muted-foreground">
                  نسبة مئوية تظهر للزبون مع السعر القديم مشطوبًا
                </p>
              </div>
            </div>
            <Switch
              checked={discountEnabled}
              onCheckedChange={setDiscountEnabled}
              aria-label="تطبيق خصم"
            />
          </div>
          {discountEnabled ? (
            <div className="space-y-1.5">
              <Label htmlFor="item-discount">نسبة الخصم</Label>
              <div className="relative">
                <input
                  id="item-discount"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 pe-12 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="15"
                />
                <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">
                  %
                </span>
              </div>
              {field("discountPercentage")}
            </div>
          ) : null}

          {/* المقاسات */}
          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold">مقاسات (اختياري)</p>
                  <p className="text-xs text-muted-foreground">
                    كل مقاس له سعره الخاص — وضع واحد فقط لكل صنف
                  </p>
                </div>
              </div>
              {/* مفتاح الوضعين: أحجام أو وزن — لا يمكن تفعيلهما معًا */}
              <div className="flex w-fit gap-1 rounded-xl border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => switchSizeMode("letters")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-black transition-all",
                    sizeMode === "letters"
                      ? "bg-gradient-to-l from-gold to-[#a87a2b] text-background shadow"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  أحجام (S/M/L)
                </button>
                <button
                  type="button"
                  onClick={() => switchSizeMode("weight")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-black transition-all",
                    sizeMode === "weight"
                      ? "bg-gradient-to-l from-gold to-[#a87a2b] text-background shadow"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  وزن (كيلو/جرام)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {sizeOptions.map((code) => {
                const isOn = activeSizes.includes(code);
                const isCustom = sizeMode === "weight" && customWeights.includes(code);
                return (
                  <div key={code} className="group flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleSize(code)}
                      className={cn(
                        "flex h-10 items-center justify-center rounded-xl border px-2.5 text-sm font-black transition-all active:scale-95",
                        isOn
                          ? "border-primary bg-primary/15 text-primary shadow-sm"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary",
                      )}
                      aria-pressed={isOn}
                    >
                      {code}
                    </button>
                    {isCustom ? (
                      <button
                        type="button"
                        onClick={() => removeCustomWeight(code)}
                        aria-label={`حذف ${code}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        ✕
                      </button>
                    ) : null}
                    {isOn ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={sizePrices[code] ?? ""}
                        onChange={(e) => setSizePrice(code, e.target.value)}
                        placeholder="السعر"
                        aria-label={`سعر مقاس ${code}`}
                        className={cn(
                          "h-10 w-20 rounded-lg border border-input bg-background px-2 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-ring",
                          sizePrices[code] ? "" : "border-destructive/60",
                        )}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* إضافة وزن مخصص — أكثر من وزن ممكن */}
            {sizeMode === "weight" ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customWeightInput}
                  onChange={(e) => setCustomWeightInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomWeight();
                    }
                  }}
                  placeholder="وزن مخصص (مثال: كيلو ونص، 750 جم)"
                  className={cn(
                    "h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring",
                    activeSizes.length >= 8 && "opacity-60",
                  )}
                  disabled={activeSizes.length >= 8}
                />
                <button
                  type="button"
                  onClick={addCustomWeight}
                  disabled={activeSizes.length >= 8}
                  className="flex h-10 shrink-0 items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs font-black text-primary transition-all hover:bg-primary/20 active:scale-95 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  إضافة
                </button>
              </div>
            ) : null}

            {activeSizes.length >= 8 ? (
              <p className="text-[11px] text-destructive">الحد الأقصى 8 مقاسات</p>
            ) : null}
            {field("sizes")}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">متاح للعرض</p>
                <p className="text-xs text-muted-foreground">يظهر في المنيو العام عندما يكون النشاط مفعّلًا</p>
              </div>
            </div>
            <Switch
              checked={isAvailable}
              onCheckedChange={setIsAvailable}
              aria-label="متاح للعرض"
            />
          </div>

          <div className="space-y-1.5">
            <Label>صورة العنصر</Label>
            <ImageUploader
              value={imageUrl}
              onChange={(url, meta) => {
                setImageUrl(url);
                setImageMeta(url ? (meta ?? null) : null);
              }}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}