import { localePath } from "@/lib/i18n/config";
import { pickLocale, type Localized } from "@/lib/i18n/localized";
import { routes } from "@/lib/routes";

import { buildLlmsTxt, type LlmsContext } from "./llms";
import {
  bookingMarkdown,
  contactMarkdown,
  homeMarkdown,
  mastersMarkdown,
  pageMarkdown,
  postMarkdown,
  serviceMarkdown,
  servicesMarkdown,
} from "./markdown";
import { hasLocale } from "./model";

type Match = { body: string; canonical: string };

const segment = (path: string) => path.split("/")[1] ?? "";

const routeSegments = {
  services: segment(routes.services()),
  masters: segment(routes.masters()),
  gallery: segment(routes.gallery()),
  contact: segment(routes.contact()),
  booking: segment(routes.booking()),
  blog: segment(routes.blog()),
};

function bySlug<T extends { slug: Localized }>(
  items: T[],
  locale: LlmsContext["locale"],
  slug: string,
): T | undefined {
  return (
    items.find((item) => item.slug[locale] === slug) ?? items.find((item) => item.slug.az === slug)
  );
}

export function resolveMarkdown(context: LlmsContext, path: string[]): Match | null {
  const { corpus, locale, siteUrl } = context;
  const canonical = (route: string) => new URL(localePath(locale, route), siteUrl).toString();
  const [first, second, ...extra] = path;
  if (extra.length) return null;

  if (!first) return { body: `${homeMarkdown(context)}\n`, canonical: canonical(routes.home()) };

  if (first === routeSegments.services && second) {
    const service = bySlug(corpus.services, locale, second);
    if (!service || !hasLocale(service.name, locale)) return null;
    return {
      body: `${serviceMarkdown(context, service)}\n`,
      canonical: canonical(routes.service(pickLocale(service.slug, locale))),
    };
  }
  if (first === routeSegments.blog && second) {
    const post = bySlug(corpus.posts, locale, second);
    if (!post || !hasLocale(post.title, locale)) return null;
    return {
      body: `${postMarkdown(context, post)}\n`,
      canonical: canonical(routes.post(pickLocale(post.slug, locale))),
    };
  }
  if (second) return null;
  switch (first) {
    case routeSegments.services:
      return { body: `${servicesMarkdown(context)}\n`, canonical: canonical(routes.services()) };
    case routeSegments.masters:
      return { body: `${mastersMarkdown(context)}\n`, canonical: canonical(routes.masters()) };
    case routeSegments.contact:
      return { body: `${contactMarkdown(context)}\n`, canonical: canonical(routes.contact()) };
    case routeSegments.booking:
      return { body: `${bookingMarkdown(context)}\n`, canonical: canonical(routes.booking()) };
    case routeSegments.gallery:
      return { body: buildLlmsTxt(context), canonical: canonical(routes.gallery()) };
    case routeSegments.blog:
      return corpus.posts.length
        ? { body: buildLlmsTxt(context), canonical: canonical(routes.blog()) }
        : null;
  }
  const page = bySlug(corpus.pages, locale, first);
  if (!page || !hasLocale(page.title, locale)) return null;
  return {
    body: `${pageMarkdown(context, page)}\n`,
    canonical: canonical(routes.page(pickLocale(page.slug, locale))),
  };
}
