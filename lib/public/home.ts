import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { publicTags } from "@/lib/cache/tags";
import { pickRichText, type RichTextDoc } from "@/lib/content/rich-text";
import { getDb } from "@/lib/db";
import { heroFilms, media, pages, posts, settings } from "@/lib/db/schema";
import type {
  CustomBlockLayout,
  CustomBlockTone,
  HomeSectionKey,
  SettingsCustomSection,
} from "@/lib/db/schema/settings";
import { localePath, type Locale } from "@/lib/i18n/config";
import { pickExact, pickLocale, type Localized } from "@/lib/i18n/localized";
import { routes } from "@/lib/routes";
import { readMediaBytes } from "@/lib/media";
import {
  heroFilmFrameKey,
  heroFilmManifestKey,
  heroFilmManifestSchema,
  type HeroFilmFormat,
  type HeroFilmManifest,
  type HeroFilmTier,
} from "@/lib/validation/hero-films";
import { isCustomSection, normalizeHomeSections } from "@/lib/validation/home-sections";

import { imageColumns, toPublicImage, type PublicImage } from "./images";

export type HomeVideo = {
  src: string;
  type: string;
  label: string | null;
  autoplay: boolean;
  sound: boolean;
};

export type CustomBlock = {
  eyebrow: string | null;
  title: string | null;
  body: RichTextDoc | null;
  link: { label: string; href: string } | null;
  image: PublicImage | null;
  video: HomeVideo | null;
  poster: PublicImage | null;
  layout: CustomBlockLayout;
  mediaWidth: number;
  tone: CustomBlockTone;
};

export type HomeSection =
  | { key: HomeSectionKey; visible: boolean; title: string | null }
  | { key: "custom"; id: string; visible: boolean; block: CustomBlock };

export type HeroFilmTierFrames = {
  count: number;
  width: number;
  height: number;
  frames: string;
};

export type HeroFilmPoster = { src: string; width: number; height: number };

export type HeroFilm = {
  version: number;
  frameCount: number;
  width: number;
  height: number;
  format: HeroFilmFormat;
  firstFrame: string;
  framePattern: string;
  tiers: {
    desktop: HeroFilmTierFrames;
    mobile: HeroFilmTierFrames | null;
    wide: HeroFilmTierFrames | null;
  };
  motion: string | null;
  poster: PublicImage | null;
  mobilePoster: HeroFilmPoster | null;
};

export type HomeHero = {
  headline: string;
  subline: string | null;
  cta: { label: string; href: string } | null;
  film: HeroFilm | null;
};

const postLimit = 3;

function internalHref(href: string | null, locale: Locale): string | null {
  if (!href) return null;
  return href.startsWith("/") ? localePath(locale, href) : href;
}

async function readFilmManifest(prefix: string): Promise<HeroFilmManifest | null> {
  try {
    const bytes = await readMediaBytes(heroFilmManifestKey(prefix));
    if (!bytes) return null;
    const parsed = heroFilmManifestSchema.safeParse(JSON.parse(bytes.toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

type FilmRow = typeof heroFilms.$inferSelect;

function toHeroFilm(
  film: FilmRow,
  manifest: HeroFilmManifest | null,
  poster: PublicImage | null,
): HeroFilm {
  const prefix = film.keyPrefix;
  const format = manifest?.format ?? film.format;
  const pattern = (tier?: HeroFilmTier) =>
    routes.media(`${tier ? `${prefix}/${tier}` : prefix}/{frame}.${format}`);
  const desktop: HeroFilmTierFrames = manifest
    ? { ...manifest.tiers.desktop, frames: pattern("desktop") }
    : {
        count: film.frameCount,
        width: film.frameWidth,
        height: film.frameHeight,
        frames: pattern(),
      };
  const mobile = manifest?.tiers.mobile
    ? { ...manifest.tiers.mobile, frames: pattern("mobile") }
    : null;
  const wide = manifest?.tiers.wide ? { ...manifest.tiers.wide, frames: pattern("wide") } : null;
  const mobilePoster = manifest?.posters?.mobile;
  const desktopPoster = manifest?.posters?.desktop;
  return {
    version: manifest?.version ?? 1,
    frameCount: desktop.count,
    width: desktop.width,
    height: desktop.height,
    format,
    firstFrame: routes.media(heroFilmFrameKey(prefix, 0, format, manifest ? "desktop" : undefined)),
    framePattern: desktop.frames,
    tiers: { desktop, mobile, wide },
    motion: manifest?.motion?.length ? routes.media(heroFilmManifestKey(prefix)) : null,
    poster:
      poster ??
      (desktopPoster
        ? {
            src: routes.media(desktopPoster.key),
            width: desktopPoster.width,
            height: desktopPoster.height,
            alt: "",
            blurDataURL: null,
          }
        : null),
    mobilePoster: mobilePoster
      ? {
          src: routes.media(mobilePoster.key),
          width: mobilePoster.width,
          height: mobilePoster.height,
        }
      : null,
  };
}

export async function getHero(locale: Locale): Promise<HomeHero | null> {
  "use cache";
  cacheTag(publicTags.settings);
  cacheLife("hours");
  const [row] = await getDb()
    .select({ hero: settings.hero })
    .from(settings)
    .where(eq(settings.id, 1));
  const hero = row?.hero;
  if (!hero) return null;
  const [film] = hero.filmId
    ? await getDb()
        .select({ film: heroFilms, poster: imageColumns })
        .from(heroFilms)
        .leftJoin(media, eq(media.id, heroFilms.posterId))
        .where(eq(heroFilms.id, hero.filmId))
    : [];
  const headline = pickLocale(hero.headline, locale);
  const label = hero.ctaLabel ? pickLocale(hero.ctaLabel, locale) : null;
  const href = internalHref(hero.ctaHref, locale);
  const manifest = film ? await readFilmManifest(film.film.keyPrefix) : null;
  return {
    headline,
    subline: hero.subline ? pickLocale(hero.subline, locale) || null : null,
    cta: label && href ? { label, href } : null,
    film: film
      ? toHeroFilm(film.film, manifest, toPublicImage(film.poster, locale, headline))
      : null,
  };
}

function pickWithFallback(field: Localized | null, locale: Locale): string | null {
  return pickExact(field, locale) ?? pickExact(field, "az");
}

function toCustomBlock(
  section: SettingsCustomSection,
  files: Map<string, typeof media.$inferSelect>,
  locale: Locale,
): CustomBlock {
  const { block } = section;
  const title = pickWithFallback(section.title, locale);
  const file = block.mediaId ? files.get(block.mediaId) : undefined;
  const poster = block.posterId ? files.get(block.posterId) : undefined;
  const label = pickWithFallback(block.linkLabel, locale);
  const image = block.mediaKind === "image" ? toPublicImage(file, locale, title ?? "") : null;
  const video =
    block.mediaKind === "video" && file
      ? {
          src: routes.media(file.key),
          type: file.mimeType,
          label: file.alt ? pickLocale(file.alt, locale) || null : null,
          autoplay: block.autoplay,
          sound: block.sound,
        }
      : null;
  return {
    eyebrow: pickWithFallback(block.eyebrow, locale),
    title,
    body: pickRichText(block.body, locale),
    link: label && block.href ? { label, href: block.href } : null,
    image,
    video,
    poster: video ? toPublicImage(poster, locale, "") : null,
    layout: image || video ? block.layout : "media-top",
    mediaWidth: block.mediaWidth,
    tone: block.tone,
  };
}

export async function getHomeSections(locale: Locale): Promise<HomeSection[]> {
  "use cache";
  cacheTag(publicTags.settings);
  cacheLife("hours");
  const [row] = await getDb()
    .select({ sections: settings.homeSections })
    .from(settings)
    .where(eq(settings.id, 1));
  const sections = normalizeHomeSections(row?.sections ?? []);
  const ids = sections.flatMap((section) =>
    isCustomSection(section)
      ? [section.block.mediaId, section.block.posterId].filter((id) => id !== null)
      : [],
  );
  const rows = ids.length ? await getDb().select().from(media).where(inArray(media.id, ids)) : [];
  const files = new Map(rows.map((file) => [file.id, file]));
  return sections.map((section) =>
    isCustomSection(section)
      ? {
          key: "custom",
          id: section.id,
          visible: section.visible,
          block: toCustomBlock(section, files, locale),
        }
      : {
          key: section.key,
          visible: section.visible,
          title: pickExact(section.title, locale),
        },
  );
}

export type HomePost = { id: string; title: string; href: string; publishedAt: string };

export async function getLatestPosts(locale: Locale): Promise<HomePost[]> {
  "use cache";
  cacheTag(publicTags.content);
  cacheLife("minutes");
  const rows = await getDb()
    .select({ id: posts.id, slug: posts.slug, title: posts.title, publishedAt: posts.publishedAt })
    .from(posts)
    .where(and(eq(posts.status, "published"), lte(posts.publishedAt, sql`now()`)))
    .orderBy(desc(posts.publishedAt), asc(posts.id))
    .limit(postLimit);
  return rows.map((row) => ({
    id: row.id,
    title: pickLocale(row.title, locale),
    href: localePath(locale, routes.post(pickLocale(row.slug, locale))),
    publishedAt: (row.publishedAt ?? new Date(0)).toISOString(),
  }));
}

export type PageKind = (typeof pages.kind.enumValues)[number];

export async function getPageLinks(locale: Locale): Promise<Partial<Record<PageKind, string>>> {
  "use cache";
  cacheTag(publicTags.content);
  cacheLife("hours");
  const rows = await getDb()
    .select({ kind: pages.kind, slug: pages.slug })
    .from(pages)
    .where(and(isNotNull(pages.kind), eq(pages.status, "published")));
  return Object.fromEntries(
    rows.flatMap((row) =>
      row.kind ? [[row.kind, localePath(locale, routes.page(pickLocale(row.slug, locale)))]] : [],
    ),
  );
}
