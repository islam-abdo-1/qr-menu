"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bike, Image as ImageIcon, Loader2, Save, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader } from "@/components/admin/image-uploader";
import { PwaSettingsShare } from "@/components/pwa/settings-share";
import { updateSettingsAction } from "@/lib/actions/settings";
import { cn } from "@/lib/utils";
import type { AdminSettings } from "./types";

type Props = {
  settings: AdminSettings;
  onSaved: () => void;
  dashboardUrl?: string;
};

const CURRENCIES = [
  { code: "EGP", label: "جنيه مصري (ج.م)" },
  { code: "SAR", label: "ريال سعودي (ر.س)" },
  { code: "AED", label: "درهم إماراتي (د.إ)" },
  { code: "KWD", label: "دينار كويتي (د.ك)" },
  { code: "QAR", label: "ريال قطري (ر.ق)" },
  { code: "BHD", label: "دينار بحريني (د.ب)" },
  { code: "OMR", label: "ريال عماني (ر.ع)" },
  { code: "JOD", label: "دينار أردني (د.أ)" },
  { code: "IQD", label: "دينار عراقي (د.ع)" },
  { code: "LBP", label: "ليرة لبنانية (ل.ل)" },
  { code: "SYP", label: "ليرة سورية (ل.س)" },
  { code: "LYD", label: "دينار ليبي (د.ل)" },
  { code: "TND", label: "دينار تونسي (د.ت)" },
  { code: "DZD", label: "دينار جزائري (د.ج)" },
  { code: "MAD", label: "درهم مغربي (د.م)" },
  { code: "SDG", label: "جنيه سوداني (ج.س)" },
  { code: "YER", label: "ريال يمني (ر.ي)" },
  { code: "SOS", label: "شلن صومالي (ش.ص)" },
  { code: "DJF", label: "فرنك جيبوتي (ف.ج)" },
  { code: "KMF", label: "فرنك قمري (ف.ق)" },
  { code: "MRU", label: "أوقية موريتانية (أ.م)" },
];

export function SettingsPanel({ settings, onSaved, dashboardUrl }: Props) {
  const [name, setName] = useState(settings.restaurantName);
  const [currency, setCurrency] = useState(settings.currency || "EGP");
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.logoUrl || null);
  const [logoMeta, setLogoMeta] = useState<{
    width: number;
    height: number;
    sizeKB: number;
  } | null>(
    settings.logoWidth && settings.logoHeight && settings.logoSizeKB
      ? {
          width: settings.logoWidth,
          height: settings.logoHeight,
          sizeKB: settings.logoSizeKB,
        }
      : null,
  );
  const [deliveryEnabled, setDeliveryEnabled] = useState(settings.deliveryEnabled);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await updateSettingsAction({
      restaurantName: name,
      currency,
      logoUrl,
      logoWidth: logoUrl ? (logoMeta?.width ?? null) : null,
      logoHeight: logoUrl ? (logoMeta?.height ?? null) : null,
      logoSizeKB: logoUrl ? (logoMeta?.sizeKB ?? null) : null,
      deliveryEnabled,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("تم حفظ الإعدادات — المنيو العام يتحدث الآن");
      onSaved();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <div className="flex items-center gap-2 border-b border-border bg-gradient-to-l from-primary/10 via-transparent to-gold/10 px-6 py-5">
        <Store className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-black">إعدادات المطعم</h2>
          <p className="text-sm text-muted-foreground">ظهور المنيو العام يعتمد على هذه البيانات.</p>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <form onSubmit={submit} className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="rest-name">اسم المطعم</Label>
            <input
              id="rest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              placeholder="مثال: مطعم أبو القوة"
            />
          </div>

          <div className="space-y-1.5">
            <Label>العملة</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* شعار المطعم */}
          <div className="space-y-2 rounded-2xl border border-gold/20 bg-gold/5 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 text-gold">
                <ImageIcon className="h-4 w-4" />
              </span>
              <div>
                <Label>شعار المطعم</Label>
                <p className="text-xs text-muted-foreground">
                  يظهر بإطار ذهبي أعلى المنيو العام وفي لوحة الإدارة وفي الأصناف التي بلا صور — صورة مربعة أو دائرية مثالية
                </p>
              </div>
            </div>
                        <ImageUploader
              kind="logo"
              value={logoUrl}
              onChange={(url, meta) => {
                setLogoUrl(url);
                setLogoMeta(url ? (meta ?? null) : null);
              }}
            />
          </div>

          {/* طلبات التوصيل */}
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold">
                <Bike className="h-4 w-4" />
              </span>
              <div>
                <Label>طلبات التوصيل</Label>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  عند التفعيل يستقبل موقعك طلبات التوصيل من الزبائن وتصل لشاشة الموظفين — عند
                  التعطيل يختفي خيار التوصيل من المنيو فورًا
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={deliveryEnabled}
              onClick={() => setDeliveryEnabled((v) => !v)}
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                deliveryEnabled ? "bg-gold" : "bg-border",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 h-5 w-5 rounded-full bg-background shadow transition-all",
                  deliveryEnabled ? "start-6" : "start-1",
                )}
              />
            </button>
          </div>

          <Button type="submit" disabled={saving} className="h-11 rounded-xl px-6">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ الإعدادات
          </Button>
        </form>
      </div>

      <div className="border-t border-border p-6 sm:p-8">
        {dashboardUrl ? <PwaSettingsShare dashboardUrl={dashboardUrl} /> : null}
      </div>
    </div>
  );
}