"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Image as ImageIcon, Loader2, Palette, Save } from "lucide-react";
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
import { updateSettingsAction } from "@/lib/actions/settings";
import { cn } from "@/lib/utils";
import type { AdminSettings } from "./types";

type Props = {
  settings: AdminSettings;
  onSaved: () => void;
};

const CURRENCIES = [
  { code: "EGP", label: "جنيه مصري (ج.م)" },
  { code: "USD", label: "دولار ($)" },
  { code: "SAR", label: "ريال سعودي (ر.س)" },
  { code: "AED", label: "درهم إماراتي (د.إ)" },
];

const COLOR_PRESETS = [
  { name: "ذهبي فاخر", value: "#D4A853" },
  { name: "طوبة القاهرة", value: "#C84C21" },
  { name: "زيتوني فاخر", value: "#5C6B3C" },
  { name: "أزرق ليلي", value: "#1F4E5F" },
  { name: "باذنجاني", value: "#5B2A48" },
  { name: "بحر عميق", value: "#14457B" },
  { name: "كهرماني", value: "#B85C14" },
];

export function SettingsPanel({ settings, onSaved }: Props) {
  const [name, setName] = useState(settings.restaurantName);
  const [currency, setCurrency] = useState(settings.currency || "EGP");
  const [themePrimary, setThemePrimary] = useState(settings.themePrimary || "#C84C21");
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.logoUrl || null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await updateSettingsAction({
      restaurantName: name,
      currency,
      themePrimary,
      logoUrl,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("تم حفظ الإعدادات — المنيو العام يتحدث الآن");
      onSaved();
    } else {
      toast.error(res.error);
    }
  }

  const hexValid = /^#[0-9a-fA-F]{6}$/.test(themePrimary);

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <div className="flex items-center gap-2 border-b border-border bg-gradient-to-l from-primary/10 via-transparent to-gold/10 px-6 py-5">
        <Palette className="h-5 w-5 text-primary" />
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

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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

            <div className="space-y-1.5">
              <Label htmlFor="theme-color">اللون الأساسي (ثيم القاهرة)</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={hexValid ? themePrimary : "#C84C21"}
                  onChange={(e) => setThemePrimary(e.target.value)}
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-input bg-background p-1"
                  aria-label="اختر اللون"
                />
                <input
                  id="theme-color"
                  dir="ltr"
                  value={themePrimary}
                  onChange={(e) => setThemePrimary(e.target.value)}
                  maxLength={7}
                  className={cn(
                    "h-11 w-full rounded-xl border border-input bg-background px-3 text-end text-sm font-mono outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
                    !hexValid && "border-destructive",
                  )}
                  placeholder="#C84C21"
                />
              </div>
              {!hexValid && (
                <p className="text-xs font-medium text-destructive">صيغة اللون غير صالحة</p>
              )}
            </div>
          </div>

          {/* ألوان جاهزة */}
          <div className="space-y-2">
            <Label>ألوان جاهزة</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((p) => {
                const isActive = hexValid && themePrimary.toUpperCase() === p.value.toUpperCase();
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setThemePrimary(p.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all hover:scale-105",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                    title={p.name}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/10"
                      style={{ background: p.value }}
                    />
                    {p.name}
                    {isActive && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
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
                  يظهر بإطار ذهبي أعلى المنيو العام وفي لوحة الإدارة — صورة مربعة أو دائرية مثالية
                </p>
              </div>
            </div>
            <ImageUploader kind="logo" value={logoUrl} onChange={setLogoUrl} />
          </div>

          <Button type="submit" disabled={saving} className="h-11 rounded-xl px-6">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ الإعدادات
          </Button>
        </form>
      </div>
    </div>
  );
}