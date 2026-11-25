import { pickRichText, richTextToPlain, type RichTextDoc } from "@/lib/content/rich-text";
import type { pageKind } from "@/lib/db/schema/content";
import type { ServicePriceKind } from "@/lib/db/schema/services";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config";
import { pickLocale, type Localized } from "@/lib/i18n/localized";
import type { SiteSettings } from "@/lib/public/settings";

import { firstSentences } from "./text";

export type CorpusImage = {
  key: string;
  width: number | null;
  height: number | null;
  alt: Localized | null;
  caption: Localized | null;
};

export type CorpusCategory = {
  id: string;
  parentId: string | null;
  slug: Localized;
  name: Localized;
  description: Localized<RichTextDoc> | null;
  seoTitle: Localized | null;
  seoDescription: Localized | null;
  image: CorpusImage | null;
  updatedAt: string;
};

export type CorpusService = {
  id: string;
  slug: Localized;
  name: Localized;
  shortDescription: Localized<RichTextDoc> | null;
  description: Localized<RichTextDoc> | null;
  priceKind: ServicePriceKind;
  priceAmount: number | null;
  durationMinutes: number | null;
  categoryIds: string[];
  images: CorpusImage[];
  seoTitle: Localized | null;
  seoDescription: Localized | null;
  updatedAt: string;
};

export type CorpusMaster = {
  id: string;
  name: Localized;
  role: Localized;
  bio: Localized | null;
  instagramUrl: string | null;
  serviceIds: string[];
  photo: CorpusImage | null;
  updatedAt: string;
};

type PageKind = (typeof pageKind.enumValues)[number];

export type CorpusPage = {
  id: string;
  kind: PageKind | null;
  slug: Localized;
  title: Localized;
  content: Localized<RichTextDoc> | null;
  cover: CorpusImage | null;
  seoTitle: Localized | null;
  seoDescription: Localized | null;
  updatedAt: string;
};

export type CorpusPost = {
  id: string;
  slug: Localized;
  title: Localized;
  excerpt: Localized | null;
  content: Localized<RichTextDoc> | null;
  cover: CorpusImage | null;
  seoTitle: Localized | null;
  seoDescription: Localized | null;
  publishedAt: string;
  updatedAt: string;
};

export type Corpus = {
  settings: SiteSettings;
  settingsUpdatedAt: string | null;
  galleryUpdatedAt: string | null;
  categories: CorpusCategory[];
  services: CorpusService[];
  masters: CorpusMaster[];
  pages: CorpusPage[];
  posts: CorpusPost[];
};

export type EntityKind = "service" | "page" | "post";

export function hasLocale(field: Localized | null | undefined, locale: Locale): boolean {
  if (locale === defaultLocale) return true;
  return Boolean(field?.[locale]?.trim());
}

export function translatedIn(title: Localized): Locale[] {
  return locales.filter((locale) => hasLocale(title, locale));
}

export function localizedText(field: Localized | null | undefined, locale: Locale): string {
  return field ? pickLocale(field, locale).trim() : "";
}

export function plainText(
  field: Localized<RichTextDoc> | null | undefined,
  locale: Locale,
): string {
  return richTextToPlain(pickRichText(field, locale));
}

export function summaryText(
  summary: Localized<RichTextDoc> | null | undefined,
  body: Localized<RichTextDoc> | null | undefined,
  locale: Locale,
  max = 240,
): string {
  const text = plainText(summary, locale) || plainText(body, locale);
  return text ? firstSentences(text, max) : "";
}

export function entityTitle(entity: CorpusService | CorpusPage | CorpusPost): Localized {
  return "title" in entity ? entity.title : entity.name;
}
