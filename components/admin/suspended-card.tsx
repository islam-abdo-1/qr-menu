"use client";

import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";

export function SuspendedCard() {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await signOutAction();
    window.location.href = "/login";
  }

  return (
    <main className="texture-dots flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-3xl border border-border bg-card p-10 text-center shadow-elevated">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl font-bold text-gold-gradient">حسابك موقوف</h1>
        <p className="text-sm text-cream/75">
          لوحة الإدارة معطلة حاليًا — تواصل مع الإدارة لمعرفة التفاصيل. قائمتك العامة تبقى
          متاحة للعملاء.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] font-black text-background shadow-[0_12px_36px_-10px_rgba(212,168,83,0.55)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "جارٍ الخروج..." : "تسجيل الخروج"}
        </button>
      </div>
    </main>
  );
}