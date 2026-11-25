import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getMasterOptions } from "@/lib/public/masters";
import { getBookingOptions } from "@/lib/public/services";

import { BookingForm, type BookingFormLabels } from "./booking-form";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseIdList(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  return [...new Set(raw.split(",").map((id) => id.trim().toLowerCase()))]
    .filter((id) => uuidPattern.test(id))
    .slice(0, 10);
}

export function bookingLabels(dict: Dictionary): BookingFormLabels {
  const { booking } = dict;
  return {
    name: booking.name,
    phone: booking.phone,
    phoneHint: booking.phoneHint,
    services: booking.services,
    servicesHint: booking.servicesHint,
    noServices: booking.noServices,
    master: booking.master,
    anyMaster: booking.anyMaster,
    date: booking.date,
    time: booking.time,
    timeAny: booking.timeAny,
    timeMorning: booking.timeMorning,
    timeAfternoon: booking.timeAfternoon,
    timeEvening: booking.timeEvening,
    message: booking.message,
    messagePlaceholder: booking.messagePlaceholder,
    submit: booking.submit,
    sending: booking.sending,
    required: booking.required,
    requiredNote: booking.requiredNote,
    errorName: booking.errorName,
    errorPhone: booking.errorPhone,
    errorDate: booking.errorDate,
    errorServices: booking.errorServices,
    errorTooLong: booking.errorTooLong,
    errorGeneric: booking.errorGeneric,
    errorRateLimit: booking.errorRateLimit,
    successTitle: booking.successTitle,
    successBody: booking.successBody,
    again: booking.again,
    honeypot: booking.honeypot,
    formLabel: booking.formLabel,
  };
}

export async function BookingPanel({
  locale,
  dict,
  serviceIds = [],
  masterId = null,
}: {
  locale: Locale;
  dict: Dictionary;
  serviceIds?: string[];
  masterId?: string | null;
}) {
  const [groups, masters] = await Promise.all([
    getBookingOptions(locale),
    getMasterOptions(locale),
  ]);
  const known = new Set(groups.flatMap((group) => group.services.map((service) => service.id)));
  return (
    <BookingForm
      locale={locale}
      labels={bookingLabels(dict)}
      groups={groups}
      masters={masters}
      initialServiceIds={serviceIds.filter((id) => known.has(id))}
      initialMasterId={masterId && masters.some((master) => master.id === masterId) ? masterId : ""}
      minDate={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(new Date())}
    />
  );
}
