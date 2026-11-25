"use client";

import { ArrowLeft } from "lucide-react";

import { useT } from "@/lib/admin/i18n/use-t";
import { localePath } from "@/lib/i18n/config";

export function BackToSite() {
  const t = useT();
  return (
    <a
      href={localePath(t.locale)}
      data-back-to-site=""
      className="inline-flex min-h-11 items-center gap-2 text-meta text-graphite underline-offset-4 hover:underline"
    >
      <ArrowLeft className="size-4" strokeWidth={1.5} />
      {t("Ana səhifəyə qayıt")}
    </a>
  );
}
