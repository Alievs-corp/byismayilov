import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Localized } from "@/lib/i18n/localized";
import { formatPrice } from "@/lib/public/price";

import type { OgKind } from "./config";
import { companyName, serviceCategory } from "./facts";
import { localizedText, summaryText, type Corpus } from "./model";
import { clampText } from "./text";

export type OgCard = {
  title: string;
  eyebrow: string;
  subtitle: string;
  imageKey: string | null;
};

const titleMax = 96;
const subtitleMax = 120;

function card(title: string, eyebrow: string, subtitle: string, imageKey: string | null): OgCard {
  return {
    title: clampText(title, titleMax),
    eyebrow: clampText(eyebrow, 60),
    subtitle: clampText(subtitle, subtitleMax),
    imageKey,
  };
}

function matchSlug<T extends { slug: Localized }>(
  items: T[],
  locale: Locale,
  slug: string,
): T | undefined {
  return (
    items.find((item) => item.slug[locale] === slug) ?? items.find((item) => item.slug.az === slug)
  );
}

export function resolveOgCard(
  corpus: Corpus,
  dict: Dictionary,
  locale: Locale,
  kind: OgKind,
  slug: string,
): OgCard | null {
  const site = companyName(corpus);
  const firstImage = (images: { key: string }[]) => images[0]?.key ?? null;

  switch (kind) {
    case "home":
      return card(
        dict.meta.homeTitle,
        "",
        "",
        firstImage(corpus.services.flatMap((service) => service.images)),
      );
    case "services":
      return card(dict.services.title, site, dict.services.description, null);
    case "masters":
      return card(dict.masters.title, site, dict.masters.description, null);
    case "gallery":
      return card(dict.gallery.title, site, dict.gallery.description, null);
    case "contact":
      return card(dict.contact.title, site, dict.contact.description, null);
    case "booking":
      return card(dict.booking.title, site, dict.booking.description, null);
    case "blog":
      return card(dict.blog.title, site, dict.blog.description, null);
    case "service": {
      const service = matchSlug(corpus.services, locale, slug);
      if (!service) return null;
      const category = serviceCategory(corpus, service);
      const price = formatPrice(
        { kind: service.priceKind, amount: service.priceAmount },
        locale,
        dict.services,
      );
      return card(
        localizedText(service.name, locale),
        [category ? localizedText(category.name, locale) : null, price]
          .filter(Boolean)
          .join(" / ") || site,
        summaryText(service.shortDescription, service.description, locale, subtitleMax),
        firstImage(service.images),
      );
    }
    case "page": {
      const page = matchSlug(corpus.pages, locale, slug);
      if (!page) return null;
      return card(
        localizedText(page.title, locale),
        site,
        summaryText(page.content, null, locale, subtitleMax),
        page.cover?.key ?? null,
      );
    }
    case "post": {
      const post = matchSlug(corpus.posts, locale, slug);
      if (!post) return null;
      return card(
        localizedText(post.title, locale),
        dict.blog.title,
        localizedText(post.excerpt, locale),
        post.cover?.key ?? null,
      );
    }
  }
}
