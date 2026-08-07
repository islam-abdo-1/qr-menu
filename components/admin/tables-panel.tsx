"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Download, Loader2, Plus, Table2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTableAction, listTablesAction, removeTableAction, type TableView } from "@/lib/actions/tables";

const QR_DARK = "#1F1A17";
const QR_LIGHT = "#FFFFFF";

export function TablesPanel({
  slug,
  restaurantName,
}: {
  slug: string;
  restaurantName: string;
}) {
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

  if (!tables) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-cream/60">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
        <p className="text-sm">جارٍ تحميل الطاولات...</p>
      </div>
    );
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h3 className="flex items-center gap-2 text-sm font-black text-cream">
          <Table2 className="h-4 w-4 text-gold" />
          طاولاتك
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-cream/60">
          أضف أرقام الطاولات، واطبع رمز QR لكل طاولة وضعه عليها — الزبون يمسح الرمز فيفتح المنيو ورقم
          الطاولة يُعبّأ تلقائيًا في طلبه.
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
            <p className="mt-1 text-sm text-cream/60">
              أضف أول طاولة لتحصل على رمز QR خاص بها
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map((t) => (
            <TableQrCard key={t.id} table={t} slug={slug} siteUrl={siteUrl} restaurantName={restaurantName} onRemove={handleRemove} busy={busy} />
          ))}
        </div>
      )}
    </div>
  );
}

function TableQrCard({
  table,
  slug,
  siteUrl,
  restaurantName,
  onRemove,
  busy,
}: {
  table: TableView;
  slug: string;
  siteUrl: string;
  restaurantName: string;
  onRemove: (id: string) => void;
  busy: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = `${siteUrl}/m/${slug}?table=${table.number}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, { width: 360, margin: 2, color: { dark: QR_DARK, light: QR_LIGHT } }, (err) => {
      if (err) console.error("[tables-qr]", err);
    });
  }, [url]);

  async function download() {
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 1024, margin: 2, color: { dark: QR_DARK, light: QR_LIGHT } });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `qr-${restaurantName.replace(/\s+/g, "-") || "menu"}-table-${table.number}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`تم تجهيز QR الطاولة ${table.number}`);
    } catch {
      toast.error("تعذّر توليد الرمز");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-[#a87a2b] font-display text-base font-black text-background">
          {table.number}
        </span>
        <button
          type="button"
          onClick={() => onRemove(table.id)}
          disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-cream/60 transition-colors hover:border-red-500/50 hover:text-red-400"
          aria-label={`حذف الطاولة ${table.number}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="rounded-xl border-4 border-white bg-white p-1">
        <canvas ref={canvasRef} aria-label={`QR الطاولة ${table.number}`} className="h-36 w-full" />
      </div>
      <Button onClick={download} variant="outline" className="mt-3 w-full rounded-xl" size="sm">
        <Download className="h-3.5 w-3.5" />
        تحميل PNG
      </Button>
    </div>
  );
}
