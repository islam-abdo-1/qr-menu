"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, Loader2 } from "lucide-react";
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

export type ItemFormValue = {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  isAvailable: boolean;
  imageUrl: string | null;
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
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});

    const input = {
      name,
      description,
      price,
      categoryId,
      isAvailable,
      imageUrl,
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
              placeholder="وصف مرغر للمكونات أو طريقة التحضير"
            />
            {field("description")}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <ImageUploader value={imageUrl} onChange={setImageUrl} />
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