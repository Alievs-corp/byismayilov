import { z } from "zod";

import "./locale";

import { locales, type Locale } from "@/lib/i18n/config";
import { normalizeAzerbaijaniPhone } from "@/lib/phone";

import { bookingHoneypotField } from "./booking-honeypot";
import {
  bookingStatuses,
  bookingTimeWindows,
  type BookingStatus,
  type BookingTimeWindow,
} from "./booking-values";
import { optionalText, uuid } from "./fields";
import { listQuerySchema, type ListArgs } from "./list";

export { bookingHoneypotField, bookingStatuses, bookingTimeWindows };
export type { BookingStatus, BookingTimeWindow };

export const bookingStatusLabels: Record<BookingStatus, string> = {
  new: "Yeni",
  confirmed: "Təsdiqlənib",
  done: "Tamamlanıb",
  cancelled: "Ləğv edilib",
};

export const bookingTimeWindowLabels: Record<BookingTimeWindow, string> = {
  any: "Fərq etməz",
  morning: "Səhər",
  afternoon: "Günorta",
  evening: "Axşam",
};

export const bookingLocaleLabels: Record<Locale, string> = {
  az: "Azərbaycanca",
  ru: "Rusca",
  en: "İngiliscə",
};

export const bookingRateLimit = { requests: 5, windowMinutes: 60 } as const;

export const bookingLimits = { services: 10, message: 2000, dateDaysAhead: 365 } as const;

export const azerbaijaniMobileOrLandlinePhone = z
  .string("Telefon nömrəsini yazın.")
  .trim()
  .min(1, "Telefon nömrəsini yazın.")
  .max(32, "Telefon nömrəsi düzgün deyil.")
  .transform((value, context) => {
    const normalized = normalizeAzerbaijaniPhone(value);
    if (!normalized) {
      context.addIssue({
        code: "custom",
        message: "Nömrəni +994 XX XXX XX XX və ya 0XX XXX XX XX şəklində yazın.",
      });
      return z.NEVER;
    }
    return normalized;
  });

export const optionalEmail = optionalText(254).pipe(
  z.email("E-poçt ünvanı düzgün deyil.").toLowerCase().nullable(),
);

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function bakuToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(now);
}

export function isBookableDate(value: string, now = new Date()): boolean {
  if (!isoDate.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const today = new Date(`${bakuToday(now)}T00:00:00Z`);
  const last = new Date(today.getTime() + bookingLimits.dateDaysAhead * 24 * 60 * 60 * 1000);
  return date >= today && date <= last;
}

export const preferredDateSchema = z
  .string()
  .trim()
  .nullish()
  .transform((value, context) => {
    if (!value) return null;
    if (!isBookableDate(value)) {
      context.addIssue({ code: "custom", message: "Bu gündən sonrakı bir tarix seçin." });
      return z.NEVER;
    }
    return value;
  });

export const bookingSubmissionSchema = z.object({
  name: z
    .string("Adınızı yazın.")
    .trim()
    .min(2, "Ad ən azı 2 simvol olmalıdır.")
    .max(120, "Ad ən çox 120 simvol ola bilər.")
    .transform((value) => value.replace(/\s+/g, " ")),
  phone: azerbaijaniMobileOrLandlinePhone,
  serviceIds: z
    .array(uuid("Xidmət düzgün deyil."))
    .max(bookingLimits.services, `Ən çox ${bookingLimits.services} xidmət seçmək olar.`)
    .optional()
    .default([])
    .transform((ids) => [...new Set(ids)]),
  masterId: z
    .union([z.literal(""), uuid("Usta düzgün deyil.")])
    .nullish()
    .transform((value) => value || null),
  preferredDate: preferredDateSchema,
  timeWindow: z.enum(bookingTimeWindows, "Vaxtı seçin.").optional().default("any"),
  message: optionalText(bookingLimits.message),
  locale: z.enum(locales, "Dil düzgün deyil.").optional().default("az"),
  [bookingHoneypotField]: z.string().max(500).nullish(),
});

export type BookingSubmissionInput = z.input<typeof bookingSubmissionSchema>;

export type BookingSubmissionValues = z.output<typeof bookingSubmissionSchema>;

export const bookingRequestSortFields = ["createdAt", "name", "status", "preferredDate"] as const;

export type BookingRequestSortField = (typeof bookingRequestSortFields)[number];

export const bookingRequestStatusFilters = ["all", "unread", ...bookingStatuses] as const;

export type BookingRequestStatusFilter = (typeof bookingRequestStatusFilters)[number];

const optionalFilterDate = z
  .union([z.literal(""), z.string().regex(isoDate, "Tarix düzgün deyil.")])
  .optional()
  .default("");

export const bookingRequestFiltersSchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  status: z.enum(bookingRequestStatusFilters).optional().default("all"),
  from: optionalFilterDate,
  to: optionalFilterDate,
});

export const bookingRequestListQuery = listQuerySchema(bookingRequestSortFields).extend({
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  status: z.enum(bookingRequestStatusFilters).optional().default("all"),
  from: optionalFilterDate,
  to: optionalFilterDate,
});

export type BookingRequestListArgs = ListArgs<BookingRequestSortField> & {
  status?: BookingRequestStatusFilter;
  from?: string;
  to?: string;
};

export type BookingRequestFilters = z.output<typeof bookingRequestFiltersSchema>;

export const updateBookingRequestSchema = z
  .object({
    status: z.enum(bookingStatuses, "Status seçin.").optional(),
    adminNote: z
      .string()
      .trim()
      .max(5000, "Ən çox 5000 simvol ola bilər.")
      .nullable()
      .optional()
      .transform((value) => (value === undefined ? undefined : value || null)),
  })
  .refine((value) => value.status !== undefined || value.adminNote !== undefined, {
    message: "Dəyişiklik yoxdur.",
  });

export type UpdateBookingRequestInput = z.input<typeof updateBookingRequestSchema>;

export type UpdateBookingRequestValues = z.output<typeof updateBookingRequestSchema>;

export type BookingRequestListItemDto = {
  id: string;
  name: string;
  phone: string;
  status: BookingStatus;
  locale: Locale;
  preferredDate: string | null;
  timeWindow: BookingTimeWindow;
  masterName: string | null;
  services: string[];
  unread: boolean;
  createdAt: string;
};

export type BookingRequestServiceDto = {
  id: string;
  serviceId: string | null;
  name: string;
  inTrash: boolean;
};

export type BookingRequestDetailDto = Omit<BookingRequestListItemDto, "services"> & {
  masterId: string | null;
  message: string | null;
  adminNote: string | null;
  services: BookingRequestServiceDto[];
  seenAt: string | null;
  markedSeen: boolean;
  updatedAt: string;
};
