import type { Metadata } from "next";

import { getAdminT } from "@/lib/admin/i18n/server";
import { requireAdminUser } from "@/lib/auth/session";

import { GalleryView } from "./gallery-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: t("İşlərimiz") };
}

export const instant = false;

export default async function GalleryPage() {
  await requireAdminUser();
  return <GalleryView />;
}
