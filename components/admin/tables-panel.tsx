"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Table2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addTableAction,
  listTablesAction,
  removeTableAction,
  toggleTableReservedAction,
  type TableView,
} from "@/lib/actions/tables";
import { cn } from "@/lib/utils";

export function TablesPanel() {
  const [tables, setTables] = useState<TableView[] | null>(null);
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await listTablesAction();
    if (res.ok) setTables(res.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const n = parseInt(number, 10);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("اكتب رقم طاولة صحيح");
      return;
    }
    setBusy(true);
    const res = await addTableAction(n);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setTables(res.data);
    setNumber("");
    toast.success("تمت إضافة الطاولة");
  }

  async function handleRemove(id: string) {
    setBusy(true);
    const res = await removeTableAction(id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setTables(res.data);
    toast.success("تم حذف الطاولة");
  }

  async function handleToggleReserved(id: string) {
    setBusy(true);
    const res = await toggleTableReservedAction(id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setTables(res.data);
    toast.success("تم تحديث حالة الطاولة");
  }

  if (!tables) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-cream/60">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
        <p className="text-sm">جارٍ تحميل الطاولات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h3 className="flex items-center gap-2 text-sm font-black text-cream">
          <Table2 className="h-4 w-4 text-gold" />
          طاولاتك
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-cream/60">
          أضف أرقام الطاولات — العميل يختار منها عند الطلب، وحدّد المحجوز منها «محجوز».
        </p>
        <form onSubmit={handleAdd} className="mt-4 flex gap-2">
          <Input
            type="number"
            min={1}
            max={999}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="رقم الطاولة (مثال: 5)"
            className="max-w-[180px]"
          />
          <Button type="submit" disabled={busy} className="rounded-xl">
            <Plus className="h-4 w-4" />
            إضافة
          </Button>
        </form>
      </div>

      {tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-card/50 py-24 text-center">
          <Table2 className="h-10 w-10 text-gold" />
          <div>
            <p className="font-bold text-cream">لا توجد طاولات بعد</p>
            <p className="mt-1 text-sm text-cream/60">أضف أول طاولة لبدء استقبال الطلبات بأرقام</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map((t) => (
            <div
              key={t.id}
              className={cn(
                "rounded-2xl border bg-card p-4 shadow-soft",
                t.reserved ? "border-red-500/40 bg-red-500/[0.04]" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl font-display text-base font-black",
                    t.reserved
                      ? "bg-red-500/15 text-red-400"
                      : "bg-gradient-to-br from-gold to-[#a87a2b] text-background",
                  )}
                >
                  {t.number}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(t.id)}
                  disabled={busy}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-cream/60 transition-colors hover:border-red-500/50 hover:text-red-400"
                  aria-label={`حذف الطاولة ${t.number}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-xs text-cream/60">طاولة {t.number}</p>
              <button
                type="button"
                onClick={() => handleToggleReserved(t.id)}
                disabled={busy}
                className={cn(
                  "mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border text-[11px] font-black transition-all active:scale-[0.98] disabled:opacity-60",
                  t.reserved
                    ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20",
                )}
                aria-label={`تبديل حالة الطاولة ${t.number}`}
              >
                {t.reserved ? "محجوز — اضغط للتفريغ" : "متاح — اضغط للحجز"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
