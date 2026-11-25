import "server-only";

import type { Locale } from "@/lib/i18n/config";
import { escapeHtml, type MailMessage } from "@/lib/mail";
import { formatAzerbaijaniPhone } from "@/lib/phone";
import {
  bookingLocaleLabels,
  bookingTimeWindowLabels,
  type BookingTimeWindow,
} from "@/lib/validation/booking-requests";

export type BookingRequestEmail = {
  id: string;
  name: string;
  phone: string;
  message: string | null;
  locale: Locale;
  preferredDate: string | null;
  timeWindow: BookingTimeWindow;
  masterName: string | null;
  services: string[];
};

export function formatBookingDate(value: string | null): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export function bookingRequestEmail(
  request: BookingRequestEmail,
  to: string,
  adminUrl: string,
): MailMessage {
  const url = `${adminUrl.replace(/\/$/, "")}/admin/bookings/${request.id}`;
  const details: [string, string | null][] = [
    ["Ad", request.name],
    ["Telefon", formatAzerbaijaniPhone(request.phone)],
    ["Tarix", formatBookingDate(request.preferredDate) ?? "Seçilməyib"],
    ["Vaxt", bookingTimeWindowLabels[request.timeWindow]],
    ["Usta", request.masterName ?? "Fərq etməz"],
    ["Dil", bookingLocaleLabels[request.locale]],
  ];
  const filled = details.filter((entry): entry is [string, string] => Boolean(entry[1]));

  const text = [
    "Saytdan yeni onlayn qeydiyyat gəlib.",
    "",
    ...filled.map(([label, value]) => `${label}: ${value}`),
    "",
    "Xidmətlər:",
    ...(request.services.length
      ? request.services.map((name) => `- ${name}`)
      : ["Xidmət seçilməyib."]),
    "",
    "Mesaj:",
    request.message ?? "Mesaj yazılmayıb.",
    "",
    `Qeydiyyata bax: ${url}`,
  ].join("\n");

  const rows = filled
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#767676">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const serviceList = request.services.length
    ? `<ul style="margin:0;padding-left:20px">${request.services.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul>`
    : `<p style="margin:0;color:#767676">Xidmət seçilməyib.</p>`;
  const message = request.message
    ? `<p style="margin:0;white-space:pre-line">${escapeHtml(request.message)}</p>`
    : `<p style="margin:0;color:#767676">Mesaj yazılmayıb.</p>`;

  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111111">
<p>Saytdan yeni onlayn qeydiyyat gəlib.</p>
<table style="border-collapse:collapse;font-size:15px">${rows}</table>
<p style="margin:16px 0 4px;color:#767676">Xidmətlər</p>
${serviceList}
<p style="margin:16px 0 4px;color:#767676">Mesaj</p>
${message}
<p style="margin-top:24px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 24px;border-radius:999px;background:#111111;color:#ffffff;text-decoration:none">Qeydiyyata bax</a></p>
</div>`;

  return { to, subject: `Yeni qeydiyyat: ${request.name}`, text, html };
}
