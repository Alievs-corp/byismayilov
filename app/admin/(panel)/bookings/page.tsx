import type { Metadata } from "next";

import { getAdminT } from "@/lib/admin/i18n/server";
import { requireAdminUser } from "@/lib/auth/session";

import { BookingsView } from "./bookings-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: t("Qeydiyyatlar") };
}

export const instant = false;

export default async function BookingsPage() {
  const user = await requireAdminUser();
  return <BookingsView role={user.role} />;
}
