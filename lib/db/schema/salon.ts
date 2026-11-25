import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { id, localized, timestamps } from "./columns";
import { media } from "./media";
import { serviceCategories, services } from "./services";

export const masters = pgTable(
  "masters",
  {
    id: id(),
    name: localized("name").notNull(),
    role: localized("role").notNull(),
    bio: localized("bio"),
    photoId: uuid("photo_id").references(() => media.id, { onDelete: "set null" }),
    instagramUrl: text("instagram_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("masters_order_idx").on(t.isActive, t.sortOrder)],
);

export const masterServices = pgTable(
  "master_services",
  {
    masterId: uuid("master_id")
      .notNull()
      .references(() => masters.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.masterId, t.serviceId] }),
    index("master_services_service_id_idx").on(t.serviceId),
  ],
);

export const galleryItems = pgTable(
  "gallery_items",
  {
    id: id(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
    beforeMediaId: uuid("before_media_id").references(() => media.id, { onDelete: "set null" }),
    posterId: uuid("poster_id").references(() => media.id, { onDelete: "set null" }),
    caption: localized("caption"),
    categoryId: uuid("category_id").references(() => serviceCategories.id, {
      onDelete: "set null",
    }),
    masterId: uuid("master_id").references(() => masters.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("gallery_items_order_idx").on(t.isActive, t.sortOrder),
    index("gallery_items_category_id_idx").on(t.categoryId),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    rating: smallint("rating"),
    photoId: uuid("photo_id").references(() => media.id, { onDelete: "set null" }),
    sourceUrl: text("source_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("reviews_order_idx").on(t.isActive, t.sortOrder),
    check("reviews_rating", sql`${t.rating} is null or ${t.rating} between 1 and 5`),
  ],
);
