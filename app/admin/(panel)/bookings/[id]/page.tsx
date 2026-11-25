import type { Metadata } from "next";

import { getAdminT } from "@/lib/admin/i18n/server";
import { requireAdminUser } from "@/lib/auth/session";

import { BookingDetail } from "../booking-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: t("Qeydiyyat") };
}

export const instant = false;

export default async function BookingPage({ params }: PageProps<"/admin/bookings/[id]">) {
  const user = await requireAdminUser();
  const { id } = await params;
  return <BookingDetail id={id} role={user.role} />;
}
