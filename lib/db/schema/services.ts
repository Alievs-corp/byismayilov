import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import {
  id,
  localized,
  localizedRichText,
  publishStatus,
  slugIndexes,
  timestamps,
} from "./columns";
import { media } from "./media";

export const servicePriceKinds = ["from", "exact", "on_request"] as const;

export type ServicePriceKind = (typeof servicePriceKinds)[number];

export const servicePriceKind = pgEnum("service_price_kind", servicePriceKinds);

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: id(),
    parentId: uuid("parent_id").references((): AnyPgColumn => serviceCategories.id, {
      onDelete: "restrict",
    }),
    slug: localized("slug").notNull(),
    name: localized("name").notNull(),
    description: localizedRichText("description"),
    imageId: uuid("image_id").references(() => media.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    seoTitle: localized("seo_title"),
    seoDescription: localized("seo_description"),
    ...timestamps,
  },
  (t) => [
    index("service_categories_parent_id_idx").on(t.parentId),
    ...slugIndexes("service_categories", t.slug),
  ],
);

export const services = pgTable(
  "services",
  {
    id: id(),
    slug: localized("slug").notNull(),
    name: localized("name").notNull(),
    shortDescription: localizedRichText("short_description"),
    description: localizedRichText("description"),
    priceKind: servicePriceKind("price_kind").notNull().default("on_request"),
    priceAmount: numeric("price_amount", { precision: 10, scale: 2, mode: "number" }),
    durationMinutes: integer("duration_minutes"),
    status: publishStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredPosition: integer("featured_position"),
    seoTitle: localized("seo_title"),
    seoDescription: localized("seo_description"),
    ...timestamps,
  },
  (t) => [
    index("services_status_idx").on(t.status),
    index("services_deleted_at_idx").on(t.deletedAt),
    ...slugIndexes("services", t.slug),
    check(
      "services_price_amount",
      sql`(${t.priceKind} = 'on_request' and ${t.priceAmount} is null)
        or (${t.priceKind} <> 'on_request' and ${t.priceAmount} is not null and ${t.priceAmount} >= 0)`,
    ),
    check(
      "services_duration_minutes",
      sql`${t.durationMinutes} is null or ${t.durationMinutes} > 0`,
    ),
  ],
);

export const serviceCategoryLinks = pgTable(
  "service_category_links",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => serviceCategories.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.serviceId, t.categoryId] }),
    index("service_category_links_category_id_idx").on(t.categoryId),
  ],
);

export const serviceImages = pgTable(
  "service_images",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.serviceId, t.mediaId] }),
    index("service_images_media_id_idx").on(t.mediaId),
  ],
);
