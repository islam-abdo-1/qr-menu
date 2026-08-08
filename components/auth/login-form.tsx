"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Lock, Mail, ShieldCheck, UtensilsCrossed } from "lucide-react";
import { signInAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors(null);
    setLoading(true);
    const res = await signInAction(email, password);
    if (res.ok) {
      // العودة إلى الصفحة التي كان يحاول الوصول إليها (من ?next) وليس /admin دائمًا
      router.push(next ?? "/admin");
      router.refresh();
    } else {
      setError(res.error);
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
    setLoading(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-elevated"
    >
      {/* شريط علوي */}
      <div className="h-1.5 bg-gradient-to-r from-gold via-[#a87a2b] to-gold" />

      <div className="p-8 sm:p-10">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-[#a87a2b] text-background shadow-[0_12px_36px_-10px_rgba(212,168,83,0.6)]"
          >
            <UtensilsCrossed className="h-8 w-8" />
          </motion.div>
          <div>
            <h1 className="font-display text-3xl font-bold text-gold-gradient">لوحة إدارة المنيو</h1>
            <p className="mt-1.5 text-sm text-cream/75">سجّل دخولك للتحكم في قائمتك</p>
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

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-bold">
              كلمة المرور
            </label>
            <div className="group relative">
              <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={cn(
                  "h-12 w-full rounded-xl border border-input bg-background ps-11 pe-3 text-sm font-medium shadow-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
                  fieldErrors?.password && "border-destructive",
                )}
              />
            </div>
            {fieldErrors?.password?.[0] && (
              <p className="text-xs font-medium text-destructive">{fieldErrors.password[0]}</p>
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
            {loading ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary/70" />
          المنطقة محمية — لا يُسمح بالوصول للعامة
        </p>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          ما عندك مطعم؟{" "}
          <Link href="/signup" className="font-bold text-gold hover:underline">
            أنشئ مطعمك مجانًا
          </Link>
        </p>
      </div>
    </motion.div>
  );
}