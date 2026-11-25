import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { PublicShell } from "@/components/site/public-shell";
import { defaultLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

import "../site.css";

export const instant = false;

export const metadata: Metadata = {
  title: "Design kit",
  robots: { index: false, follow: false },
};

export default async function KitLayout({ children }: { children: ReactNode }) {
  await connection();
  const dict = await getDictionary(defaultLocale);
  return (
    <PublicShell locale={defaultLocale} dict={dict}>
      {children}
    </PublicShell>
  );
}
