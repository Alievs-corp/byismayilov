import "server-only";

import { count, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  bookingRequests,
  galleryItems,
  masters,
  pages,
  posts,
  serviceCategories,
  services,
} from "@/lib/db/schema";
import { countVisitors, type VisitorCounts } from "@/lib/visits";

const week = 7 * 24 * 60 * 60 * 1000;

export type DashboardSummary = {
  visitors: VisitorCounts;
  newBookingsThisWeek: number;
  unreadBookings: number;
  services: { total: number; published: number; draft: number };
  categories: number;
  masters: number;
  galleryItems: number;
  publishedPosts: number;
  drafts: number;
  latestBookings: {
    id: string;
    name: string;
    phone: string;
    preferredDate: string | null;
    status: (typeof bookingRequests.$inferSelect)["status"];
    unread: boolean;
    serviceCount: number;
    createdAt: Date;
  }[];
};

const bookingServiceCount = sql<number>`(select count(*)::int
  from booking_request_services brs where brs.booking_request_id = booking_requests.id)`;

export async function getDashboardSummary(now = new Date()): Promise<DashboardSummary> {
  const db = getDb();
  const since = new Date(now.getTime() - week);

  const [
    [thisWeek],
    [unread],
    serviceRows,
    [categoryTotal],
    [masterTotal],
    [galleryTotal],
    postRows,
    [pageDrafts],
    latestBookings,
    visitors,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(bookingRequests)
      .where(gte(bookingRequests.createdAt, since)),
    db.select({ value: count() }).from(bookingRequests).where(isNull(bookingRequests.seenAt)),
    db
      .select({ status: services.status, value: count() })
      .from(services)
      .where(isNull(services.deletedAt))
      .groupBy(services.status),
    db.select({ value: count() }).from(serviceCategories),
    db.select({ value: count() }).from(masters).where(eq(masters.isActive, true)),
    db.select({ value: count() }).from(galleryItems).where(eq(galleryItems.isActive, true)),
    db.select({ status: posts.status, value: count() }).from(posts).groupBy(posts.status),
    db.select({ value: count() }).from(pages).where(eq(pages.status, "draft")),
    db
      .select({
        id: bookingRequests.id,
        name: bookingRequests.name,
        phone: bookingRequests.phone,
        preferredDate: bookingRequests.preferredDate,
        status: bookingRequests.status,
        seenAt: bookingRequests.seenAt,
        createdAt: bookingRequests.createdAt,
        serviceCount: bookingServiceCount,
      })
      .from(bookingRequests)
      .orderBy(desc(bookingRequests.createdAt))
      .limit(5),
    countVisitors(now),
  ]);

  const published = serviceRows.find((row) => row.status === "published")?.value ?? 0;
  const serviceDrafts = serviceRows.find((row) => row.status === "draft")?.value ?? 0;
  const publishedPosts = postRows.find((row) => row.status === "published")?.value ?? 0;
  const postDrafts = postRows.find((row) => row.status === "draft")?.value ?? 0;

  return {
    visitors,
    newBookingsThisWeek: thisWeek?.value ?? 0,
    unreadBookings: unread?.value ?? 0,
    services: { total: published + serviceDrafts, published, draft: serviceDrafts },
    categories: categoryTotal?.value ?? 0,
    masters: masterTotal?.value ?? 0,
    galleryItems: galleryTotal?.value ?? 0,
    publishedPosts,
    drafts: serviceDrafts + (pageDrafts?.value ?? 0) + postDrafts,
    latestBookings: latestBookings.map(({ seenAt, ...row }) => ({
      ...row,
      serviceCount: Number(row.serviceCount),
      unread: seenAt === null,
    })),
  };
}

export async function countUnreadBookings(): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(bookingRequests)
    .where(isNull(bookingRequests.seenAt));
  return row?.value ?? 0;
}
