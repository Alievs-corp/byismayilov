import type { Metadata } from "next";

import { getAdminT } from "@/lib/admin/i18n/server";
import { requireAdminUser } from "@/lib/auth/session";

import { ServiceEditor } from "../service-editor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: t("Xidmət") };
}

export const instant = false;

export default async function ServicePage({ params }: PageProps<"/admin/services/[id]">) {
  await requireAdminUser();
  const { id } = await params;
  return <ServiceEditor id={id} />;
}
