"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
import { requestPasswordResetAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors(null);
    setLoading(true);
    const res = await requestPasswordResetAction(email);
    setLoading(false);
    if (res.ok) {
      setDone(true);
    } else {
      setError(res.error);
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
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
          <h1 className="font-display text-2xl font-bold text-gold-gradient">تحقق من بريدك</h1>
          <p className="max-w-sm text-sm leading-relaxed text-cream/75">
            إن وُجد حساب بهذا البريد ستصل رسالة تحتوي رابط استعادة كلمة المرور — افحص صندوق
            الوارد (أو الرسائل غير المرغوب فيها).
          </p>
          <Link
            href="/login"
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] font-black text-background shadow-[0_12px_36px_-10px_rgba(212,168,83,0.55)] transition-all hover:brightness-110 active:scale-[0.98]"
          >
            العودة لتسجيل الدخول
          </Link>
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
            <KeyRound className="h-7 w-7" />
          </motion.div>
          <div>
            <h1 className="font-display text-3xl font-bold text-gold-gradient">نسيت كلمة المرور</h1>
            <p className="mt-1.5 text-sm text-cream/75">
              اكتب بريدك الإلكتروني وسنرسل لك رابط استعادة
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-bold">
              البريد الإلكتروني
            </label>
            <div className="group relative">
              <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                required
                className={cn(
                  "h-12 w-full rounded-xl border border-input bg-background ps-11 pe-3 text-sm shadow-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
                  fieldErrors?.email && "border-destructive",
                )}
              />
            </div>
            {fieldErrors?.email?.[0] && (
              <p className="text-xs font-medium text-destructive">{fieldErrors.email[0]}</p>
            )}
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
            {loading ? "جارٍ الإرسال..." : "إرسال رابط الاستعادة"}
          </button>
        </form>

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
