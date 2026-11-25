import {
  date,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import {
  bookingStatuses,
  bookingTimeWindows,
  type BookingStatus,
  type BookingTimeWindow,
} from "../../validation/booking-values";
import { contentLocale, id, timestamps } from "./columns";
import { masters } from "./salon";
import { services } from "./services";

export const bookingStatus = pgEnum("booking_status", bookingStatuses);

export const bookingTimeWindow = pgEnum("booking_time_window", bookingTimeWindows);

export { bookingStatuses, bookingTimeWindows, type BookingStatus, type BookingTimeWindow };

export const bookingRequests = pgTable(
  "booking_requests",
  {
    id: id(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    masterId: uuid("master_id").references(() => masters.id, { onDelete: "set null" }),
    masterName: text("master_name"),
    preferredDate: date("preferred_date", { mode: "string" }),
    timeWindow: bookingTimeWindow("time_window").notNull().default("any"),
    message: text("message"),
    status: bookingStatus("status").notNull().default("new"),
    locale: contentLocale("locale").notNull().default("az"),
    adminNote: text("admin_note"),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    ipHash: text("ip_hash"),
    ...timestamps,
  },
  (t) => [
    index("booking_requests_status_idx").on(t.status, t.createdAt),
    index("booking_requests_seen_at_idx").on(t.seenAt),
    index("booking_requests_ip_hash_idx").on(t.ipHash, t.createdAt),
  ],
);

export const bookingRequestServices = pgTable(
  "booking_request_services",
  {
    id: id(),
    bookingRequestId: uuid("booking_request_id").notNull(),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    serviceName: text("service_name").notNull(),
  },
  (t) => [
    index("booking_request_services_request_idx").on(t.bookingRequestId),
    foreignKey({
      name: "booking_request_services_request_fk",
      columns: [t.bookingRequestId],
      foreignColumns: [bookingRequests.id],
    }).onDelete("cascade"),
  ],
);
