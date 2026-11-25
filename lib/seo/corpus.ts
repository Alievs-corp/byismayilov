import "server-only";

import { and, asc, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { publicTags } from "@/lib/cache/tags";
import { getDb } from "@/lib/db";
import {
  galleryItems,
  masterServices,
  masters,
  media,
  pages,
  posts,
  serviceCategories,
  serviceCategoryLinks,
  serviceImages,
  services,
  settings,
} from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import { visibleCategoryIds } from "@/lib/public/category-visibility";
import { getSiteSettings } from "@/lib/public/settings";

import { entityTitle, translatedIn } from "./model";
import type { Corpus, CorpusImage, EntityKind } from "./model";
import { blogLocales } from "./sitemap";

const rasterTypes = ["image/jpeg", "image/png", "image/webp"];

type MediaRow = typeof media.$inferSelect;

function toImage(row: Pick<MediaRow, "key" | "width" | "height" | "alt" | "caption">): CorpusImage {
  return {
    key: row.key,
    width: row.width,
    height: row.height,
    alt: row.alt,
    caption: row.caption,
  };
}

function raster(row: MediaRow | null): CorpusImage | null {
  return row && rasterTypes.includes(row.mimeType) ? toImage(row) : null;
}

const iso = (date: Date) => date.toISOString();

function group<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) map.set(key(row), [...(map.get(key(row)) ?? []), row]);
  return map;
}

export async function queryCorpus(): Promise<Corpus> {
  const db = getDb();
  const [
    siteSettings,
    settingsRows,
    galleryRows,
    categoryRows,
    serviceRows,
    linkRows,
    imageRows,
    masterRows,
    masterLinkRows,
    pageRows,
    postRows,
  ] = await Promise.all([
    getSiteSettings(),
    db.select({ updatedAt: settings.updatedAt }).from(settings),
    db
      .select({ updatedAt: galleryItems.updatedAt })
      .from(galleryItems)
      .where(eq(galleryItems.isActive, true))
      .orderBy(desc(galleryItems.updatedAt))
      .limit(1),
    db
      .select({ category: serviceCategories, image: media })
      .from(serviceCategories)
      .leftJoin(media, eq(media.id, serviceCategories.imageId))
      .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.createdAt)),
    db
      .select()
      .from(services)
      .where(and(eq(services.status, "published"), isNull(services.deletedAt)))
      .orderBy(asc(services.sortOrder), asc(services.createdAt)),
    db.select().from(serviceCategoryLinks),
    db
      .select({ serviceId: serviceImages.serviceId, image: media })
      .from(serviceImages)
      .innerJoin(media, eq(media.id, serviceImages.mediaId))
      .where(inArray(media.mimeType, rasterTypes))
      .orderBy(asc(serviceImages.position)),
    db
      .select({ master: masters, photo: media })
      .from(masters)
      .leftJoin(media, eq(media.id, masters.photoId))
      .where(eq(masters.isActive, true))
      .orderBy(asc(masters.sortOrder), asc(masters.createdAt)),
    db.select().from(masterServices),
    db
      .select({ page: pages, cover: media })
      .from(pages)
      .leftJoin(media, eq(media.id, pages.coverId))
      .where(eq(pages.status, "published"))
      .orderBy(asc(pages.createdAt)),
    db
      .select({ post: posts, cover: media })
      .from(posts)
      .leftJoin(media, eq(media.id, posts.coverId))
      .where(and(eq(posts.status, "published"), lte(posts.publishedAt, sql`now()`)))
      .orderBy(asc(posts.publishedAt)),
  ]);

  const visible = visibleCategoryIds(categoryRows.map((row) => row.category));
  const categoryIdsByService = group(linkRows, (row) => row.serviceId);
  const imagesByService = group(imageRows, (row) => row.serviceId);
  const serviceIdsByMaster = group(masterLinkRows, (row) => row.masterId);
  const publishedServices = serviceRows.filter((service) => {
    const linked = categoryIdsByService.get(service.id);
    return !linked || linked.some((row) => visible.has(row.categoryId));
  });
  const publishedIds = new Set(publishedServices.map((service) => service.id));

  return {
    settings: siteSettings,
    settingsUpdatedAt: settingsRows[0] ? iso(settingsRows[0].updatedAt) : null,
    galleryUpdatedAt: galleryRows[0] ? iso(galleryRows[0].updatedAt) : null,
    categories: categoryRows
      .filter((row) => visible.has(row.category.id))
      .map(({ category, image }) => ({
        id: category.id,
        parentId: category.parentId,
        slug: category.slug,
        name: category.name,
        description: category.description,
        seoTitle: category.seoTitle,
        seoDescription: category.seoDescription,
        image: raster(image),
        updatedAt: iso(category.updatedAt),
      })),
    services: publishedServices.map((service) => ({
      id: service.id,
      slug: service.slug,
      name: service.name,
      shortDescription: service.shortDescription,
      description: service.description,
      priceKind: service.priceKind,
      priceAmount: service.priceAmount,
      durationMinutes: service.durationMinutes,
      categoryIds: (categoryIdsByService.get(service.id) ?? [])
        .map((row) => row.categoryId)
        .filter((id) => visible.has(id)),
      images: (imagesByService.get(service.id) ?? []).map((row) => toImage(row.image)),
      seoTitle: service.seoTitle,
      seoDescription: service.seoDescription,
      updatedAt: iso(service.updatedAt),
    })),
    masters: masterRows.map(({ master, photo }) => ({
      id: master.id,
      name: master.name,
      role: master.role,
      bio: master.bio,
      instagramUrl: master.instagramUrl,
      serviceIds: (serviceIdsByMaster.get(master.id) ?? [])
        .map((row) => row.serviceId)
        .filter((id) => publishedIds.has(id)),
      photo: raster(photo),
      updatedAt: iso(master.updatedAt),
    })),
    pages: pageRows.map(({ page, cover }) => ({
      id: page.id,
      kind: page.kind,
      slug: page.slug,
      title: page.title,
      content: page.content,
      cover: raster(cover),
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      updatedAt: iso(page.updatedAt),
    })),
    posts: postRows.map(({ post, cover }) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      cover: raster(cover),
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      publishedAt: iso(post.publishedAt ?? post.createdAt),
      updatedAt: iso(post.updatedAt),
    })),
  };
}

export async function getCorpus(): Promise<Corpus> {
  "use cache";
  cacheTag(publicTags.catalog, publicTags.content, publicTags.settings);
  cacheLife("hours");
  return queryCorpus();
}

export type EntityInfo = { locales: Locale[]; updatedAt: string | null };

export async function entityInfo(kind: EntityKind, id: string): Promise<EntityInfo> {
  const corpus = await getCorpus();
  const list = kind === "service" ? corpus.services : kind === "page" ? corpus.pages : corpus.posts;
  const found = list.find((entity) => entity.id === id);
  return found
    ? { locales: translatedIn(entityTitle(found)), updatedAt: found.updatedAt }
    : { locales: [], updatedAt: null };
}

export async function blogIndexable(locale: Locale): Promise<boolean> {
  return blogLocales(await getCorpus()).includes(locale);
}
