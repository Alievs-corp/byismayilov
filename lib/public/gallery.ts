import "server-only";

import { and, asc, eq, inArray, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { publicTags } from "@/lib/cache/tags";
import { getDb } from "@/lib/db";
import { galleryItems, media, serviceCategories } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import { pickExact, pickLocale } from "@/lib/i18n/localized";
import { routes } from "@/lib/routes";

import { visibleCategoryIds } from "./category-visibility";
import { toPublicImage, type PublicImage } from "./images";

export type PublicGalleryVideo = { src: string; type: string; poster: PublicImage | null };

export type PublicGalleryItem = {
  id: string;
  caption: string | null;
  image: PublicImage | null;
  video: PublicGalleryVideo | null;
  before: PublicImage | null;
  categoryId: string | null;
};

export type GalleryFilter = { id: string; name: string; slug: string };

export type PublicGallery = {
  items: PublicGalleryItem[];
  filters: GalleryFilter[];
  active: GalleryFilter | null;
};

async function galleryCategories(locale: Locale): Promise<(GalleryFilter & { used: boolean })[]> {
  const db = getDb();
  const [rows, used] = await Promise.all([
    db
      .select({
        id: serviceCategories.id,
        parentId: serviceCategories.parentId,
        isActive: serviceCategories.isActive,
        slug: serviceCategories.slug,
        name: serviceCategories.name,
      })
      .from(serviceCategories)
      .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.createdAt)),
    db
      .selectDistinct({ categoryId: galleryItems.categoryId })
      .from(galleryItems)
      .where(eq(galleryItems.isActive, true)),
  ]);
  const visible = visibleCategoryIds(rows);
  const usedIds = new Set(used.map((row) => row.categoryId));
  return rows
    .filter((row) => visible.has(row.id))
    .map((row) => ({
      id: row.id,
      name: pickLocale(row.name, locale),
      slug: pickLocale(row.slug, locale),
      used: usedIds.has(row.id),
    }));
}

export async function queryGallery(
  locale: Locale,
  categorySlug: string | null,
  limit?: number,
): Promise<PublicGallery> {
  const db = getDb();
  const categories = await galleryCategories(locale);
  const filters = categories
    .filter((category) => category.used)
    .map(({ id, name, slug }) => ({ id, name, slug }));
  const active = categorySlug
    ? (filters.find((filter) => filter.slug === categorySlug) ?? null)
    : null;
  const where: SQL[] = [eq(galleryItems.isActive, true)];
  if (active) where.push(eq(galleryItems.categoryId, active.id));
  const query = db
    .select()
    .from(galleryItems)
    .where(and(...where))
    .orderBy(asc(galleryItems.sortOrder), asc(galleryItems.createdAt), asc(galleryItems.id));
  const rows = limit ? await query.limit(limit) : await query;
  const mediaIds = rows.flatMap((row) =>
    [row.mediaId, row.beforeMediaId, row.posterId].filter((id): id is string => Boolean(id)),
  );
  const files = mediaIds.length
    ? await db.select().from(media).where(inArray(media.id, mediaIds))
    : [];
  const byId = new Map(files.map((file) => [file.id, file]));
  const items = rows.flatMap((row): PublicGalleryItem[] => {
    const file = byId.get(row.mediaId);
    if (!file) return [];
    const caption = pickExact(row.caption, locale) ?? pickExact(row.caption, "az");
    const isVideo = file.mimeType.startsWith("video/");
    const poster = row.posterId ? byId.get(row.posterId) : undefined;
    const before = row.beforeMediaId ? byId.get(row.beforeMediaId) : undefined;
    return [
      {
        id: row.id,
        caption,
        image: isVideo ? null : toPublicImage(file, locale, caption ?? ""),
        video: isVideo
          ? {
              src: routes.media(file.key),
              type: file.mimeType,
              poster: toPublicImage(poster, locale, caption ?? ""),
            }
          : null,
        before: toPublicImage(before, locale, caption ?? ""),
        categoryId: row.categoryId,
      },
    ];
  });
  return { items, filters, active };
}

export async function getGallery(
  locale: Locale,
  categorySlug: string | null,
): Promise<PublicGallery> {
  "use cache";
  cacheTag(publicTags.content, publicTags.catalog);
  cacheLife("hours");
  return queryGallery(locale, categorySlug);
}

export async function getGalleryPreview(locale: Locale): Promise<PublicGalleryItem[]> {
  "use cache";
  cacheTag(publicTags.content, publicTags.catalog);
  cacheLife("hours");
  return (await queryGallery(locale, null, 6)).items;
}
