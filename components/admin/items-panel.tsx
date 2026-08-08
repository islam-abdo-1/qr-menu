"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deleteMenuItemAction,
  toggleItemAvailabilityAction,
} from "@/lib/actions/menu";
import { formatPrice, cn } from "@/lib/utils";
import { ItemFormDialog } from "@/components/admin/item-form-dialog";
import type { AdminData, AdminItem } from "./types";

type Props = {
  data: AdminData;
  onChanged: () => void;
};

type FormTarget =
  | { mode: "create"; categoryId: string }
  | { mode: "edit"; item: AdminItem; categoryId: string };

export function ItemsPanel({ data, onChanged }: Props) {
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [deleting, setDeleting] = useState<AdminItem | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyToggle, setBusyToggle] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  const visibleCategories = useMemo(() => {
    if (!q) return data.categories;
    return data.categories
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => i.name.toLowerCase().includes(q)),
      }))
      .filter((c) => c.items.length > 0);
  }, [data.categories, q]);

  async function handleToggle(item: AdminItem) {
    setBusyToggle(item.id);
    const res = await toggleItemAvailabilityAction(item.id, !item.isAvailable);
    setBusyToggle(null);
    if (res.ok) {
      toast.success(item.isAvailable ? "تم إخفاء العنصر" : "أصبح العنصر ظاهرًا");
      onChanged();
    } else {
      toast.error(res.error);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusyDelete(true);
    const res = await deleteMenuItemAction(deleting.id);
    setBusyDelete(false);
    if (res.ok) {
      toast.success("تم حذف العنصر");
      setDeleting(null);
      onChanged();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-10">
      {/* بحث */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث في العناصر..."
          className="h-11 w-full rounded-xl border border-input bg-card ps-11 pe-3 text-sm shadow-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
        />
      </div>

      {visibleCategories.length === 0 && q ? (
        <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          لا توجد نتائج مطابقة لبحثك
        </p>
      ) : (
        visibleCategories.map((category) => (
          <section key={category.id} className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-[#a87a2b] text-xs font-black text-background">
                  {category.name.charAt(0)}
                </span>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-lg font-black">{category.name}</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                    {category.items.length} عنصر
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => setFormTarget({ mode: "create", categoryId: category.id })}
              >
                <Plus className="h-4 w-4" />
                إضافة عنصر
              </Button>
            </div>

            {category.items.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                لا توجد عناصر في هذا القسم بعد
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                {category.items.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 p-3 transition-colors hover:bg-accent/40 sm:p-4",
                      !item.isAvailable && "opacity-60",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-14 w-14 shrink-0 rounded-xl object-cover shadow-sm"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold/40 to-primary/30 text-lg font-black text-primary">
                          {item.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-sm font-bold">
                          {item.name}
                          {!item.isAvailable && (
                            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                              <EyeOff className="h-3 w-3" />
                              مخفي
                            </span>
                          )}
                        </p>
                        {item.description ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs italic text-muted-foreground/70">
                            بدون وصف
                          </p>
                        )}
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-bold text-primary">
                          {formatPrice(item.price, data.settings.currency)}
                          {item.discountPercentage ? (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-black text-destructive">
                              خصم {item.discountPercentage}%
                            </span>
                          ) : null}
                          {item.sizes.length > 0 ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black text-muted-foreground">
                              {item.sizes.map((s) => s.sizeCode).join(" / ")}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <div className="me-2 flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5">
                        <Eye className={cn("h-3.5 w-3.5", item.isAvailable ? "text-green-600" : "text-muted-foreground")} />
                        <Switch
                          checked={item.isAvailable}
                          onCheckedChange={() => handleToggle(item)}
                          disabled={busyToggle === item.id}
                        />
                      </div>
                      <Button
                        size="iconSm"
                        variant="ghost"
                        className="rounded-lg"
                        onClick={() =>
                          setFormTarget({ mode: "edit", item, categoryId: category.id })
                        }
                        aria-label="تعديل"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="iconSm"
                        variant="ghost"
                        className="rounded-lg text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleting(item)}
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}

      {/* إضافة / تعديل عنصر */}
      <ItemFormDialog
        open={Boolean(formTarget)}
        onOpenChange={(open) => !open && setFormTarget(null)}
        onSaved={onChanged}
        categories={data.categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={formTarget?.mode === "edit" ? { item: formTarget.item, categoryId: formTarget.categoryId } : null}
        presetCategoryId={formTarget?.mode === "create" ? formTarget.categoryId : undefined}
        key={
          formTarget?.mode === "edit"
            ? formTarget.item.id
            : formTarget?.mode === "create"
              ? formTarget.categoryId
              : "none"
        }
      />

      {/* تأكيد الحذف */}
      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العنصر</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف «{deleting?.name}» نهائيًا مع صورته من التخزين. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busyDelete}>
              {busyDelete && <Loader2 className="h-4 w-4 animate-spin" />}
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}