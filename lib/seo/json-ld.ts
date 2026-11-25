import { localePath, type Locale } from "@/lib/i18n/config";
import { pickLocale } from "@/lib/i18n/localized";
import type { SiteSettings } from "@/lib/public/settings";
import type { ServicePrice } from "@/lib/public/price";

import { siteName } from "./config";

export type JsonLd = { "@context"?: string; "@type": string | string[] } & Record<string, unknown>;

const context = "https://schema.org";

export function absoluteUrl(path: string, siteUrl: string): string {
  return new URL(path, siteUrl).toString();
}

export function organizationId(siteUrl: string): string {
  return `${absoluteUrl("/", siteUrl)}#organization`;
}

export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export type PostalParts = {
  streetAddress: string;
  postalCode?: string;
  addressLocality?: string;
};

const postalCodePattern = /^AZ\s?\d{4}$/i;
const cityPattern = /^(bakı|baku|баку)$/i;

export function parseAddress(text: string): PostalParts {
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const postalCode = parts.find((part) => postalCodePattern.test(part))?.replace(/\s/g, "");
  const addressLocality = parts.find((part) => cityPattern.test(part));
  const street = parts
    .filter((part) => !postalCodePattern.test(part) && !cityPattern.test(part))
    .join(", ");
  return {
    streetAddress: street || text.trim(),
    ...(postalCode ? { postalCode } : {}),
    ...(addressLocality ? { addressLocality } : {}),
  };
}

export type OfferCatalogEntry = {
  name: string;
  url: string;
  items?: { name: string; url: string; price: ServicePrice }[];
};

export type BusinessExtras = {
  description?: string | null;
  hasOfferCatalog?: OfferCatalogEntry[];
};

function logoObject(settings: SiteSettings, siteUrl: string): JsonLd | null {
  const logo = settings.logoLight ?? settings.logoDark;
  if (!logo) return null;
  return {
    "@type": "ImageObject",
    url: absoluteUrl(logo.src, siteUrl),
    ...(logo.width && logo.height ? { width: logo.width, height: logo.height } : {}),
  };
}

export const currency = "AZN";

export function offerJsonLd(price: ServicePrice, url?: string): JsonLd | null {
  if (price.kind === "on_request" || price.amount === null) return null;
  const amount = price.amount.toFixed(2);
  if (price.kind === "exact") {
    return {
      "@type": "Offer",
      price: amount,
      priceCurrency: currency,
      ...(url ? { url } : {}),
    };
  }
  return {
    "@type": "Offer",
    priceCurrency: currency,
    priceSpecification: {
      "@type": "PriceSpecification",
      minPrice: amount,
      priceCurrency: currency,
    },
    ...(url ? { url } : {}),
  };
}

export function offerCatalogJsonLd(
  name: string,
  entries: OfferCatalogEntry[],
  siteUrl: string,
): JsonLd {
  return {
    "@type": "OfferCatalog",
    name,
    itemListElement: entries.map((entry) => ({
      "@type": "OfferCatalog",
      name: entry.name,
      url: absoluteUrl(entry.url, siteUrl),
      ...(entry.items?.length
        ? {
            itemListElement: entry.items.map((item) => {
              const url = absoluteUrl(item.url, siteUrl);
              const offer = offerJsonLd(item.price, url);
              const service = { "@type": "Service", name: item.name, url };
              return offer
                ? { ...offer, itemOffered: service }
                : { "@type": "Offer", itemOffered: service };
            }),
          }
        : {}),
    })),
  };
}

export function organizationJsonLd(
  settings: SiteSettings,
  locale: Locale,
  siteUrl: string,
  input: BusinessExtras = {},
): JsonLd {
  const address = settings.address ? pickLocale(settings.address, locale).trim() : "";
  const [mainPhone] = settings.phones;
  const [mainEmail] = settings.emails;
  const logo = logoObject(settings, siteUrl);
  const data: JsonLd = {
    "@context": context,
    "@type": address ? "BeautySalon" : "Organization",
    "@id": organizationId(siteUrl),
    name: settings.legalName?.trim() || siteName,
    url: absoluteUrl(localePath(locale, "/"), siteUrl),
  };
  if (input.description) data.description = input.description;
  if (logo) {
    data.logo = logo;
    data.image = logo.url;
  }
  if (mainPhone) data.telephone = mainPhone.number;
  if (mainEmail) data.email = mainEmail;
  if (address) {
    data.address = {
      "@type": "PostalAddress",
      ...parseAddress(address),
      addressCountry: "AZ",
    };
  }
  if (settings.geo) {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: settings.geo.latitude,
      longitude: settings.geo.longitude,
    };
  }
  if (settings.openingHours) data.openingHours = settings.openingHours;
  if (settings.priceRange) data.priceRange = settings.priceRange;
  if (settings.mapUrl) data.hasMap = settings.mapUrl;
  if (settings.socials.length) data.sameAs = settings.socials.map((social) => social.url);
  if (settings.phones.length) {
    data.contactPoint = settings.phones.map((phone) => ({
      "@type": "ContactPoint",
      telephone: phone.number,
      name: pickLocale(phone.label, locale),
      contactType: "reservations",
      areaServed: "AZ",
      ...(mainEmail ? { email: mainEmail } : {}),
    }));
  }
  if (input.hasOfferCatalog?.length) {
    data.hasOfferCatalog = offerCatalogJsonLd(siteName, input.hasOfferCatalog, siteUrl);
  }
  return data;
}

export function businessJsonLd(
  settings: SiteSettings,
  locale: Locale,
  siteUrl: string,
  input: BusinessExtras = {},
): JsonLd[] {
  return [organizationJsonLd(settings, locale, siteUrl, input)];
}

export function websiteJsonLd(input: {
  locale: Locale;
  siteUrl: string;
  name?: string | null;
}): JsonLd {
  return {
    "@context": context,
    "@type": "WebSite",
    "@id": `${absoluteUrl("/", input.siteUrl)}#website`,
    name: input.name?.trim() || siteName,
    url: absoluteUrl(localePath(input.locale, "/"), input.siteUrl),
    inLanguage: input.locale,
    publisher: { "@id": organizationId(input.siteUrl) },
  };
}

export type BreadcrumbItem = { label: string; href?: string | null };

export function breadcrumbJsonLd(items: BreadcrumbItem[], siteUrl: string): JsonLd {
  return {
    "@context": context,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href, siteUrl) } : {}),
    })),
  };
}

export type ListedItem = { name: string; url: string; image?: string | null };

export function collectionPageJsonLd(input: {
  name: string;
  description?: string | null;
  url: string;
  locale: Locale;
  siteUrl: string;
  items?: ListedItem[];
}): JsonLd {
  const url = absoluteUrl(input.url, input.siteUrl);
  return {
    "@context": context,
    "@type": "CollectionPage",
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    url,
    inLanguage: input.locale,
    isPartOf: { "@id": `${absoluteUrl("/", input.siteUrl)}#website` },
    ...(input.items?.length
      ? {
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: input.items.length,
            itemListElement: input.items.map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: item.name,
              url: absoluteUrl(item.url, input.siteUrl),
              ...(item.image ? { image: absoluteUrl(item.image, input.siteUrl) } : {}),
            })),
          },
        }
      : {}),
  };
}

export function aboutPageJsonLd(input: {
  name: string;
  description?: string | null;
  url: string;
  locale: Locale;
  siteUrl: string;
}): JsonLd {
  return {
    "@context": context,
    "@type": "AboutPage",
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    url: absoluteUrl(input.url, input.siteUrl),
    inLanguage: input.locale,
    about: { "@id": organizationId(input.siteUrl) },
  };
}

export function contactPageJsonLd(input: {
  name: string;
  description?: string | null;
  url: string;
  locale: Locale;
  siteUrl: string;
}): JsonLd {
  return {
    "@context": context,
    "@type": "ContactPage",
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    url: absoluteUrl(input.url, input.siteUrl),
    inLanguage: input.locale,
    mainEntity: { "@id": organizationId(input.siteUrl) },
  };
}

export function blogPostingJsonLd(input: {
  headline: string;
  description?: string | null;
  url: string;
  image?: string | null;
  datePublished: string;
  dateModified?: string | null;
  locale: Locale;
  siteUrl: string;
  publisherName: string;
  logo?: string | null;
}): JsonLd {
  const publisher: JsonLd = {
    "@type": "Organization",
    name: input.publisherName,
    url: absoluteUrl("/", input.siteUrl),
    ...(input.logo
      ? { logo: { "@type": "ImageObject", url: absoluteUrl(input.logo, input.siteUrl) } }
      : {}),
  };
  return {
    "@context": context,
    "@type": "BlogPosting",
    headline: input.headline,
    ...(input.description ? { description: input.description } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(input.url, input.siteUrl) },
    ...(input.image ? { image: [absoluteUrl(input.image, input.siteUrl)] } : {}),
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    inLanguage: input.locale,
    author: publisher,
    publisher,
  };
}

export type ServiceJsonLdInput = {
  name: string;
  url: string;
  images: string[];
  description: string | null;
  category: string | null;
  price: ServicePrice;
};

export function serviceJsonLd(input: ServiceJsonLdInput, siteUrl: string): JsonLd {
  const url = absoluteUrl(input.url, siteUrl);
  const data: JsonLd = {
    "@context": context,
    "@type": "Service",
    "@id": `${url}#service`,
    name: input.name,
    url,
    provider: { "@id": organizationId(siteUrl) },
    areaServed: { "@type": "Country", name: "Azerbaijan" },
  };
  if (input.images.length) data.image = input.images.map((src) => absoluteUrl(src, siteUrl));
  if (input.description) data.description = input.description;
  if (input.category) data.serviceType = input.category;
  const offer = offerJsonLd(input.price, url);
  if (offer) data.offers = offer;
  return data;
}

export function faqPageJsonLd(items: { question: string; answer: string }[]): JsonLd | null {
  const usable = items.filter((item) => item.question.trim() && item.answer.trim());
  if (!usable.length) return null;
  return {
    "@context": context,
    "@type": "FAQPage",
    mainEntity: usable.map((item) => ({
      "@type": "Question",
      name: item.question.trim(),
      acceptedAnswer: { "@type": "Answer", text: item.answer.trim() },
    })),
  };
}
