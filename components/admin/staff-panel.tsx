"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  addStaffAction,
  listStaffAction,
  removeStaffAction,
  updateStaffSettingsAction,
  type StaffView,
} from "@/lib/actions/staff";
import { cn } from "@/lib/utils";

type Props = {
  staffPin: string | null;
  slug: string;
  onSaved: () => void;
};

export function StaffPanel({ staffPin, slug, onSaved }: Props) {
  const enabled = staffPin !== null;
  const [show, setShow] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [justGenerated, setJustGenerated] = useState<string | null>(null);

  const [staff, setStaff] = useState<StaffView[] | null>(null);
  const [staffName, setStaffName] = useState("");
  const [staffBusy, setStaffBusy] = useState(false);

  const visiblePin = justGenerated ?? staffPin ?? "";

  const pinValid = /^\d{4}$/.test(newPin);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  const staffUrl = `${siteUrl}/staff/${slug}`;

  const loadStaff = useCallback(async () => {
    const res = await listStaffAction();
    if (res.ok) setStaff(res.data);
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  async function copyStaffUrl() {
    try {
      await navigator.clipboard.writeText(staffUrl);
      toast.success("تم نسخ رابط شاشة الموظفين");
    } catch {
      toast.error("تعذّر النسخ — انسخه يدويًا");
    }
  }

  async function savePin(pin: string) {
    setBusy(true);
    const res = await updateStaffSettingsAction({
      enabled: true,
      ...(pin ? { pin } : {}),
    });
    setBusy(false);
    if (res.ok) {
      if (res.data) {
        setJustGenerated(res.data.pin);
        setShow(true);
      }
      toast.success("تم تحديث الكود السري — شاركه مع فريقك");
      onSaved();
    } else {
      toast.error(res.error);
    }
  }

  async function toggle() {
    const next = !enabled;
    if (!next) {
      const confirmed = window.confirm(
        "إيقاف دخول الموظفين؟ لن يستطيع أحد عرض الطلبات من /staff حتى تعيد تشغيله.",
      );
      if (!confirmed) return;
    }
    setToggling(true);
    const res = await updateStaffSettingsAction({ enabled: next });
    setToggling(false);
    if (res.ok) {
      if (res.data) {
        setJustGenerated(res.data.pin);
        setShow(true);
        toast.success(`تم التفعيل — الكود الجديد: ${res.data.pin}`);
      } else {
        setJustGenerated(null);
        toast.success("تم إيقاف دخول الموظفين");
      }
      onSaved();
    } else {
      toast.error(res.error);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(visiblePin);
      toast.success("تم نسخ الكود");
    } catch {
      toast.error("تعذّر النسخ — انسخه يدويًا");
    }
  }

  async function handleAddStaff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!staffName.trim()) return;
    setStaffBusy(true);
    const res = await addStaffAction(staffName.trim());
    setStaffBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStaff(res.data);
    setStaffName("");
    toast.success("تمت إضافة الموظف");
  }

  async function handleRemoveStaff(id: string) {
    setStaffBusy(true);
    const res = await removeStaffAction(id);
    setStaffBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStaff(res.data);
    toast.success("تم حذف الموظف");
  }

  const masked = useMemo(() => "•".repeat(visiblePin.length), [visiblePin]);

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <div className="flex items-center gap-2 border-b border-border bg-gradient-to-l from-primary/10 via-transparent to-gold/10 px-6 py-5">
        <Users className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-black">الموظفون — فريق استقبال الطلبات</h2>
          <p className="text-sm text-muted-foreground">
            كل موظف يدخل باسمه + الكود المشترك، واسمه يظهر بجانب الطلبات التي تعامل معها
          </p>
        </div>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {/* حالة الدخول */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                enabled ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground",
              )}
            >
              {enabled ? <ShieldCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </span>
            <div>
              <p className="text-sm font-black">
                {enabled ? "دخول الموظفين مفعّل" : "دخول الموظفين متوقف"}
              </p>
              <p className="text-xs text-muted-foreground">
                {enabled
                  ? "الموظف المسجّل يفتح /staff باسمه والكود المشترك"
                  : "شاشة /staff ترفض الدخول حاليًا"}
              </p>
            </div>
          </div>
          <button
            onClick={toggle}
            disabled={toggling}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60",
              enabled ? "bg-emerald-500" : "bg-muted",
            )}
            aria-label={enabled ? "إيقاف دخول الموظفين" : "تفعيل دخول الموظفين"}
          >
            {toggling ? (
              <Loader2 className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-spin text-background" />
            ) : (
              <span
                className={cn(
                  "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
                  enabled ? "start-6" : "start-1",
                )}
              />
            )}
          </button>
        </div>

        {/* قائمة الموظفين */}
        <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <Label>الموظفون — أضف أسماء فريقك (يدخل كل واحد باسمه)</Label>
          </div>

          <form onSubmit={handleAddStaff} className="flex gap-2">
            <input
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="اسم الموظف (مثال: أحمد)"
              required
              maxLength={60}
              className="h-11 flex-1 rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
            />
            <Button type="submit" disabled={staffBusy} className="h-11 rounded-xl px-5">
              {staffBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              إضافة
            </Button>
          </form>

          {staff === null ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ تحميل الموظفين...
            </div>
          ) : staff.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              لا يوجد موظفون بعد — أضف اسمًا بالأعلى ليتمكن من الدخول بالاسم والكود.
            </p>
          ) : (
            <ul className="space-y-2">
              {staff.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5"
                >
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15 text-gold">
                      <Users className="h-3.5 w-3.5" />
                    </span>
                    {s.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStaff(s.id)}
                    disabled={staffBusy}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-cream/60 transition-colors hover:border-red-500/50 hover:text-red-400"
                    aria-label={`حذف الموظف ${s.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* رابط شاشة الموظفين */}
        <div className="space-y-2 rounded-2xl border border-border bg-background p-4">
          <Label>رابط شاشة الموظفين (شاركه مع فريقك)</Label>
          <div className="flex items-center gap-2">
            <div
              dir="ltr"
              className="flex h-11 flex-1 items-center gap-2 overflow-hidden rounded-xl border border-input bg-background px-3 text-sm font-mono text-muted-foreground"
            >
              <Link2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{staffUrl}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={copyStaffUrl}
              aria-label="نسخ رابط شاشة الموظفين"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            من هذا الرابط يفتح الموظف شاشة مطعمك مباشرة ويدخل اسمه والكود فقط — بدون اختيار المطعم.
          </p>
        </div>

        {/* الكود الحالي */}
        {enabled ? (
          <div className="space-y-2 rounded-2xl border border-gold/20 bg-gold/5 p-4">
            <Label>الكود السري المشترك للفريق</Label>
            <div className="flex items-center gap-2">
              <div className="flex h-11 flex-1 items-center rounded-xl border border-input bg-background px-3 font-mono text-lg tracking-[0.3em]">
                {show ? visiblePin : masked}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "إخفاء الكود" : "إظهار الكود"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={copy}
                aria-label="نسخ الكود"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => savePin("")}
                disabled={busy}
                title="توليد كود جديد"
                aria-label="توليد كود جديد"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            {justGenerated ? (
              <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <Check className="h-3.5 w-3.5" />
                كود جديد: {justGenerated} — احفظه الآن
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                نفس الكود لجميع الموظفين — الاسم هو ما يميّز كل موظف في اللوحة
              </p>
            )}
          </div>
        ) : null}

        {/* تغيير يدوي */}
        {enabled ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (pinValid) savePin(newPin.trim());
            }}
          >
            <Label htmlFor="staff-pin">تغيير الكود يدويًا (4 أرقام)</Label>
            <div className="flex gap-2">
              <input
                id="staff-pin"
                dir="ltr"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                placeholder="0000"
                className={cn(
                  "h-11 w-40 rounded-xl border border-input bg-background px-3 text-center font-mono text-lg tracking-[0.3em] outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
                  newPin && !pinValid && "border-destructive",
                )}
              />
              <Button type="submit" disabled={busy || !pinValid} className="h-11 rounded-xl px-6">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ الكود
              </Button>
            </div>
            {newPin && !pinValid ? (
              <p className="text-xs font-medium text-destructive">يجب أن يكون الكود 4 أرقام</p>
            ) : null}
          </form>
        ) : null}

        {!enabled ? (
          <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
            فعّل دخول الموظفين بالأعلى ليُولّد كود جديد وتفتح شاشة /staff أمام فريقك.
          </p>
        ) : null}
      </div>
    </div>
  );
}
