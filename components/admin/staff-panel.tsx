"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateStaffSettingsAction } from "@/lib/actions/staff";
import { cn } from "@/lib/utils";

type Props = {
  staffPin: string | null;
  onSaved: () => void;
};

export function StaffPanel({ staffPin, onSaved }: Props) {
  const enabled = staffPin !== null;
  const [show, setShow] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [justGenerated, setJustGenerated] = useState<string | null>(null);

  const visiblePin = justGenerated ?? staffPin ?? "";

  const pinValid = /^\d{4}$/.test(newPin);

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

  const masked = useMemo(() => "•".repeat(visiblePin.length), [visiblePin]);

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <div className="flex items-center gap-2 border-b border-border bg-gradient-to-l from-primary/10 via-transparent to-gold/10 px-6 py-5">
        <Users className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-black">الموظفون — فريق استقبال الطلبات</h2>
          <p className="text-sm text-muted-foreground">
            كود واحد مشترك لفريقك يفتح شاشة الطلبات من /staff
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
                  ? "أي شخص يعرف الكود يستطيع فتح /staff ومتابعة الطلبات"
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

        {/* الكود الحالي */}
        {enabled ? (
          <div className="space-y-2 rounded-2xl border border-gold/20 bg-gold/5 p-4">
            <Label>الكود السري الحالي للفريق</Label>
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
              <p className="text-xs text-muted-foreground">مشاركة الكود سرية بينك وبين فريقك</p>
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
