import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import type { DomainError } from "@/lib/api/server";
import { getDb } from "@/lib/db";
import { galleryItems, masters, serviceCategories } from "@/lib/db/schema";
import { mediaKindOf } from "@/lib/validation/media";
import type {
  GalleryItemDto,
  GalleryItemValues,
  GalleryOptionsDto,
} from "@/lib/validation/gallery";

import { checkImage, invalidField } from "./content";
import { findMedia, findMediaByIds, toMediaDto } from "./media";
import { nextSortOrder } from "./ordering";

const missing: DomainError = { status: 404, message: "İş tapılmadı." };

export async function listGalleryItems(): Promise<GalleryItemDto[]> {
  const db = getDb();
  const rows = await db
    .select({
      item: galleryItems,
      categoryName: serviceCategories.name,
      masterName: masters.name,
    })
    .from(galleryItems)
    .leftJoin(serviceCategories, eq(serviceCategories.id, galleryItems.categoryId))
    .leftJoin(masters, eq(masters.id, galleryItems.masterId))
    .orderBy(asc(galleryItems.sortOrder), asc(galleryItems.createdAt));
  const mediaIds = rows.flatMap(({ item }) =>
    [item.mediaId, item.beforeMediaId, item.posterId].filter((id) => id !== null),
  );
  const files = mediaIds.length ? await findMediaByIds([...new Set(mediaIds)]) : [];
  const byId = new Map(files.map((file) => [file.id, toMediaDto(file)]));
  const pick = (id: string | null) => (id ? (byId.get(id) ?? null) : null);
  return rows.map(({ item, categoryName, masterName }) => ({
    id: item.id,
    media: pick(item.mediaId),
    before: pick(item.beforeMediaId),
    poster: pick(item.posterId),
    caption: item.caption,
    categoryId: item.categoryId,
    categoryName,
    masterId: item.masterId,
    masterName,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
  }));
}

async function checkGalleryItem(values: GalleryItemValues): Promise<DomainError | null> {
  const file = await findMedia(values.mediaId);
  const kind = file ? mediaKindOf(file.mimeType) : null;
  if (!file || (kind !== "image" && kind !== "video" && file.mimeType !== "image/svg+xml")) {
    return invalidField("mediaId", "Şəkil və ya video tapılmadı.");
  }
  const beforeError = await checkImage("beforeMediaId", values.beforeMediaId);
  if (beforeError) return beforeError;
  if (values.beforeMediaId && kind === "video") {
    return invalidField("beforeMediaId", "«Əvvəl» şəkli yalnız şəkil üçün əlavə olunur.");
  }
  const posterError = await checkImage("posterId", values.posterId);
  if (posterError) return posterError;
  const db = getDb();
  if (values.categoryId) {
    const found = await db
      .select({ id: serviceCategories.id })
      .from(serviceCategories)
      .where(inArray(serviceCategories.id, [values.categoryId]));
    if (!found.length) return invalidField("categoryId", "Kateqoriya tapılmadı.");
  }
  if (values.masterId) {
    const found = await db
      .select({ id: masters.id })
      .from(masters)
      .where(eq(masters.id, values.masterId));
    if (!found.length) return invalidField("masterId", "Usta tapılmadı.");
  }
  return null;
}

export async function createGalleryItem(
  values: GalleryItemValues,
): Promise<{ id: string } | { error: DomainError }> {
  const error = await checkGalleryItem(values);
  if (error) return { error };
  const [row] = await getDb()
    .insert(galleryItems)
    .values({ ...values, sortOrder: nextSortOrder(galleryItems) })
    .returning({ id: galleryItems.id });
  if (!row) throw new Error("Gallery item was not created");
  return { id: row.id };
}

export async function updateGalleryItem(
  id: string,
  values: GalleryItemValues,
): Promise<{ id: string } | { error: DomainError }> {
  const error = await checkGalleryItem(values);
  if (error) return { error };
  const updated = await getDb()
    .update(galleryItems)
    .set(values)
    .where(eq(galleryItems.id, id))
    .returning({ id: galleryItems.id });
  return updated.length ? { id } : { error: missing };
}

export async function listGalleryOptions(): Promise<GalleryOptionsDto> {
  const db = getDb();
  const [categoryRows, masterRows] = await Promise.all([
    db
      .select({
        id: serviceCategories.id,
        name: serviceCategories.name,
        parentId: serviceCategories.parentId,
      })
      .from(serviceCategories)
      .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.createdAt)),
    db
      .select({ id: masters.id, name: masters.name })
      .from(masters)
      .orderBy(asc(masters.sortOrder), asc(masters.createdAt)),
  ]);
  return {
    categories: categoryRows.map((row) => ({
      id: row.id,
      name: row.name.az,
      parentId: row.parentId,
    })),
    masters: masterRows.map((row) => ({ id: row.id, name: row.name.az })),
  };
}
