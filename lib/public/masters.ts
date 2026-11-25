import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { publicTags } from "@/lib/cache/tags";
import { getDb } from "@/lib/db";
import { masterServices, masters, media, services } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import { pickLocale } from "@/lib/i18n/localized";

import { imageColumns, toPublicImage, type PublicImage } from "./images";
import { serviceHref, visibleService } from "./services";

export type PublicMaster = {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  instagramUrl: string | null;
  photo: PublicImage | null;
  services: { id: string; name: string; href: string }[];
};

export async function queryMasters(locale: Locale, limit?: number): Promise<PublicMaster[]> {
  const db = getDb();
  const query = db
    .select({ master: masters, ...imageColumns })
    .from(masters)
    .leftJoin(media, eq(media.id, masters.photoId))
    .where(eq(masters.isActive, true))
    .orderBy(asc(masters.sortOrder), asc(masters.createdAt), asc(masters.id));
  const rows = limit ? await query.limit(limit) : await query;
  const ids = rows.map((row) => row.master.id);
  const links = ids.length
    ? await db
        .select({
          masterId: masterServices.masterId,
          id: services.id,
          slug: services.slug,
          name: services.name,
        })
        .from(masterServices)
        .innerJoin(services, eq(services.id, masterServices.serviceId))
        .where(and(inArray(masterServices.masterId, ids), visibleService))
        .orderBy(asc(services.sortOrder), asc(services.createdAt))
    : [];
  return rows.map(({ master, ...image }) => {
    const name = pickLocale(master.name, locale);
    return {
      id: master.id,
      name,
      role: pickLocale(master.role, locale),
      bio: master.bio ? pickLocale(master.bio, locale) || null : null,
      instagramUrl: master.instagramUrl,
      photo: toPublicImage(image, locale, name),
      services: links
        .filter((link) => link.masterId === master.id)
        .map((link) => ({
          id: link.id,
          name: pickLocale(link.name, locale),
          href: serviceHref(link.slug, locale),
        })),
    };
  });
}

export async function getMasters(locale: Locale): Promise<PublicMaster[]> {
  "use cache";
  cacheTag(publicTags.content, publicTags.catalog);
  cacheLife("hours");
  return queryMasters(locale);
}

export async function getMasterOptions(locale: Locale): Promise<{ id: string; name: string }[]> {
  "use cache";
  cacheTag(publicTags.content);
  cacheLife("hours");
  const rows = await getDb()
    .select({ id: masters.id, name: masters.name })
    .from(masters)
    .where(eq(masters.isActive, true))
    .orderBy(asc(masters.sortOrder), asc(masters.createdAt), asc(masters.id));
  return rows.map((row) => ({ id: row.id, name: pickLocale(row.name, locale) }));
}
