"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Bike,
  ChevronDown,
  Clock3,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import {
  getStaffOrdersAction,
  getStaffRestaurantsAction,
  staffLoginAction,
  staffLogoutAction,
  staffUpdateOrderStatusAction,
  type OrderStatus,
  type OrderView,
} from "@/lib/actions/orders";

const STATUS_META: Record<OrderStatus, { label: string; next: OrderStatus | null; cls: string }> = {
  new: { label: "جديد", next: "preparing", cls: "bg-gold/15 text-gold border-gold/30" },
  preparing: { label: "في التحضير", next: "done", cls: "bg-[#3ECF7A]/15 text-[#3ECF7A] border-[#3ECF7A]/30" },
  done: { label: "تم التسليم", next: null, cls: "bg-cream/10 text-cream/60 border-border" },
};

export function StaffShell() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [restaurants, setRestaurants] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [slug, setSlug] = useState("");
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const loadOrders = useCallback(async () => {
    const res = await getStaffOrdersAction();
    if (!res.ok) return false;
    setRestaurantName(res.data.restaurantName);
    setOrders(res.data.orders);
    return true;
  }, []);

  useEffect(() => {
    loadOrders().then((authed) => {
      if (authed) {
        setLoading(false);
        return;
      }
      // غير مصرح — حمّل قائمة المطاعم لشاشة الدخول
      getStaffRestaurantsAction().then((r) => {
        if (r.ok) setRestaurants(r.data);
        setLoading(false);
      });
    });
  }, [loadOrders]);

  // تحديث تلقائي كل 15 ثانية أثناء العرض
  useEffect(() => {
    if (!restaurantName) return;
    const t = setInterval(() => loadOrders(), 15_000);
    return () => clearInterval(t);
  }, [restaurantName, loadOrders]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError(null);
    setLoginBusy(true);
    const res = await staffLoginAction(slug, pin);
    setLoginBusy(false);
    if (!res.ok) {
      setLoginError(res.error);
      return;
    }
    setRestaurantName(res.data.restaurantName);
    await loadOrders();
  }

  async function handleLogout() {
    await staffLogoutAction();
    router.refresh();
    setRestaurantName(null);
    setOrders(null);
    setPin("");
    getStaffRestaurantsAction().then((r) => {
      if (r.ok) setRestaurants(r.data);
    });
  }

  async function advance(orderId: string, status: OrderStatus) {
    setBusy(orderId);
    const res = await staffUpdateOrderStatusAction(orderId, status);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    await loadOrders();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </main>
    );
  }

  /* ───── شاشة الدخول بالكود السري ───── */
  if (!restaurantName) {
    return (
      <main className="texture-dots flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-3xl border border-gold/20 bg-card p-8 shadow-elevated">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-[#a87a2b] text-background shadow-[0_10px_30px_-8px_rgba(212,168,83,0.6)]">
              <UtensilsCrossed className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-gold-gradient">شاشة الموظفين</h1>
              <p className="mt-1 text-xs text-cream/65">أدخل بيانات مطعمك والكود السري لعرض الطلبات</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-3" noValidate>
            <div className="relative">
              <Store className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <div className="relative">
                <select
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  className="h-11 w-full appearance-none rounded-xl border border-input bg-background ps-10 pe-9 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                >
                  <option value="" disabled>
                    اختر مطعمك
                  </option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            <div className="relative">
              <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="الكود السري"
                required
                className="h-11 w-full rounded-xl border border-input bg-background ps-10 pe-3 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              />
            </div>

            {loginError && (
              <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loginBusy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] font-black text-background transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              {loginBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              دخول
            </button>
          </form>
        </div>
      </main>
    );
  }

  /* ───── لوحة الطلبات ───── */
  const newCount = orders?.filter((o) => o.status === "new").length ?? 0;

  return (
    <main className="min-h-screen bg-background pb-10">
      <header className="border-b border-gold/15 bg-[#171310]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-[#a87a2b] text-background">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-sm font-black text-cream">
              {restaurantName}
              {newCount > 0 ? (
                <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-black text-gold">
                  <Bell className="h-3 w-3" />
                  {newCount} جديد
                </span>
              ) : null}
            </h1>
            <p className="text-xs text-cream/60">شاشة الطلبات — تتحدث تلقائيًا كل 15 ثانية</p>
          </div>
          <button
            type="button"
            onClick={() => loadOrders()}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/25 bg-gold/10 text-gold transition-colors hover:bg-gold/20"
            aria-label="تحديث"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-cream/70 transition-colors hover:text-destructive"
            aria-label="خروج"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-3xl space-y-4 px-4">
        {orders?.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-card/50 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gold/10 text-gold">
              <Clock3 className="h-8 w-8" />
            </div>
            <div>
              <p className="font-bold text-cream">لا توجد طلبات حاليًا</p>
              <p className="mt-1 text-sm text-cream/60">الطلبات الجديدة ستظهر هنا تلقائيًا</p>
            </div>
          </div>
        ) : null}

        {orders?.map((o) => {
          const meta = STATUS_META[o.status];
          return (
            <div
              key={o.id}
              className={cn(
                "rounded-2xl border bg-card p-5 shadow-soft transition-colors",
                o.status === "new" ? "border-gold/40" : "border-border",
              )}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-[#a87a2b] font-display text-xl font-black text-background">
                  {o.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-cream">
                    {o.customerName || "زبون"}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black",
                        meta.cls,
                      )}
                    >
                      {o.type === "dine-in" ? (
                        <Store className="h-3 w-3" />
                      ) : (
                        <Bike className="h-3 w-3" />
                      )}
                      {o.type === "dine-in"
                        ? o.tableNo
                          ? `طاولة ${o.tableNo}`
                          : "في المطعم"
                        : "توصيل"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black",
                        meta.cls,
                      )}
                    >
                      {meta.label}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-cream/60">
                    {new Date(o.createdAt).toLocaleTimeString("ar-EG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {o.tableNo ? ` — طاولة ${o.tableNo}` : ""}
                    {o.address ? ` — ${o.address}` : ""}
                    {o.phone ? ` — ${o.phone}` : ""}
                    {o.notes ? ` — ملاحظة: ${o.notes}` : ""}
                  </p>
                </div>
                <p className="text-lg font-black text-gold">
                  {formatPrice(o.total, "EGP", "ar")}
                </p>
              </div>

              <ul className="mt-3 space-y-1.5 border-t border-border/70 pt-3">
                {o.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 text-sm">
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-gold/15 px-1 text-[11px] font-black text-gold">
                      {i.qty}
                    </span>
                    <span className="text-cream/85">{i.name}</span>
                  </li>
                ))}
              </ul>

              {meta.next ? (
                <button
                  type="button"
                  disabled={busy === o.id}
                  onClick={() => advance(o.id, meta.next!)}
                  className={cn(
                    "mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl font-black transition-all active:scale-[0.99] disabled:opacity-60",
                    o.status === "new"
                      ? "bg-gradient-to-r from-gold to-[#a87a2b] text-background shadow-[0_10px_30px_-10px_rgba(212,168,83,0.6)]"
                      : "border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20",
                  )}
                >
                  {busy === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {o.status === "new" ? "بدء التحضير" : "تم التسليم"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </main>
  );
}
