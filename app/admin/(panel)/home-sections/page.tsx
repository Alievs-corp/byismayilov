import type { Metadata } from "next";

import { getAdminT } from "@/lib/admin/i18n/server";
import { requireAdminUser } from "@/lib/auth/session";
import { locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

import { HomeSectionsEditor } from "./home-sections-editor";
import type { SectionDefaults } from "./section-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: t("Ana səhifə bölmələri") };
}

export const instant = false;

async function sectionDefaults(): Promise<SectionDefaults> {
  const dictionaries = await Promise.all(locales.map((locale) => getDictionary(locale)));
  const titles = (pick: (home: (typeof dictionaries)[number]["home"]) => string) =>
    Object.fromEntries(
      locales.map((locale, index) => [locale, pick(dictionaries[index].home)]),
    ) as Record<Locale, string>;
  return {
    services: titles((home) => home.servicesTitle),
    masters: titles((home) => home.mastersTitle),
    gallery: titles((home) => home.galleryTitle),
    reviews: titles((home) => home.reviewsTitle),
    booking: titles((home) => home.bookingTitle),
    posts: titles((home) => home.postsTitle),
    contact: titles((home) => home.contactTitle),
  };
}

export default async function HomeSectionsPage() {
  await requireAdminUser();
  return <HomeSectionsEditor defaults={await sectionDefaults()} />;
}
