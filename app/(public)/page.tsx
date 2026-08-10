import type { Metadata } from "next";
import { Landing } from "@/components/public/landing";

export const metadata: Metadata = {
  title: "منيو رقمي لمطعمك — QR Menu",
  description: "أنشئ قائمة طعام إلكترونية لمطعمك برابط خاص — QR للطاولات، تفضيلات، واستقبال طلبات",
};

export default function LandingPage() {
  return <Landing />;
}
