import "server-only";

import { createHmac } from "node:crypto";

import { and, count, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { readSettingsRow } from "@/lib/admin/settings";
import { getDb } from "@/lib/db";
import { bookingRequestServices, bookingRequests, masters, services } from "@/lib/db/schema";
import { serverEnv } from "@/lib/env.server";
import { sendMail } from "@/lib/mail";
import { bookingRateLimit, type BookingSubmissionValues } from "@/lib/validation/booking-requests";

import { bookingRequestEmail } from "./email";

export function clientIp(headers: Headers): string | null {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || null;
}

export function hashClientIp(ip: string): string {
  return createHmac("sha256", serverEnv().BETTER_AUTH_SECRET).update(ip).digest("hex");
}

type Executor = Pick<ReturnType<typeof getDb>, "select">;

export async function recentBookingCount(
  ipHash: string,
  executor: Executor = getDb(),
): Promise<number> {
  const [row] = await executor
    .select({ value: count() })
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.ipHash, ipHash),
        gte(
          bookingRequests.createdAt,
          sql`now() - make_interval(mins => ${bookingRateLimit.windowMinutes})`,
        ),
      ),
    );
  return row?.value ?? 0;
}

type BookableService = { id: string; name: string };

async function bookableServices(ids: string[]): Promise<BookableService[] | null> {
  if (!ids.length) return [];
  const rows = await getDb()
    .select({ id: services.id, name: services.name })
    .from(services)
    .where(
      and(inArray(services.id, ids), eq(services.status, "published"), isNull(services.deletedAt)),
    );
  if (rows.length !== ids.length) return null;
  const byId = new Map(rows.map((row) => [row.id, row.name.az]));
  return ids.map((id) => ({ id, name: byId.get(id) ?? "" }));
}

async function bookableMaster(id: string | null): Promise<{ id: string; name: string } | null> {
  if (!id) return null;
  const [row] = await getDb()
    .select({ id: masters.id, name: masters.name })
    .from(masters)
    .where(and(eq(masters.id, id), eq(masters.isActive, true)));
  return row ? { id: row.id, name: row.name.az } : null;
}

export type SubmitResult =
  | { status: "created"; id: string }
  | { status: "rate-limited" }
  | { status: "invalid"; fields: Record<string, string> };

export async function submitBookingRequest(
  values: BookingSubmissionValues,
  ip: string | null,
): Promise<SubmitResult> {
  const [chosen, master] = await Promise.all([
    bookableServices(values.serviceIds),
    bookableMaster(values.masterId),
  ]);
  const fields: Record<string, string> = {};
  if (!chosen) fields.serviceIds = "Seçilən xidmət tapılmadı.";
  if (values.masterId && !master) fields.masterId = "Seçilən usta tapılmadı.";
  if (!chosen || Object.keys(fields).length) return { status: "invalid", fields };

  const ipHash = ip ? hashClientIp(ip) : null;
  const id = await getDb().transaction(async (tx) => {
    if (ipHash) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${ipHash}, 0))`);
      if ((await recentBookingCount(ipHash, tx)) >= bookingRateLimit.requests) return null;
    }
    const [row] = await tx
      .insert(bookingRequests)
      .values({
        name: values.name,
        phone: values.phone,
        masterId: master?.id ?? null,
        masterName: master?.name ?? null,
        preferredDate: values.preferredDate,
        timeWindow: values.timeWindow,
        message: values.message,
        locale: values.locale,
        ipHash,
      })
      .returning({ id: bookingRequests.id });
    if (!row) throw new Error("Booking request was not created");
    if (chosen.length) {
      await tx.insert(bookingRequestServices).values(
        chosen.map((service) => ({
          bookingRequestId: row.id,
          serviceId: service.id,
          serviceName: service.name,
        })),
      );
    }
    return row.id;
  });
  if (!id) return { status: "rate-limited" };

  try {
    const env = serverEnv();
    const settingsRow = await readSettingsRow();
    await sendMail(
      bookingRequestEmail(
        {
          id,
          name: values.name,
          phone: values.phone,
          message: values.message,
          locale: values.locale,
          preferredDate: values.preferredDate,
          timeWindow: values.timeWindow,
          masterName: master?.name ?? null,
          services: chosen.map((service) => service.name),
        },
        settingsRow?.bookingNotifyEmail ?? env.BOOKING_NOTIFY_EMAIL,
        env.BETTER_AUTH_URL,
      ),
    );
  } catch (error) {
    console.error(`Booking request ${id} was saved, but the notification email failed`, error);
  }

  return { status: "created", id };
}
