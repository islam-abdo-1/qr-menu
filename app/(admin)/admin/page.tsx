import { getAdminData } from "@/lib/data";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getAdminData();
  return <AdminShell data={data} />;
}