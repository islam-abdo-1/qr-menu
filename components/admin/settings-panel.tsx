"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, Save, Store } from "lucide-react";
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

export function SettingsPanel({ settings, onSaved }: Props) {
  const [name, setName] = useState(settings.restaurantName);
  const [currency, setCurrency] = useState(settings.currency || "EGP");
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.logoUrl || null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await updateSettingsAction({
      restaurantName: name,
      currency,
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