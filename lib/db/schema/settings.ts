import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { RichTextDoc } from "../../content/rich-text";
import type { Locale } from "../../i18n/config";
import type { Localized } from "../../i18n/localized";
import { localized } from "./columns";
import { media } from "./media";

export const socialNetworks = ["facebook", "instagram", "linkedin", "youtube", "tiktok"] as const;

export type SocialNetwork = (typeof socialNetworks)[number];

export type SettingsPhone = { label: Localized; number: string };

export type SettingsSocial = { network: SocialNetwork; url: string };

export type SettingsHero = {
  headline: Localized;
  subline: Localized | null;
  ctaLabel: Localized | null;
  ctaHref: string | null;
  filmId: string | null;
};

export const aiCrawlerPolicies = ["open", "search-only", "closed"] as const;

export type AiCrawlerPolicy = (typeof aiCrawlerPolicies)[number];

export type SettingsSeo = {
  googleVerification?: string;
  yandexVerification?: string;
  bingVerification?: string;
  aiCrawlers?: AiCrawlerPolicy;
  indexNowKey?: string;
};

export type SettingsTextOverrides = Record<string, Partial<Record<Locale, string>>>;

export const homeSectionKeys = [
  "services",
  "masters",
  "gallery",
  "reviews",
  "booking",
  "posts",
  "contact",
] as const;

export type HomeSectionKey = (typeof homeSectionKeys)[number];

export const customBlockLayouts = ["media-left", "media-right", "media-top", "background"] as const;

export type CustomBlockLayout = (typeof customBlockLayouts)[number];

export const customBlockTones = ["white", "light", "dark"] as const;

export type CustomBlockTone = (typeof customBlockTones)[number];

export const customBlockMediaKinds = ["none", "image", "video"] as const;

export type CustomBlockMediaKind = (typeof customBlockMediaKinds)[number];

export type SettingsCustomBlock = {
  eyebrow: Localized | null;
  body: Localized<RichTextDoc> | null;
  linkLabel: Localized | null;
  href: string | null;
  mediaKind: CustomBlockMediaKind;
  mediaId: string | null;
  posterId: string | null;
  autoplay: boolean;
  sound: boolean;
  layout: CustomBlockLayout;
  mediaWidth: number;
  tone: CustomBlockTone;
};

export type SettingsBuiltInSection = {
  key: HomeSectionKey;
  visible: boolean;
  title: Localized | null;
};

export type SettingsCustomSection = {
  key: "custom";
  id: string;
  visible: boolean;
  title: Localized | null;
  block: SettingsCustomBlock;
};

export type SettingsHomeSection = SettingsBuiltInSection | SettingsCustomSection;

export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    logoLightId: uuid("logo_light_id").references(() => media.id, { onDelete: "set null" }),
    logoDarkId: uuid("logo_dark_id").references(() => media.id, { onDelete: "set null" }),
    faviconId: uuid("favicon_id").references(() => media.id, { onDelete: "set null" }),
    phones: jsonb("phones").$type<SettingsPhone[]>().notNull().default([]),
    emails: jsonb("emails").$type<string[]>().notNull().default([]),
    address: localized("address"),
    mapUrl: text("map_url"),
    workingHours: localized("working_hours"),
    socials: jsonb("socials").$type<SettingsSocial[]>().notNull().default([]),
    hero: jsonb("hero").$type<SettingsHero>(),
    homeSections: jsonb("home_sections").$type<SettingsHomeSection[]>().notNull().default([]),
    whatsappNumber: text("whatsapp_number"),
    legalName: text("legal_name"),
    bookingNotifyEmail: text("booking_notify_email"),
    openingHours: text("opening_hours"),
    priceRange: text("price_range"),
    geoLatitude: numeric("geo_latitude", { precision: 9, scale: 6, mode: "number" }),
    geoLongitude: numeric("geo_longitude", { precision: 9, scale: 6, mode: "number" }),
    seoTitle: localized("seo_title"),
    seoDescription: localized("seo_description"),
    ogImageId: uuid("og_image_id").references(() => media.id, { onDelete: "set null" }),
    textOverrides: jsonb("text_overrides").$type<SettingsTextOverrides>().notNull().default({}),
    seo: jsonb("seo").$type<SettingsSeo>().notNull().default({}),
    searchIndexing: boolean("search_indexing").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("settings_single_row", sql`${t.id} = 1`)],
);
