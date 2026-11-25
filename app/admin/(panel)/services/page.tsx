import type { Metadata } from "next";

import { getAdminT } from "@/lib/admin/i18n/server";
import { requireAdminUser } from "@/lib/auth/session";

import { ServicesView } from "./services-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: t("Xidmətlər") };
}

export const instant = false;

export default async function ServicesPage() {
  const user = await requireAdminUser();
  return <ServicesView role={user.role} />;
}
