"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changePasswordAction } from "@/lib/actions/auth";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const newErrors: Record<string, string> = {};
    if (!currentPassword) newErrors.currentPassword = "أدخل كلمة المرور الحالية";
    if (!newPassword) newErrors.newPassword = "أدخل كلمة المرور الجديدة";
    else if (newPassword.length < 8) newErrors.newPassword = "8 أحرف على الأقل";
    if (!confirmPassword) newErrors.confirmPassword = "أكد كلمة المرور الجديدة";
    else if (newPassword !== confirmPassword) newErrors.confirmPassword = "كلمتا المرور غير متطابقتين";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const res = await changePasswordAction(currentPassword, newPassword);
    if (res.ok) {
      toast.success("تم تغيير كلمة المرور بنجاح");
      router.push("/admin");
      router.refresh();
    } else {
      toast.error(res.error);
      if (res.fieldErrors) {
        setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, v]) => [k, v[0]])));
      }
    }
    setLoading(false);
  }

  function PasswordInput({
    label,
    value,
    onChange,
    type,
    error,
    show,
    onToggleShow,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type: "password" | "text";
    error?: string;
    show: boolean;
    onToggleShow: () => void;
  }) {
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-cream">{label}</label>
        <div className="relative">
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full h-11 rounded-xl border border-input bg-background px-4 text-cream placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 ${
              error ? "border-destructive" : ""
            } pr-12`}
            placeholder="••••••••"
            autoComplete={type === "password" ? "current-password" : "new-password"}
          />
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-cream"
            aria-label={show ? "إخفاء" : "إظهار"}
          >
            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <main className="texture-dots relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="relative w-full max-w-md">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-elevated">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold text-gold-gradient">تغيير كلمة المرور</h1>
            <p className="mt-2 text-sm text-cream/75">أدخل الحالية والجديدة ثم أكد</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <PasswordInput
              label="كلمة المرور الحالية"
              value={currentPassword}
              onChange={setCurrentPassword}
              type={showCurrent ? "text" : "password"}
              error={errors.currentPassword}
              show={showCurrent}
              onToggleShow={() => setShowCurrent(!showCurrent)}
            />

            <PasswordInput
              label="كلمة المرور الجديدة"
              value={newPassword}
              onChange={setNewPassword}
              type={showNew ? "text" : "password"}
              error={errors.newPassword}
              show={showNew}
              onToggleShow={() => setShowNew(!showNew)}
            />

            <PasswordInput
              label="تأكيد كلمة المرور الجديدة"
              value={confirmPassword}
              onChange={setConfirmPassword}
              type={showConfirm ? "text" : "password"}
              error={errors.confirmPassword}
              show={showConfirm}
              onToggleShow={() => setShowConfirm(!showConfirm)}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] font-black text-background transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {loading ? "جاري الحفظ..." : "حفظ التغييرات"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <a href="/admin" className="text-gold hover:underline">
              ← العودة للوحة الإدارة
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}