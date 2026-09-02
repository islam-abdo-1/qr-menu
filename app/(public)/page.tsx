import type { Metadata } from "next";
import { Landing } from "@/components/public/landing";

export const metadata: Metadata = {
  title: "منيو رقمي لمطعمك — QR Menu",
  description: "أنشئ قائمة طعام إلكترونية لمطعمك برابط خاص — QR للطاولات، تفضيلات، واستقبال طلبات",
};

// SEC-004: العرض التجريبي العام جزء من المنتج — الزر ظاهر دائمًا ويقود إلى
// مستأجر معزول (slug demo) قراءة فقط، بلا أي صلاحية تشغيلية (لا DEMO_MODE يخفي الزر).
export default function LandingPage() {
  return <Landing />;
}