"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  updateCategoryAction,
} from "@/lib/actions/menu";
import { cn } from "@/lib/utils";
import type { AdminData } from "./types";

type Props = {
  data: AdminData;
  onChanged: () => void;
};

type Editing = { id: string; name: string } | null;

export function CategoriesPanel({ data, onChanged }: Props) {
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busy, setBusy] = useState("");

  const cats = data.categories;

  async function addCategory() {
    const name = newName.trim();
    if (!name) return;
    setBusy("add");
    const res = await createCategoryAction(name);
    setBusy("");
    if (res.ok) {
      setNewName("");
      toast.success("تمت إضافة القسم");
      onChanged();
    } else {
      toast.error(res.error);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const trimmed = editing.name.trim();
    if (!trimmed) return;
    setBusy(`edit:${editing.id}`);
    const res = await updateCategoryAction(editing.id, trimmed, 0);
    setBusy("");
    if (res.ok) {
      setEditing(null);
      toast.success("تم تعديل القسم");
      onChanged();
    } else {
      toast.error(res.error);
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    setBusy(`del:${deletingId}`);
    const res = await deleteCategoryAction(deletingId);
    setBusy("");
    if (res.ok) {
      setDeletingId(null);
      toast.success("تم حذف القسم وجميع عناصره");
      onChanged();
    } else {
      toast.error(res.error);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= cats.length) return;
    const next = [...cats];
    const [el] = next.splice(index, 1);
    next.splice(target, 0, el);
    setBusy("move");
    const res = await reorderCategoriesAction(next.map((c) => c.id));
    setBusy("");
    if (res.ok) {
      onChanged();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-6">
      {/* إضافة قسم جديد */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addCategory();
        }}
        className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft sm:p-4"
      >
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-[#a87a2b] text-background sm:flex">
          <Tags className="h-4 w-4" />
        </span>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="اسم القسم الجديد..."
          maxLength={60}
          className="h-11 rounded-xl"
        />
        <Button
          type="submit"
          disabled={busy === "add" || !newName.trim()}
          className="h-11 shrink-0 rounded-xl"
        >
          {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          إضافة
        </Button>
      </form>

      {/* قائمة الأقسام */}
      <div className="space-y-2.5">
        {cats.map((c, index) => (
          <div
            key={c.id}
            className={cn(
              "flex items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft transition-colors",
              editing?.id === c.id && "border-primary/40 ring-4 ring-primary/10",
            )}
          >
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0 || busy === "move"}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-primary disabled:opacity-30"
                aria-label="تحريك لأعلى"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === cats.length - 1 || busy === "move"}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-primary disabled:opacity-30"
                aria-label="تحريك لأسفل"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>

            {editing?.id === c.id ? (
              <>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                  autoFocus
                  maxLength={60}
                  className="h-10 rounded-xl"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
                <Button size="iconSm" variant="ghost" className="rounded-lg" onClick={saveEdit} disabled={busy === `edit:${c.id}`}>
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button size="iconSm" variant="ghost" className="rounded-lg" onClick={() => setEditing(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-sm font-bold">{c.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.items.length > 0 ? `${c.items.length} عنصر` : "قسم فارغ"}
                  </p>
                </div>
                <Button
                  size="iconSm"
                  variant="ghost"
                  className="rounded-lg"
                  onClick={() => setEditing({ id: c.id, name: c.name })}
                  aria-label="تعديل القسم"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="iconSm"
                  variant="ghost"
                  className="rounded-lg text-destructive hover:bg-destructive/10"
                  onClick={() => setDeletingId(c.id)}
                  disabled={c.items.length > 0}
                  aria-label={c.items.length > 0 ? "القسم غير فارغ" : "حذف القسم"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        ملاحظة: لا يمكن حذف قسم يحتوي على عناصر — انقل عناصره أولًا.
      </p>

      <AlertDialog open={Boolean(deletingId)} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف القسم</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف القسم وجميع عناصره بما فيهم الصور المرفوعة. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={busy === `del:${deletingId}`}>
              {busy === `del:${deletingId}` && <Loader2 className="h-4 w-4 animate-spin" />}
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}