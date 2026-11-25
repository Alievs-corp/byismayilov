import "server-only";

import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type { Page } from "@/lib/api/types";
import { toCsv } from "@/lib/csv";
import { getDb } from "@/lib/db";
import { containsPattern } from "@/lib/db/like";
import { bookingRequestServices, bookingRequests, services } from "@/lib/db/schema";
import {
  bookingLocaleLabels,
  bookingStatusLabels,
  bookingTimeWindowLabels,
  type BookingRequestDetailDto,
  type BookingRequestFilters,
  type BookingRequestListArgs,
  type BookingRequestListItemDto,
  type BookingRequestSortField,
  type UpdateBookingRequestValues,
} from "@/lib/validation/booking-requests";

const serviceNames = sql<
  string[] | null
>`(select array_agg(brs.service_name order by brs.service_name)
  from booking_request_services brs where brs.booking_request_id = booking_requests.id)`;

const sortColumns: Record<BookingRequestSortField, SQL | AnyPgColumn> = {
  createdAt: bookingRequests.createdAt,
  name: sql`lower(${bookingRequests.name})`,
  status: bookingRequests.status,
  preferredDate: bookingRequests.preferredDate,
};

function phoneDigits(search: string): string | null {
  const digits = search.replace(/\D/g, "");
  if (digits.length < 3 || /[^\d\s+()-]/.test(search)) return null;
  return digits.replace(/^0/, "");
}

function listFilters(filters: BookingRequestFilters): SQL | undefined {
  const where: SQL[] = [];
  if (filters.status === "unread") where.push(isNull(bookingRequests.seenAt));
  else if (filters.status !== "all") where.push(eq(bookingRequests.status, filters.status));
  if (filters.from) where.push(gte(bookingRequests.preferredDate, filters.from));
  if (filters.to) where.push(lte(bookingRequests.preferredDate, filters.to));
  if (filters.search) {
    const pattern = containsPattern(filters.search);
    const digits = phoneDigits(filters.search);
    const match = or(
      ilike(bookingRequests.name, pattern),
      ilike(bookingRequests.phone, pattern),
      digits
        ? sql`regexp_replace(${bookingRequests.phone}, '\\D', '', 'g') like ${`%${digits}%`}`
        : undefined,
    );
    if (match) where.push(match);
  }
  return where.length ? and(...where) : undefined;
}

export async function listBookingRequests(
  args: BookingRequestListArgs,
): Promise<Page<BookingRequestListItemDto>> {
  const db = getDb();
  const where = listFilters({
    search: args.search,
    status: args.status ?? "all",
    from: args.from ?? "",
    to: args.to ?? "",
  });
  const direction = args.order === "asc" ? asc : desc;
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: bookingRequests.id,
        name: bookingRequests.name,
        phone: bookingRequests.phone,
        status: bookingRequests.status,
        locale: bookingRequests.locale,
        preferredDate: bookingRequests.preferredDate,
        timeWindow: bookingRequests.timeWindow,
        masterName: bookingRequests.masterName,
        seenAt: bookingRequests.seenAt,
        createdAt: bookingRequests.createdAt,
        services: serviceNames,
      })
      .from(bookingRequests)
      .where(where)
      .orderBy(
        sql`${direction(sortColumns[args.sort])} nulls last`,
        desc(bookingRequests.createdAt),
        asc(bookingRequests.id),
      )
      .limit(args.pageSize)
      .offset(args.page * args.pageSize),
    db.select({ value: count() }).from(bookingRequests).where(where),
  ]);
  return {
    rows: rows.map(({ seenAt, services: names, ...row }) => ({
      ...row,
      services: names ?? [],
      unread: seenAt === null,
      createdAt: row.createdAt.toISOString(),
    })),
    rowCount: total?.value ?? 0,
  };
}

export async function countUnreadBookings(): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(bookingRequests)
    .where(isNull(bookingRequests.seenAt));
  return row?.value ?? 0;
}

export async function getBookingRequest(
  id: string,
  options: { markSeen?: boolean } = {},
): Promise<BookingRequestDetailDto | null> {
  const db = getDb();
  const marked = options.markSeen
    ? await db
        .update(bookingRequests)
        .set({ seenAt: new Date() })
        .where(and(eq(bookingRequests.id, id), isNull(bookingRequests.seenAt)))
        .returning({ id: bookingRequests.id })
    : [];
  const [row] = await db.select().from(bookingRequests).where(eq(bookingRequests.id, id));
  if (!row) return null;

  const items = await db
    .select({
      id: bookingRequestServices.id,
      serviceId: bookingRequestServices.serviceId,
      name: bookingRequestServices.serviceName,
      deletedAt: services.deletedAt,
    })
    .from(bookingRequestServices)
    .leftJoin(services, eq(services.id, bookingRequestServices.serviceId))
    .where(eq(bookingRequestServices.bookingRequestId, id))
    .orderBy(asc(bookingRequestServices.serviceName));

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    status: row.status,
    locale: row.locale,
    preferredDate: row.preferredDate,
    timeWindow: row.timeWindow,
    masterId: row.masterId,
    masterName: row.masterName,
    message: row.message,
    adminNote: row.adminNote,
    unread: row.seenAt === null,
    seenAt: row.seenAt?.toISOString() ?? null,
    markedSeen: marked.length > 0,
    services: items.map((item) => ({
      id: item.id,
      serviceId: item.serviceId,
      name: item.name,
      inTrash: Boolean(item.deletedAt),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updateBookingRequest(
  id: string,
  values: UpdateBookingRequestValues,
): Promise<BookingRequestDetailDto | null> {
  const changes: Partial<typeof bookingRequests.$inferInsert> = {};
  if (values.status !== undefined) changes.status = values.status;
  if (values.adminNote !== undefined) changes.adminNote = values.adminNote;
  const updated = await getDb()
    .update(bookingRequests)
    .set({ ...changes, seenAt: sql`coalesce(${bookingRequests.seenAt}, now())` })
    .where(eq(bookingRequests.id, id))
    .returning({ id: bookingRequests.id });
  if (!updated.length) return null;
  return getBookingRequest(id);
}

export async function deleteBookingRequest(id: string): Promise<boolean> {
  const removed = await getDb()
    .delete(bookingRequests)
    .where(eq(bookingRequests.id, id))
    .returning({ id: bookingRequests.id });
  return removed.length > 0;
}

const exportDate = new Intl.DateTimeFormat("az", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Baku",
});

export const bookingRequestCsvHeaders = [
  "Göndərilib",
  "Ad",
  "Telefon",
  "Xidmətlər",
  "Usta",
  "İstədiyi tarix",
  "Vaxt",
  "Mesaj",
  "Status",
  "Dil",
  "Admin qeydi",
];

export async function exportBookingRequestsCsv(filters: BookingRequestFilters): Promise<string> {
  const rows = await getDb()
    .select({
      createdAt: bookingRequests.createdAt,
      name: bookingRequests.name,
      phone: bookingRequests.phone,
      services: serviceNames,
      masterName: bookingRequests.masterName,
      preferredDate: bookingRequests.preferredDate,
      timeWindow: bookingRequests.timeWindow,
      message: bookingRequests.message,
      status: bookingRequests.status,
      locale: bookingRequests.locale,
      adminNote: bookingRequests.adminNote,
    })
    .from(bookingRequests)
    .where(listFilters(filters))
    .orderBy(desc(bookingRequests.createdAt), asc(bookingRequests.id));

  return toCsv([
    bookingRequestCsvHeaders,
    ...rows.map((row) => [
      exportDate.format(row.createdAt),
      row.name,
      row.phone,
      (row.services ?? []).join(", "),
      row.masterName,
      row.preferredDate,
      bookingTimeWindowLabels[row.timeWindow],
      row.message,
      bookingStatusLabels[row.status],
      bookingLocaleLabels[row.locale],
      row.adminNote,
    ]),
  ]);
}

export function exportFileName(now = new Date()): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Baku",
  }).format(now);
  return `qeydiyyatlar-${day}.csv`;
}
