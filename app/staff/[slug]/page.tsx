import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StaffShell } from "@/components/staff/staff-shell";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { slug },
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { name: true },
  });
  return {
    title: restaurant ? `${restaurant.name} — شاشة الموظفين` : "شاشة الموظفين — QR Menu",
  };
}

export default async function StaffRestaurantPage({
  params: { slug },
}: {
  params: { slug: string };
}) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { name: true, staffPin: true },
  });
  if (!restaurant) notFound();
  return <StaffShell slug={slug} />;
}
