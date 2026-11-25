"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/admin/i18n/use-t";

const bookingStatus = {
  new: { label: "Yeni", variant: "default" },
  confirmed: { label: "Təsdiqlənib", variant: "accent" },
  done: { label: "Tamamlanıb", variant: "chip" },
  cancelled: { label: "Ləğv edilib", variant: "outline" },
} as const;

const publishStatus = {
  published: { label: "Dərc olunub", variant: "accent" },
  draft: { label: "Qaralama", variant: "outline" },
} as const;

export function BookingStatusBadge({ status }: { status: keyof typeof bookingStatus }) {
  const t = useT();
  const { label, variant } = bookingStatus[status];
  return <Badge variant={variant}>{t(label)}</Badge>;
}

export function PublishStatusBadge({ status }: { status: keyof typeof publishStatus }) {
  const t = useT();
  const { label, variant } = publishStatus[status];
  return <Badge variant={variant}>{t(label)}</Badge>;
}
