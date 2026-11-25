import "server-only";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { publicTags } from "@/lib/cache/tags";
import {
  pickRichText,
  richTextToPlain,
  summarize,
  type RichTextDoc,
} from "@/lib/content/rich-text";
import { getDb } from "@/lib/db";
import {
  masterServices,
  masters,
  media,
  serviceCategories,
  serviceCategoryLinks,
  serviceImages,
  services,
} from "@/lib/db/schema";
import { localePath, type Locale } from "@/lib/i18n/config";
import { pickExact, pickLocale, type Localized } from "@/lib/i18n/localized";
import { routes } from "@/lib/routes";

import { visibleCategoryIds } from "./category-visibility";
import { imageColumns, toPublicImage, type PublicImage } from "./images";
import type { ServicePrice } from "./price";
import { slugMatches, slugRank } from "./slug";

export type ServiceListItem = {
  id: string;
  name: string;
  summary: string | null;
  href: string;
  price: ServicePrice;
  durationMinutes: number | null;
  image: PublicImage | null;
};

export type ServiceGroup = {
  id: string;
  name: string;
  anchor: string;
  description: RichTextDoc | null;
  services: ServiceListItem[];
  children: ServiceGroup[];
};

export type ServiceMenu = { groups: ServiceGroup[]; other: ServiceListItem[] };

export type ServiceDetail = ServiceListItem & {
  slug: Localized;
  shortDescription: RichTextDoc | null;
  description: RichTextDoc | null;
  images: PublicImage[];
  categories: { id: string; name: string; href: string }[];
  masters: { id: string; name: string; role: string; photo: PublicImage | null }[];
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
};

export type BookingOptionGroup = {
  id: string;
  name: string;
  services: { id: string; name: string }[];
};

export const visibleService = and(eq(services.status, "published"), isNull(services.deletedAt));

export function serviceHref(slug: Localized, locale: Locale): string {
  return localePath(locale, routes.service(pickLocale(slug, locale)));
}

export function categoryAnchor(slug: Localized, locale: Locale): string {
  return pickLocale(slug, locale);
}

export function categoryHref(slug: Localized, locale: Locale): string {
  return `${localePath(locale, routes.services())}#${categoryAnchor(slug, locale)}`;
}

const serviceColumns = {
  id: services.id,
  slug: services.slug,
  name: services.name,
  shortDescription: services.shortDescription,
  description: services.description,
  priceKind: services.priceKind,
  priceAmount: services.priceAmount,
  durationMinutes: services.durationMinutes,
};

type ServiceRow = {
  id: string;
  slug: Localized;
  name: Localized;
  shortDescription: Localized<RichTextDoc> | null;
  description: Localized<RichTextDoc> | null;
  priceKind: ServicePrice["kind"];
  priceAmount: number | null;
  durationMinutes: number | null;
};

function summaryOf(row: ServiceRow, locale: Locale): string | null {
  const text =
    richTextToPlain(pickRichText(row.shortDescription, locale)) ||
    richTextToPlain(pickRichText(row.description, locale));
  return text ? summarize(text, 160) : null;
}

async function firstImages(ids: string[], locale: Locale, names: Map<string, string>) {
  const result = new Map<string, PublicImage>();
  if (!ids.length) return result;
  const rows = await getDb()
    .select({ serviceId: serviceImages.serviceId, ...imageColumns })
    .from(serviceImages)
    .innerJoin(media, eq(media.id, serviceImages.mediaId))
    .where(and(inArray(serviceImages.serviceId, ids), sql`${serviceImages.position} = 0`));
  for (const row of rows) {
    const image = toPublicImage(row, locale, names.get(row.serviceId) ?? "");
    if (image) result.set(row.serviceId, image);
  }
  return result;
}

function toListItem(row: ServiceRow, locale: Locale, image: PublicImage | null): ServiceListItem {
  return {
    id: row.id,
    name: pickLocale(row.name, locale),
    summary: summaryOf(row, locale),
    href: serviceHref(row.slug, locale),
    price: { kind: row.priceKind, amount: row.priceAmount },
    durationMinutes: row.durationMinutes,
    image,
  };
}

async function visibleCategories() {
  const rows = await getDb()
    .select({
      id: serviceCategories.id,
      parentId: serviceCategories.parentId,
      isActive: serviceCategories.isActive,
      slug: serviceCategories.slug,
      name: serviceCategories.name,
      description: serviceCategories.description,
    })
    .from(serviceCategories)
    .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.createdAt));
  const visible = visibleCategoryIds(rows);
  return rows.filter((row) => visible.has(row.id));
}

export async function queryServiceMenu(locale: Locale): Promise<ServiceMenu> {
  const db = getDb();
  const [rows, categories, links] = await Promise.all([
    db
      .select(serviceColumns)
      .from(services)
      .where(visibleService)
      .orderBy(asc(services.sortOrder), asc(services.createdAt), asc(services.id)),
    visibleCategories(),
    db.select().from(serviceCategoryLinks),
  ]);
  const names = new Map(rows.map((row) => [row.id, pickLocale(row.name, locale)]));
  const images = await firstImages(
    rows.map((row) => row.id),
    locale,
    names,
  );
  const items = new Map(
    rows.map((row) => [row.id, toListItem(row, locale, images.get(row.id) ?? null)]),
  );
  const visibleIds = new Set(categories.map((category) => category.id));
  const linked = new Set<string>();
  const byCategory = new Map<string, ServiceListItem[]>();
  for (const link of links) {
    const item = items.get(link.serviceId);
    if (!item) continue;
    linked.add(link.serviceId);
    if (!visibleIds.has(link.categoryId)) continue;
    byCategory.set(link.categoryId, [...(byCategory.get(link.categoryId) ?? []), item]);
  }
  const order = rows.map((row) => row.id);
  const sorted = (list: ServiceListItem[]) =>
    [...list].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  const groups = new Map<string, ServiceGroup>();
  for (const category of categories) {
    groups.set(category.id, {
      id: category.id,
      name: pickLocale(category.name, locale),
      anchor: categoryAnchor(category.slug, locale),
      description: pickRichText(category.description, locale),
      services: sorted(byCategory.get(category.id) ?? []),
      children: [],
    });
  }
  const roots: ServiceGroup[] = [];
  for (const category of categories) {
    const group = groups.get(category.id);
    if (!group) continue;
    const parent = category.parentId ? groups.get(category.parentId) : null;
    if (parent) parent.children.push(group);
    else roots.push(group);
  }
  const hasServices = (group: ServiceGroup): boolean =>
    group.services.length > 0 || group.children.some(hasServices);
  const prune = (list: ServiceGroup[]): ServiceGroup[] =>
    list.filter(hasServices).map((group) => ({ ...group, children: prune(group.children) }));

  return {
    groups: prune(roots),
    other: rows.flatMap((row) => {
      const item = items.get(row.id);
      return item && !linked.has(row.id) ? [item] : [];
    }),
  };
}

export async function getServiceMenu(locale: Locale): Promise<ServiceMenu> {
  "use cache";
  cacheTag(publicTags.catalog);
  cacheLife("hours");
  return queryServiceMenu(locale);
}

export async function queryFeaturedServices(locale: Locale, limit = 6): Promise<ServiceListItem[]> {
  const order = [asc(services.sortOrder), asc(services.createdAt), asc(services.id)];
  const select = (featuredOnly: boolean) =>
    getDb()
      .select(serviceColumns)
      .from(services)
      .where(featuredOnly ? and(visibleService, eq(services.isFeatured, true)) : visibleService)
      .orderBy(...(featuredOnly ? [asc(services.featuredPosition), ...order] : order))
      .limit(limit);
  const featured = await select(true);
  const rows = featured.length ? featured : await select(false);
  const names = new Map(rows.map((row) => [row.id, pickLocale(row.name, locale)]));
  const images = await firstImages(
    rows.map((row) => row.id),
    locale,
    names,
  );
  return rows.map((row) => toListItem(row, locale, images.get(row.id) ?? null));
}

export async function getFeaturedServices(locale: Locale): Promise<ServiceListItem[]> {
  "use cache";
  cacheTag(publicTags.catalog);
  cacheLife("hours");
  return queryFeaturedServices(locale);
}

export async function queryServiceBySlug(
  locale: Locale,
  slug: string,
): Promise<ServiceDetail | null> {
  const db = getDb();
  const [row] = await db
    .select({
      ...serviceColumns,
      seoTitle: services.seoTitle,
      seoDescription: services.seoDescription,
      updatedAt: services.updatedAt,
    })
    .from(services)
    .where(and(visibleService, slugMatches(services.slug, locale, slug)))
    .orderBy(slugRank(services.slug, locale, slug))
    .limit(1);
  if (!row) return null;
  const name = pickLocale(row.name, locale);
  const [imageRows, categories, links, masterRows] = await Promise.all([
    db
      .select(imageColumns)
      .from(serviceImages)
      .innerJoin(media, eq(media.id, serviceImages.mediaId))
      .where(eq(serviceImages.serviceId, row.id))
      .orderBy(asc(serviceImages.position)),
    visibleCategories(),
    db
      .select({ categoryId: serviceCategoryLinks.categoryId })
      .from(serviceCategoryLinks)
      .where(eq(serviceCategoryLinks.serviceId, row.id)),
    db
      .select({ id: masters.id, name: masters.name, role: masters.role, ...imageColumns })
      .from(masterServices)
      .innerJoin(masters, eq(masters.id, masterServices.masterId))
      .leftJoin(media, eq(media.id, masters.photoId))
      .where(and(eq(masterServices.serviceId, row.id), eq(masters.isActive, true)))
      .orderBy(asc(masters.sortOrder), asc(masters.createdAt)),
  ]);
  const images = imageRows.flatMap((image) => {
    const value = toPublicImage(image, locale, name);
    return value ? [value] : [];
  });
  const linked = new Set(links.map((link) => link.categoryId));
  return {
    ...toListItem(row, locale, images[0] ?? null),
    slug: row.slug,
    shortDescription: pickRichText(row.shortDescription, locale),
    description: pickRichText(row.description, locale),
    images,
    categories: categories
      .filter((category) => linked.has(category.id))
      .map((category) => ({
        id: category.id,
        name: pickLocale(category.name, locale),
        href: categoryHref(category.slug, locale),
      })),
    masters: masterRows.map((master) => {
      const masterName = pickLocale(master.name, locale);
      return {
        id: master.id,
        name: masterName,
        role: pickLocale(master.role, locale),
        photo: toPublicImage(master, locale, masterName),
      };
    }),
    seoTitle: pickExact(row.seoTitle, locale),
    seoDescription: pickExact(row.seoDescription, locale),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getServiceBySlug(
  locale: Locale,
  slug: string,
): Promise<ServiceDetail | null> {
  "use cache";
  cacheTag(publicTags.catalog, publicTags.content);
  cacheLife("hours");
  return queryServiceBySlug(locale, slug);
}

export async function queryBookingOptions(locale: Locale): Promise<BookingOptionGroup[]> {
  const menu = await queryServiceMenu(locale);
  const seen = new Set<string>();
  const option = (item: ServiceListItem) => ({ id: item.id, name: item.name });
  const flatten = (group: ServiceGroup, prefix: string): BookingOptionGroup[] => {
    const name = prefix ? `${prefix} / ${group.name}` : group.name;
    const own = group.services.filter((item) => !seen.has(item.id));
    own.forEach((item) => seen.add(item.id));
    return [
      ...(own.length ? [{ id: group.id, name, services: own.map(option) }] : []),
      ...group.children.flatMap((child) => flatten(child, name)),
    ];
  };
  const groups = menu.groups.flatMap((group) => flatten(group, ""));
  const other = menu.other.filter((item) => !seen.has(item.id));
  return other.length
    ? [...groups, { id: "other", name: "", services: other.map(option) }]
    : groups;
}

export async function getBookingOptions(locale: Locale): Promise<BookingOptionGroup[]> {
  "use cache";
  cacheTag(publicTags.catalog);
  cacheLife("hours");
  return queryBookingOptions(locale);
}
