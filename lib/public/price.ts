import type { ServicePriceKind } from "@/lib/db/schema/services";
import type { Locale } from "@/lib/i18n/config";
import { fill } from "@/lib/i18n/format";

export type ServicePrice = { kind: ServicePriceKind; amount: number | null };

export type PriceLabels = {
  priceFrom: string;
  priceExact: string;
  priceOnRequest: string;
  minutes: string;
};

const amountFormats = new Map<Locale, Intl.NumberFormat>();

export function formatAmount(amount: number, locale: Locale): string {
  let format = amountFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: true });
    amountFormats.set(locale, format);
  }
  return format.format(amount);
}

export function formatPrice(price: ServicePrice, locale: Locale, labels: PriceLabels): string {
  if (price.kind === "on_request" || price.amount === null) return labels.priceOnRequest;
  const amount = formatAmount(price.amount, locale);
  return fill(price.kind === "from" ? labels.priceFrom : labels.priceExact, { amount });
}

export function formatDuration(
  minutes: number | null,
  labels: Pick<PriceLabels, "minutes">,
): string | null {
  return minutes && minutes > 0 ? fill(labels.minutes, { count: minutes }) : null;
}
