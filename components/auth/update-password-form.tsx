"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, KeyRound, Loader2, Lock, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type State = "loading" | "ready" | "error";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    const errorDesc = params.get("error_description");
    if (errorDesc) {
      setError("رابط الاستعادة غير صالح أو منتهٍ — اطلب رابطًا جديدًا");
      setState("error");
      return;
    }
    const supabase = createClient();
    let p: Promise<{ error: { message: string } | null }>;
    if (code) {
      // تدفق PKCE: كود قصير يُستبدل بجلسة ثم نعرض نموذج كلمة المرور
      p = supabase.auth.exchangeCodeForSession(code);
    } else if (tokenHash && type === "recovery") {
      // تدفق الارتباط المباشر: توكن في الرابط نفسه
      p = supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    } else {
      setState("error");
      return;
    }
    p.then(({ error: exErr }) => {
      if (exErr) {
        setError("رابط الاستعادة غير صالح أو منتهٍ — اطلب رابطًا جديدًا");
        setState("error");
        return;
      }
      setState("ready");
    });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 8) {
      setError("كلمة المرور 8 أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: upErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (upErr) {
      setError("تعذّر تحديث كلمة المرور — حاول مرة أخرى");
      return;
    }
    await supabase.auth.signOut();
    setDone(true);
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-elevated"
      >
        <div className="h-1.5 bg-gradient-to-r from-gold via-[#a87a2b] to-gold" />
        <div className="flex flex-col items-center gap-5 p-10 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15 text-green-500">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="font-display text-2xl font-bold text-gold-gradient">تم تغيير كلمة المرور</h1>
          <p className="max-w-sm text-sm leading-relaxed text-cream/75">
            كلمة مرورك أصبحت جديدة — سجّل دخولك الآن بالبيانات الجديدة.
          </p>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] font-black text-background shadow-[0_12px_36px_-10px_rgba(212,168,83,0.55)] transition-all hover:brightness-110 active:scale-[0.98]"
          >
            الذهاب لتسجيل الدخول
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-elevated"
    >
      <div className="h-1.5 bg-gradient-to-r from-gold via-[#a87a2b] to-gold" />

      <div className="p-8 sm:p-10">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/40 bg-black text-gold shadow-[0_12px_36px_-10px_rgba(212,168,83,0.6)]"
          >
            <Lock className="h-7 w-7" />
          </motion.div>
          <div>
            <h1 className="font-display text-3xl font-bold text-gold-gradient">كلمة مرور جديدة</h1>
            <p className="mt-1.5 text-sm text-cream/75">اختر كلمة مرور قوية لحسابك</p>
          </div>
        </div>

        {state === "loading" ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-gold" />
          </div>
        ) : state === "error" ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <p className="text-sm leading-relaxed text-cream/75">
              {error ?? "الرابط غير صالح أو منتهٍ — اطلب رابط استعادة جديدًا من صفحة «نسيت كلمة المرور»."}
            </p>
            <Link
              href="/forgot-password"
              className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] font-black text-background shadow-[0_12px_36px_-10px_rgba(212,168,83,0.55)] transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <KeyRound className="h-4 w-4" />
              طلب رابط جديد
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-bold">
                كلمة المرور الجديدة
              </label>
              <div className="group relative">
                <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 أحرف على الأقل"
                  required
                  minLength={8}
                  className={cn(
                    "h-12 w-full rounded-xl border border-input bg-background ps-11 pe-3 text-sm font-medium shadow-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
                    error && "border-destructive",
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm" className="text-sm font-bold">
                تأكيد كلمة المرور
              </label>
              <div className="group relative">
                <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور"
                  required
                  minLength={8}
                  className={cn(
                    "h-12 w-full rounded-xl border border-input bg-background ps-11 pe-3 text-sm font-medium shadow-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
                    error && "border-destructive",
                  )}
                />
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] font-black text-background shadow-[0_12px_36px_-10px_rgba(212,168,83,0.55)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          تذكرت كلمة المرور؟{" "}
          <Link href="/login" className="font-bold text-gold hover:underline">
            سجّل دخولك
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
