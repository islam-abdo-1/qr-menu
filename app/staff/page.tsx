import type { Metadata } from "next";
import { StaffShell } from "@/components/staff/staff-shell";

export const metadata: Metadata = {
  title: "شاشة الموظفين — QR Menu",
};

export const dynamic = "force-dynamic";

export default function StaffPage() {
  return <StaffShell />;
}
