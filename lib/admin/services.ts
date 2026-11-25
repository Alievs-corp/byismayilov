import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type { DomainError } from "@/lib/api/server";
import type { Page } from "@/lib/api/types";
import { getDb } from "@/lib/db";
import { uniqueViolation } from "@/lib/db/errors";
import { containsPattern } from "@/lib/db/like";
import {
  media,
  serviceCategories,
  serviceCategoryLinks,
  serviceImages,
  services,
} from "@/lib/db/schema";
import { localeKey } from "@/lib/db/schema/columns";
import { locales, type Locale } from "@/lib/i18n/config";
import type { Localized } from "@/lib/i18n/localized";
import { routes } from "@/lib/routes";
import { mediaKindOf } from "@/lib/validation/media";
import type {
  BulkServicesInput,
  BulkServicesResult,
  ServiceDetailDto,
  ServiceListArgs,
  ServiceListItemDto,
  ServiceOptionDto,
  ServiceSortField,
  ServiceValues,
} from "@/lib/validation/services";

import { findMediaByIds, toMediaDto } from "./media";
import { freeSlug } from "./slugs";

export const trashRetentionDays = 30;

export type ServiceError = DomainError;

const sortColumns: Record<ServiceSortField, SQL | AnyPgColumn> = {
  updatedAt: services.updatedAt,
  name: sql`lower(${localeKey(services.name, "az")})`,
  price: sql`coalesce(${services.priceAmount}, -1)`,
  status: services.status,
};

const thumbnailKey = sql<string | null>`(select m.key from ${serviceImages} si
  join ${media} m on m.id = si.media_id
  where si.service_id = services.id order by si.position limit 1)`;

const thumbnailAlt = sql<string | null>`(select m.alt ->> 'az' from ${serviceImages} si
  join ${media} m on m.id = si.media_id
  where si.service_id = services.id order by si.position limit 1)`;

const categoryNames = sql<Localized[] | null>`(select jsonb_agg(c.name order by c.sort_order)
  from ${serviceCategoryLinks} sc join ${serviceCategories} c on c.id = sc.category_id
  where sc.service_id = services.id)`;

export async function purgeExpiredTrash(): Promise<number> {
  const cutoff = new Date(Date.now() - trashRetentionDays * 24 * 60 * 60 * 1000);
  const removed = await getDb()
    .delete(services)
    .where(and(isNotNull(services.deletedAt), lt(services.deletedAt, cutoff)))
    .returning({ id: services.id });
  return removed.length;
}

function listFilters(args: ServiceListArgs): SQL | undefined {
  const filters: SQL[] = [];
  const status = args.status ?? "all";
  if (status === "trash") filters.push(isNotNull(services.deletedAt));
  else {
    filters.push(isNull(services.deletedAt));
    if (status !== "all") filters.push(eq(services.status, status));
  }
  if (args.categoryId) {
    filters.push(
      sql`exists (select 1 from ${serviceCategoryLinks} sc where sc.service_id = services.id
        and (sc.category_id = ${args.categoryId}
          or sc.category_id in (select id from ${serviceCategories} where parent_id = ${args.categoryId})))`,
    );
  }
  if (args.search) {
    const pattern = containsPattern(args.search);
    const match = or(
      ...locales.map((locale) => ilike(localeKey(services.name, locale), pattern)),
      ilike(localeKey(services.slug, "az"), pattern),
    );
    if (match) filters.push(match);
  }
  return and(...filters);
}

export async function listServices(args: ServiceListArgs): Promise<Page<ServiceListItemDto>> {
  if (args.status === "trash") await purgeExpiredTrash();
  const db = getDb();
  const where = listFilters(args);
  const direction = args.order === "desc" ? desc : asc;

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: services.id,
        name: services.name,
        slug: services.slug,
        priceKind: services.priceKind,
        priceAmount: services.priceAmount,
        durationMinutes: services.durationMinutes,
        status: services.status,
        isFeatured: services.isFeatured,
        updatedAt: services.updatedAt,
        deletedAt: services.deletedAt,
        thumbnailKey,
        thumbnailAlt,
        categoryNames,
      })
      .from(services)
      .where(where)
      .orderBy(direction(sortColumns[args.sort]), asc(services.id))
      .limit(args.pageSize)
      .offset(args.page * args.pageSize),
    db.select({ value: count() }).from(services).where(where),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      priceKind: row.priceKind,
      priceAmount: row.priceAmount === null ? null : Number(row.priceAmount),
      durationMinutes: row.durationMinutes,
      status: row.status,
      isFeatured: row.isFeatured,
      thumbnail: row.thumbnailKey
        ? { src: routes.media(row.thumbnailKey), alt: row.thumbnailAlt }
        : null,
      categories: row.categoryNames ?? [],
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    })),
    rowCount: total?.value ?? 0,
  };
}

export async function serviceOptions(ids: string[]): Promise<ServiceOptionDto[]> {
  if (!ids.length) return [];
  const rows = await getDb()
    .select({ id: services.id, name: services.name, thumbnailKey, thumbnailAlt })
    .from(services)
    .where(inArray(services.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    return [
      {
        id: row.id,
        name: row.name,
        thumbnail: row.thumbnailKey
          ? { src: routes.media(row.thumbnailKey), alt: row.thumbnailAlt }
          : null,
      },
    ];
  });
}

export async function getService(id: string): Promise<ServiceDetailDto | null> {
  const db = getDb();
  const [row] = await db.select().from(services).where(eq(services.id, id));
  if (!row) return null;

  const [categoryRows, imageRows] = await Promise.all([
    db
      .select({ id: serviceCategoryLinks.categoryId })
      .from(serviceCategoryLinks)
      .where(eq(serviceCategoryLinks.serviceId, id)),
    db
      .select({ mediaId: serviceImages.mediaId })
      .from(serviceImages)
      .where(eq(serviceImages.serviceId, id))
      .orderBy(asc(serviceImages.position)),
  ]);

  const mediaRows = await findMediaByIds(imageRows.map((image) => image.mediaId));
  const mediaById = new Map(mediaRows.map((item) => [item.id, item]));

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.shortDescription,
    description: row.description,
    categoryIds: categoryRows.map((category) => category.id),
    priceKind: row.priceKind,
    priceAmount: row.priceAmount === null ? null : Number(row.priceAmount),
    durationMinutes: row.durationMinutes,
    images: imageRows.map((image) => ({
      mediaId: image.mediaId,
      alt: mediaById.get(image.mediaId)?.alt ?? { az: "" },
    })),
    media: mediaRows.map(toMediaDto),
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    status: row.status,
    isFeatured: row.isFeatured,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function checkReferences(values: ServiceValues): Promise<Record<string, string> | null> {
  const db = getDb();
  const fields: Record<string, string> = {};

  if (values.categoryIds.length) {
    const found = await db
      .select({ id: serviceCategories.id })
      .from(serviceCategories)
      .where(inArray(serviceCategories.id, values.categoryIds));
    if (found.length !== values.categoryIds.length) fields.categoryIds = "Kateqoriya tapılmadı.";
  }

  const mediaRows = await findMediaByIds(values.images.map((image) => image.mediaId));
  const isImage = (mediaId: string) => {
    const row = mediaRows.find((item) => item.id === mediaId);
    return Boolean(
      row && (mediaKindOf(row.mimeType) === "image" || row.mimeType === "image/svg+xml"),
    );
  };
  values.images.forEach((image, index) => {
    if (!isImage(image.mediaId)) fields[`images.${index}.mediaId`] = "Şəkil tapılmadı.";
  });

  return Object.keys(fields).length ? fields : null;
}

function slugConflict(error: unknown): ServiceError | null {
  const constraint = uniqueViolation(error);
  if (constraint === null) return null;
  const locale = locales.find((value) => constraint === `services_slug_${value}_key`);
  const field = `slug.${locale ?? "az"}`;
  return {
    status: 409,
    message: "Bu ünvan (slug) artıq başqa xidmətdə istifadə olunur.",
    fields: { [field]: "Bu ünvan artıq istifadə olunur." },
  };
}

export async function saveService(
  id: string | null,
  values: ServiceValues,
): Promise<{ id: string } | { error: ServiceError }> {
  const db = getDb();
  let current: typeof services.$inferSelect | undefined;
  if (id) {
    [current] = await db.select().from(services).where(eq(services.id, id));
    if (!current) return { error: { status: 404, message: "Xidmət tapılmadı." } };
  }
  const fields = await checkReferences(values);
  if (fields) return { error: { status: 400, message: "Məlumatlar düzgün deyil.", fields } };

  const columns = {
    name: values.name,
    slug: values.slug,
    shortDescription: values.shortDescription,
    description: values.description,
    priceKind: values.priceKind,
    priceAmount: values.priceKind === "on_request" ? null : values.priceAmount,
    durationMinutes: values.durationMinutes,
    seoTitle: values.seoTitle,
    seoDescription: values.seoDescription,
    status: values.status,
    isFeatured: values.isFeatured,
    ...(values.isFeatured ? {} : { featuredPosition: null }),
    publishedAt:
      values.status === "published" ? (current?.publishedAt ?? new Date()) : current?.publishedAt,
  };

  try {
    const savedId = await db.transaction(async (tx) => {
      let serviceId = id;
      if (serviceId) {
        await tx.update(services).set(columns).where(eq(services.id, serviceId));
      } else {
        const [row] = await tx.insert(services).values(columns).returning({ id: services.id });
        if (!row) throw new Error("Service was not created");
        serviceId = row.id;
      }

      await tx.delete(serviceCategoryLinks).where(eq(serviceCategoryLinks.serviceId, serviceId));
      if (values.categoryIds.length) {
        await tx
          .insert(serviceCategoryLinks)
          .values(values.categoryIds.map((categoryId) => ({ serviceId: serviceId, categoryId })));
      }

      await tx.delete(serviceImages).where(eq(serviceImages.serviceId, serviceId));
      if (values.images.length) {
        await tx.insert(serviceImages).values(
          values.images.map((image, position) => ({
            serviceId: serviceId,
            mediaId: image.mediaId,
            position,
          })),
        );
      }
      for (const image of values.images) {
        await tx
          .update(media)
          .set({ alt: image.alt as Localized })
          .where(
            and(
              eq(media.id, image.mediaId),
              sql`${media.alt} is distinct from ${JSON.stringify(image.alt)}::jsonb`,
            ),
          );
      }
      return serviceId;
    });
    return { id: savedId };
  } catch (error) {
    const conflict = slugConflict(error);
    if (conflict) return { error: conflict };
    throw error;
  }
}

function copyName(name: Localized): Localized {
  const suffix: Record<Locale, string> = {
    az: "(kopiya)",
    ru: "(копия)",
    en: "(copy)",
  };
  return {
    az: `${name.az} ${suffix.az}`,
    ru: name.ru ? `${name.ru} ${suffix.ru}` : null,
    en: name.en ? `${name.en} ${suffix.en}` : null,
  };
}

export async function duplicateService(id: string): Promise<{ id: string } | null> {
  const db = getDb();
  const [source] = await db.select().from(services).where(eq(services.id, id));
  if (!source) return null;

  const slug: Localized = {
    az: await freeSlug("service", "az", `${source.slug.az}-kopiya`),
    ru: source.slug.ru ? await freeSlug("service", "ru", `${source.slug.ru}-kopiya`) : null,
    en: source.slug.en ? await freeSlug("service", "en", `${source.slug.en}-copy`) : null,
  };

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(services)
      .values({
        name: copyName(source.name),
        slug,
        shortDescription: source.shortDescription,
        description: source.description,
        priceKind: source.priceKind,
        priceAmount: source.priceAmount,
        durationMinutes: source.durationMinutes,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        status: "draft",
        isFeatured: false,
        sortOrder: source.sortOrder,
      })
      .returning({ id: services.id });
    if (!row) throw new Error("Service copy was not created");
    await tx.execute(sql`insert into ${serviceCategoryLinks} (service_id, category_id)
      select ${row.id}::uuid, category_id from ${serviceCategoryLinks} where service_id = ${id}`);
    await tx.execute(sql`insert into ${serviceImages} (service_id, media_id, position)
      select ${row.id}::uuid, media_id, position from ${serviceImages} where service_id = ${id}`);
    return { id: row.id };
  });
}

export async function bulkUpdateServices(input: BulkServicesInput): Promise<BulkServicesResult> {
  const db = getDb();
  const ids = [...new Set(input.ids)];
  const active = and(inArray(services.id, ids), isNull(services.deletedAt));
  const trashed = and(inArray(services.id, ids), isNotNull(services.deletedAt));
  let updated: { id: string }[] = [];

  switch (input.action) {
    case "publish":
      updated = await db
        .update(services)
        .set({ status: "published", publishedAt: sql`coalesce(${services.publishedAt}, now())` })
        .where(active)
        .returning({ id: services.id });
      break;
    case "unpublish":
      updated = await db
        .update(services)
        .set({ status: "draft" })
        .where(active)
        .returning({ id: services.id });
      break;
    case "feature":
    case "unfeature":
      updated = await db
        .update(services)
        .set(
          input.action === "feature"
            ? { isFeatured: true }
            : { isFeatured: false, featuredPosition: null },
        )
        .where(active)
        .returning({ id: services.id });
      break;
    case "trash":
      updated = await db
        .update(services)
        .set({ deletedAt: new Date() })
        .where(active)
        .returning({ id: services.id });
      break;
    case "restore":
      updated = await db
        .update(services)
        .set({ deletedAt: null, status: "draft" })
        .where(trashed)
        .returning({ id: services.id });
      break;
    case "purge":
      updated = await db.delete(services).where(trashed).returning({ id: services.id });
      break;
  }
  return { updated: updated.length, skipped: ids.length - updated.length };
}

export async function serviceExists(id: string): Promise<boolean> {
  const [row] = await getDb().select({ id: services.id }).from(services).where(eq(services.id, id));
  return Boolean(row);
}
