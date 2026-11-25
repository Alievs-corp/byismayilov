import "server-only";

import { and, asc, desc, eq, inArray, isNull, notInArray } from "drizzle-orm";

import type { DomainError } from "@/lib/api/server";
import { getDb } from "@/lib/db";
import { services, settings } from "@/lib/db/schema";
import type { SettingsHomeSection } from "@/lib/db/schema/settings";
import {
  isCustomSection,
  normalizeHomeSections,
  type HomeSectionsDto,
  type HomeSectionsValues,
} from "@/lib/validation/home-sections";
import { mediaKindOf } from "@/lib/validation/media";

import { heroFilmOptions } from "./hero-films";
import { findMediaByIds, toMediaDto } from "./media";
import { serviceOptions } from "./services";
import { readSettingsRow } from "./settings";

const featuredOrder = [
  asc(services.featuredPosition),
  asc(services.sortOrder),
  desc(services.publishedAt),
  asc(services.id),
];

async function featuredIds(): Promise<string[]> {
  const rows = await getDb()
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.isFeatured, true), isNull(services.deletedAt)))
    .orderBy(...featuredOrder);
  return rows.map((row) => row.id);
}

function referencedMedia(sections: SettingsHomeSection[]) {
  return [
    ...new Set(
      sections.flatMap((section) =>
        isCustomSection(section)
          ? [section.block.mediaId, section.block.posterId].filter((id) => id !== null)
          : [],
      ),
    ),
  ];
}

export async function getAdminHomeSections(): Promise<HomeSectionsDto> {
  const [row, ids, films] = await Promise.all([
    readSettingsRow(),
    featuredIds(),
    heroFilmOptions(),
  ]);
  const sections = normalizeHomeSections(row?.homeSections ?? []);
  const [media, featured] = await Promise.all([
    findMediaByIds(referencedMedia(sections)),
    serviceOptions(ids),
  ]);
  return {
    hero: row?.hero ?? null,
    films,
    sections,
    featured,
    media: media.map(toMediaDto),
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

async function checkReferences(values: HomeSectionsValues): Promise<Record<string, string> | null> {
  const fields: Record<string, string> = {};
  const files = await findMediaByIds(referencedMedia(values.sections));
  const byId = new Map(files.map((file) => [file.id, file]));
  if (values.hero.filmId) {
    const films = await heroFilmOptions();
    if (!films.some((film) => film.id === values.hero.filmId)) {
      fields["hero.filmId"] = "Film tapılmadı.";
    }
  }
  values.sections.forEach((section, index) => {
    if (!isCustomSection(section)) return;
    const { mediaKind, mediaId, posterId } = section.block;
    const file = mediaId ? byId.get(mediaId) : undefined;
    if (mediaId && mediaKindOf(file?.mimeType ?? "") !== mediaKind) {
      fields[`sections.${index}.block.mediaId`] =
        mediaKind === "video" ? "Video tapılmadı." : "Şəkil tapılmadı.";
    }
    const poster = posterId ? byId.get(posterId) : undefined;
    if (posterId && mediaKindOf(poster?.mimeType ?? "") !== "image") {
      fields[`sections.${index}.block.posterId`] = "Şəkil tapılmadı.";
    }
  });
  if (values.featuredIds.length) {
    const found = await getDb()
      .select({ id: services.id })
      .from(services)
      .where(and(inArray(services.id, values.featuredIds), isNull(services.deletedAt)));
    if (found.length !== values.featuredIds.length) {
      fields.featuredIds = "Xidmətlərdən biri tapılmadı və ya silinənlərdədir.";
    }
  }
  return Object.keys(fields).length ? fields : null;
}

export async function saveHomeSections(
  values: HomeSectionsValues,
): Promise<{ homeSections: HomeSectionsDto } | { error: DomainError }> {
  const fields = await checkReferences(values);
  if (fields) return { error: { status: 400, message: "Məlumatlar düzgün deyil.", fields } };

  await getDb().transaction(async (tx) => {
    const columns = { hero: values.hero, homeSections: values.sections };
    await tx
      .insert(settings)
      .values({ id: 1, ...columns })
      .onConflictDoUpdate({ target: settings.id, set: { ...columns, updatedAt: new Date() } });
    await tx
      .update(services)
      .set({ isFeatured: false, featuredPosition: null })
      .where(
        values.featuredIds.length
          ? and(eq(services.isFeatured, true), notInArray(services.id, values.featuredIds))
          : eq(services.isFeatured, true),
      );
    for (const [position, id] of values.featuredIds.entries()) {
      await tx
        .update(services)
        .set({ isFeatured: true, featuredPosition: position })
        .where(eq(services.id, id));
    }
  });
  return { homeSections: await getAdminHomeSections() };
}
