import type { Metadata } from "next";
import { Landing } from "@/components/public/landing";

export const metadata: Metadata = {
  title: "Digital menu for your restaurant — QR Menu",
  description: "Create an online menu with your own link — table QR codes, favorites and order intake",
};

export default function LandingEnPage() {
  return (
    <div dir="ltr" lang="en">
      <Landing lang="en" />
    </div>
  );
}
