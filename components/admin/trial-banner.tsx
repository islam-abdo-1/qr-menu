import { Sparkles } from "lucide-react";
import { TRIAL_DAYS } from "@/lib/billing-constants";

export function TrialBanner({
  daysLeft,
  onOpenBilling,
}: {
  daysLeft: number;
  onOpenBilling: () => void;
}) {
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-gold/25 bg-gold/10 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Sparkles className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="text-sm font-black text-gold">
            أسبوعك المجاني — ينتهي بعد {daysLeft} {daysLeft === 1 ? "يوم" : "أيام"}
          </p>
          <p className="text-xs text-cream/65">
            أول {TRIAL_DAYS} أيام مجانية بالكامل — بعدها الاشتراك 250 ج.م شهريًا أو 2,300 ج.م سنويًا
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenBilling}
        className="shrink-0 rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] px-4 py-2 text-xs font-black text-background shadow-[0_8px_24px_-8px_rgba(212,168,83,0.5)] transition-all hover:brightness-110"
      >
        عرض الاشتراك
      </button>
    </div>
  );
}