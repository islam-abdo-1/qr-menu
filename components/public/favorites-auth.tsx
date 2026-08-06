"use client";

import { useState } from "react";
import { Heart, Loader2, Lock, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { signInCustomerAction, signUpCustomerAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

export function FavoritesAuth({
  open,
  onOpenChange,
  onAuthed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthed: () => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
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
    const res =
      mode === "login"
        ? await signInCustomerAction(email, password)
        : await signUpCustomerAction(email, password);
    if (res.ok) {
      setEmail("");
      setPassword("");
      onOpenChange(false);
      onAuthed();
    } else {
      setError(res.error);
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl border-gold/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-cream">
            <Heart className="h-5 w-5 text-gold" />
            {mode === "login" ? "سجّل دخولك للمفضلة" : "حساب جديد للمفضلة"}
          </DialogTitle>
          <p className="text-sm text-cream/70">
            احفظ أطباقك المفضلة ووصولها إليك من أي جهاز — بدون أي رسوم.
          </p>
        </DialogHeader>

        <div className="flex rounded-xl border border-border bg-background p-1">
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
                setFieldErrors(null);
              }}
              className={cn(
                "flex-1 rounded-lg py-2 text-sm font-bold transition-all",
                mode === m
                  ? "bg-gradient-to-l from-gold to-[#a87a2b] text-background"
                  : "text-cream/60 hover:text-gold",
              )}
            >
              {m === "login" ? "دخول" : "حساب جديد"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="group relative">
            <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="بريدك الإلكتروني"
              className={cn(
                "h-11 w-full rounded-xl border border-input bg-background ps-10 pe-3 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
                fieldErrors?.email && "border-destructive",
              )}
            />
          </div>
          {fieldErrors?.email?.[0] && (
            <p className="text-xs font-medium text-destructive">{fieldErrors.email[0]}</p>
          )}

          <div className="group relative">
            <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "login" ? "كلمة المرور" : "كلمة مرور (8 أحرف فأكثر)"}
              className={cn(
                "h-11 w-full rounded-xl border border-input bg-background ps-10 pe-3 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
                fieldErrors?.password && "border-destructive",
              )}
            />
          </div>
          {fieldErrors?.password?.[0] && (
            <p className="text-xs font-medium text-destructive">{fieldErrors.password[0]}</p>
          )}

          {error && (
            <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] font-black text-background transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading
              ? "جارٍ المعالجة..."
              : mode === "login"
                ? "دخول"
                : "إنشاء الحساب"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
