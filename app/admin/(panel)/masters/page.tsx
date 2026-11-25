import type { Metadata } from "next";

import { getAdminT } from "@/lib/admin/i18n/server";
import { requireAdminUser } from "@/lib/auth/session";

import { MastersView } from "./masters-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: t("Ustalar") };
}

export const instant = false;

export default async function MastersPage() {
  await requireAdminUser();
  return <MastersView />;
}
