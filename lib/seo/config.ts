import { locales, type Locale } from "@/lib/i18n/config";

export const siteName = "byismayilov";

export const openGraphLocales: Record<Locale, string> = {
  az: "az_AZ",
  ru: "ru_RU",
  en: "en_US",
};

const languageNames: Record<Locale, Record<Locale, string>> = {
  az: { az: "Azərbaycanca", ru: "Rusca", en: "İngiliscə" },
  ru: { az: "Азербайджанский", ru: "Русский", en: "Английский" },
  en: { az: "Azerbaijani", ru: "Russian", en: "English" },
};

export function languageName(language: Locale, inLocale: Locale): string {
  return languageNames[inLocale][language];
}

export const ogImageSize = { width: 1200, height: 630 } as const;

export const ogKinds = [
  "home",
  "service",
  "page",
  "post",
  "services",
  "masters",
  "gallery",
  "blog",
  "contact",
  "booking",
] as const;

export type OgKind = (typeof ogKinds)[number];

export function ogImagePath(locale: Locale, kind: OgKind, slug = "default"): string {
  return `/og/${locale}/${kind}/${encodeURIComponent(slug)}.png`;
}

export const reservedRootTextFiles = new Set(["robots", "llms", "llms-full", "humans", "security"]);

export const markdownSuffix = ".md";

export const publicLocales: readonly Locale[] = locales;
