"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  QrCode,
  Settings,
  ShoppingBag,
  Table2,
  Tags,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toImageProxyUrl } from "@/lib/utils";
import { signOutAction } from "@/lib/actions/auth";
import { getOrdersAction, type OrderView } from "@/lib/actions/orders";
import { playOrderBeep, flashTitle } from "@/lib/notify";
import { ItemsPanel } from "@/components/admin/items-panel";
import { CategoriesPanel } from "@/components/admin/categories-panel";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { QrPanel } from "@/components/admin/qr-panel";
import { OrdersPanel } from "@/components/admin/orders-panel";
import { ReportsPanel } from "@/components/admin/reports-panel";
import { TablesPanel } from "@/components/admin/tables-panel";
import { StaffPanel } from "@/components/admin/staff-panel";
import { BillingPanel } from "@/components/admin/billing-panel";
import { TrialBanner } from "@/components/admin/trial-banner";
import type { AdminData } from "@/components/admin/types";

type Tab =
  | "orders"
  | "items"
  | "categories"
  | "settings"
  | "qr"
  | "reports"
  | "tables"
  | "staff"
  | "billing";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "orders", label: "الطلبات", icon: ClipboardList },
  { id: "reports", label: "التقارير", icon: BarChart3 },
  { id: "items", label: "العناصر", icon: ShoppingBag },
  { id: "categories", label: "الأقسام", icon: Tags },
  { id: "tables", label: "الطاولات", icon: Table2 },
  { id: "staff", label: "الموظفون", icon: Users },
  { id: "billing", label: "الاشتراك", icon: CreditCard },
  { id: "settings", label: "الإعدادات", icon: Settings },
  { id: "qr", label: "رمز QR", icon: QrCode },
];

export function AdminShell({ data }: { data: AdminData }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("items");

  /* ───── مراقبة الطلبات (تنبيه الطلب الجديد) ───── */
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [newBadge, setNewBadge] = useState(0);
  const knownNewIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  // فشل متتالي في الجلب (انتهاء الجلسة مثلًا) → وقف الاستطلاع + لافتة دخول
  const [sessionLost, setSessionLost] = useState<string | null>(null);
  const failCount = useRef(0);

  const pollOrders = useCallback(async () => {
    if (sessionLost) return;
    const res = await getOrdersAction();
    if (!res.ok) {
      // عطل عابر (شبكة/خادم) لا يُقفل اللوحة — فشلان متتاليان فقط = خسارة الجلسة
      failCount.current += 1;
      if (failCount.current >= 2) {
        setSessionLost(res.error || "انتهت الجلسة — أعد تسجيل الدخول");
      }
      return;
    }
    failCount.current = 0;
    setOrders(res.data);
    const newIds = new Set(res.data.filter((o) => o.status === "new").map((o) => o.id));
    if (!firstLoad.current) {
      const fresh = res.data.filter(
        (o) => o.status === "new" && !knownNewIds.current.has(o.id),
      );
      if (fresh.length > 0) {
        playOrderBeep();
        flashTitle("🔔 طلب جديد!");
        fresh.forEach((o) => {
          toast.info(`طلب جديد — رقم ${o.number}`, {
            description: `${o.customerName}${o.tableNo ? ` — طاولة ${o.tableNo}` : ""}`,
          });
        });
      }
    }
    firstLoad.current = false;
    knownNewIds.current = newIds;
    setNewBadge(newIds.size);
  }, [sessionLost]);

  useEffect(() => {
    pollOrders();
    const t = setInterval(() => {
      // لا نستعلم عند إخفاء التبويب — يوفّر استدعاءات كثيرة مع تعدد المطاعم
      if (document.visibilityState === "visible") pollOrders();
    }, 20_000);
    return () => clearInterval(t);
  }, [pollOrders]);

  // عند فقدان الجلسة لا نكمل الاستطلاع حتى إعادة الدخول
  useEffect(() => {
    if (sessionLost) {
      const t = setInterval(() => {
        router.refresh();
      }, 15_000);
      return () => clearInterval(t);
    }
  }, [sessionLost, router]);

  const menuPath = `/m/${data.restaurant.slug}`;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  const menuUrl = `${siteUrl}${menuPath}`;

  const stats = useMemo(() => {
    const totalItems = data.categories.reduce((n, c) => n + c.items.length, 0);
    const hidden = data.categories.reduce(
      (n, c) => n + c.items.filter((i) => !i.isAvailable).length,
      0,
    );
    return { categories: data.categories.length, items: totalItems, hidden };
  }, [data]);

  async function handleLogout() {
    const res = await signOutAction();
    if (res.ok) {
      router.push("/login");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const onChanged = () => {
    router.refresh();
    pollOrders();
  };

  // تغيير حالة طلب لا يغيّر بيانات السيرفر الثابتة — تحديث خفيف عبر الاستعلام فقط
  const onOrderStatusChanged = () => {
    pollOrders();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* ───── الشريط الجانبي ───── */}
      <aside className="flex flex-col border-b border-gold/15 bg-[#171310] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-e lg:min-w-72 lg:max-w-72">
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            {data.settings.logoUrl ? (
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl ring-2 ring-gold/60 ring-offset-2 ring-offset-[#171310]">
                <Image
                  src={toImageProxyUrl(data.settings.logoUrl, { width: 44, height: 44, quality: 80 }) || data.settings.logoUrl}
                  alt="شعار المطعم"
                  fill
                  sizes="44px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-[#a87a2b] text-background shadow-[0_8px_24px_-8px_rgba(212,168,83,0.6)]">
                <LayoutDashboard className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-black leading-tight text-cream">لوحة الإدارة</p>
              <p className="truncate text-xs text-cream/65">
                {data.settings.restaurantName || "بدون اسم"}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex gap-1.5 overflow-x-auto px-4 pb-4 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all lg:w-full",
                  isActive
                    ? "bg-gradient-to-l from-gold to-[#a87a2b] text-background shadow-[0_6px_20px_-8px_rgba(212,168,83,0.6)]"
                    : "text-cream/60 hover:bg-gold/10 hover:text-gold",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {t.id === "orders" && newBadge > 0 && tab !== "orders" ? (
                  <span className="ms-auto flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full bg-[#EF4444] px-1.5 text-[10px] font-black text-white">
                    {newBadge}
                  </span>
                ) : null}
                {isActive ? (
                  <span className="ms-auto hidden h-1.5 w-1.5 rounded-full bg-background/70 lg:block" />
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* شريط سفلي موحّد على الموبايل: نصفان متساويان بفاصل ذهبي — عنصر واحد أنيق بدل زرين عائمين */}
        <div className="mt-auto border-t border-gold/15 bg-[#171310] p-2.5 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:border-t-gold/20 max-lg:shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.8)] lg:mt-auto lg:flex-col">
          <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-2xl border border-gold/25 bg-[#201A14] p-1.5 shadow-inner lg:max-w-none lg:flex-col lg:gap-1 lg:rounded-xl lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <Button variant="ghost" asChild className="flex-1 justify-center rounded-xl hover:bg-gold/10 lg:w-full lg:justify-start">
              <a href={menuPath} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 text-gold" />
                <span className="max-lg:hidden">معاينة المنيو العام</span>
                <span className="lg:hidden">المنيو العام</span>
              </a>
            </Button>
            <span className="h-6 w-px shrink-0 bg-gold/20 lg:hidden" aria-hidden />
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="flex-1 justify-center rounded-xl text-destructive hover:bg-destructive/10 lg:w-full lg:justify-start"
            >
              <LogOut className="h-4 w-4" />
              <span className="max-lg:hidden">تسجيل الخروج</span>
              <span className="lg:hidden">خروج</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* ───── المحتوى ───── */}
      <main className="min-w-0 flex-1 p-4 pb-28 sm:p-8 sm:pb-8 lg:pb-8">
        <div className="mx-auto max-w-5xl">
          {sessionLost && (
            <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-destructive">انتهت الجلسة</p>
                <p className="mt-0.5 text-sm text-cream/70">{sessionLost}</p>
              </div>
              <Button
                onClick={() => {
                  router.push("/login");
                  router.refresh();
                }}
              >
                تسجيل الدخول من جديد
              </Button>
            </div>
          )}

          {data.billingStatus === "trial" && (
            <TrialBanner daysLeft={data.trialDaysLeft} onOpenBilling={() => setTab("billing")} />
          )}

          {/* الترويسة + الإحصائيات */}
          <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-4xl font-bold text-gold-gradient">
                {data.settings.restaurantName || "مطعمك"}
              </h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-cream/65">
                <UtensilsCrossed className="h-4 w-4 text-gold" />
                تحكم كامل في المنيو — التعديلات تظهر فورًا في الموقع العام
              </p>
            </div>
            <div className="flex gap-2.5">
              <div className="rounded-2xl border border-gold/20 bg-card px-5 py-3 text-center shadow-soft">
                <p className="text-2xl font-black text-gold">{stats.categories}</p>
                <p className="text-[11px] font-semibold text-cream/65">قسم</p>
              </div>
              <div className="rounded-2xl border border-gold/20 bg-card px-5 py-3 text-center shadow-soft">
                <p className="text-2xl font-black text-gold">{stats.items}</p>
                <p className="text-[11px] font-semibold text-cream/65">عنصر</p>
              </div>
              <div className="rounded-2xl border border-gold/20 bg-card px-5 py-3 text-center shadow-soft">
                <p className="text-2xl font-black text-cream/60">{stats.hidden}</p>
                <p className="text-[11px] font-semibold text-cream/65">مخفي</p>
              </div>
            </div>
          </div>

          {tab === "orders" && (
            <OrdersPanel
              orders={orders}
              onStatusChanged={onOrderStatusChanged}
              currency={data.settings.currency || "EGP"}
            />
          )}
          {tab === "reports" && <ReportsPanel />}
          {tab === "items" && <ItemsPanel data={data} onChanged={onChanged} />}
          {tab === "categories" && <CategoriesPanel data={data} onChanged={onChanged} />}
          {tab === "tables" && <TablesPanel />}
          {tab === "staff" && <StaffPanel staffPin={data.restaurant.staffPin} slug={data.restaurant.slug} onSaved={onChanged} />}
          {tab === "settings" && (
            <SettingsPanel
              settings={data.settings}
              onSaved={onChanged}
              dashboardUrl={`${siteUrl}/admin`}
            />
          )}
          {tab === "billing" && <BillingPanel data={data} />}
          {tab === "qr" && <QrPanel restaurantName={data.settings.restaurantName} menuUrl={menuUrl} />}
        </div>
      </main>
    </div>
  );
}