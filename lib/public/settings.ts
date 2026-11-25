import "server-only";

import { eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { publicTags } from "@/lib/cache/tags";
import { getDb } from "@/lib/db";
import {
  media,
  settings,
  type SettingsPhone,
  type SettingsSeo,
  type SettingsSocial,
} from "@/lib/db/schema";
import type { Localized } from "@/lib/i18n/localized";
import { routes } from "@/lib/routes";

type MediaRow = typeof media.$inferSelect;

type SettingsRow = typeof settings.$inferSelect;

export type SiteImage = {
  src: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  alt: Localized | null;
};

export type SiteSettings = {
  logoLight: SiteImage | null;
  logoDark: SiteImage | null;
  favicon: SiteImage | null;
  ogImage: SiteImage | null;
  phones: SettingsPhone[];
  emails: string[];
  address: Localized | null;
  mapUrl: string | null;
  workingHours: Localized | null;
  openingHours: string | null;
  priceRange: string | null;
  geo: { latitude: number; longitude: number } | null;
  whatsappNumber: string | null;
  socials: SettingsSocial[];
  legalName: string | null;
  seoTitle: Localized | null;
  seoDescription: Localized | null;
  searchIndexing: boolean;
  seo: SettingsSeo;
};

function image(row: MediaRow | undefined): SiteImage | null {
  if (!row) return null;
  return {
    src: routes.media(row.key),
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    alt: row.alt ?? null,
  };
}

export function toSiteSettings(row: SettingsRow | null, mediaRows: MediaRow[]): SiteSettings {
  const byId = new Map(mediaRows.map((item) => [item.id, item]));
  const pick = (id: string | null | undefined) => (id ? byId.get(id) : undefined);
  return {
    logoLight: image(pick(row?.logoLightId)),
    logoDark: image(pick(row?.logoDarkId)),
    favicon: image(pick(row?.faviconId)),
    ogImage: image(pick(row?.ogImageId)),
    phones: row?.phones ?? [],
    emails: row?.emails ?? [],
    address: row?.address ?? null,
    mapUrl: row?.mapUrl ?? null,
    workingHours: row?.workingHours ?? null,
    openingHours: row?.openingHours?.trim() || null,
    priceRange: row?.priceRange?.trim() || null,
    geo:
      row?.geoLatitude != null && row.geoLongitude != null
        ? { latitude: row.geoLatitude, longitude: row.geoLongitude }
        : null,
    whatsappNumber: row?.whatsappNumber ?? null,
    socials: row?.socials ?? [],
    legalName: row?.legalName ?? null,
    seoTitle: row?.seoTitle ?? null,
    seoDescription: row?.seoDescription ?? null,
    searchIndexing: row?.searchIndexing ?? true,
    seo: row?.seo ?? {},
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheTag(publicTags.settings, publicTags.catalog);
  cacheLife("hours");
  const [row = null] = await getDb().select().from(settings).where(eq(settings.id, 1));
  const ids = row
    ? [row.logoLightId, row.logoDarkId, row.faviconId, row.ogImageId].filter(
        (id): id is string => id !== null,
      )
    : [];
  const mediaRows = ids.length
    ? await getDb().select().from(media).where(inArray(media.id, ids))
    : [];
  return toSiteSettings(row, mediaRows);
}
