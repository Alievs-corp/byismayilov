import { integer, pgTable, text } from "drizzle-orm/pg-core";

import { id, localized, timestamps } from "./columns";

export const media = pgTable("media", {
  id: id(),
  key: text("key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  alt: localized("alt"),
  caption: localized("caption"),
  lqip: text("lqip"),
  ...timestamps,
});
