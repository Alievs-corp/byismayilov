import { localePath, locales, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { routes } from "@/lib/routes";

import { languageName } from "./config";
import { companyFactBlock, companyName, companyStatement, factLabels } from "./facts";
import {
  absoluteRoute,
  contactMarkdown,
  mastersMarkdown,
  pageMarkdown,
  pageUrl,
  postMarkdown,
  postUrl,
  serviceLine,
  serviceMarkdown,
  servicesMarkdown,
  visibleServices,
} from "./markdown";
import { hasLocale, localizedText, type Corpus } from "./model";

export type LlmsContext = { corpus: Corpus; locale: Locale; dict: Dictionary; siteUrl: string };

export function llmsPath(locale: Locale, full = false): string {
  return localePath(locale, full ? "/llms-full.txt" : "/llms.txt");
}

function link(title: string, target: string, note?: string): string {
  return note ? `- [${title}](${target}): ${note}` : `- [${title}](${target})`;
}

function visible(context: LlmsContext) {
  const { corpus, locale } = context;
  return {
    services: visibleServices(context),
    masters: corpus.masters.filter((item) => hasLocale(item.name, locale)),
    pages: corpus.pages.filter((item) => hasLocale(item.title, locale)),
    posts: corpus.posts.filter((item) => hasLocale(item.title, locale)),
  };
}

function header(context: LlmsContext): string[] {
  const { corpus, locale, dict } = context;
  const company = companyFactBlock(corpus, locale, dict);
  return [
    `# ${companyName(corpus)}`,
    "",
    `> ${companyStatement(corpus, locale, dict)}`,
    "",
    ...company.facts.map((fact) => `- ${fact.label}: ${fact.value}`),
  ];
}

export function buildLlmsTxt(context: LlmsContext): string {
  const { corpus, locale, dict, siteUrl } = context;
  const absolute = (path: string) => new URL(path, siteUrl).toString();
  const items = visible(context);
  const labels = factLabels[locale];
  const lines = header(context);

  lines.push("", `## ${dict.meta.siteName}`, "");
  lines.push(
    link(dict.services.title, absoluteRoute(context, routes.services()), dict.services.description),
  );
  if (items.masters.length) {
    lines.push(
      link(dict.masters.title, absoluteRoute(context, routes.masters()), dict.masters.description),
    );
  }
  if (corpus.galleryUpdatedAt) {
    lines.push(
      link(dict.gallery.title, absoluteRoute(context, routes.gallery()), dict.gallery.description),
    );
  }
  lines.push(
    link(dict.booking.title, absoluteRoute(context, routes.booking()), dict.booking.description),
  );
  lines.push(
    link(dict.contact.title, absoluteRoute(context, routes.contact()), dict.contact.description),
  );
  for (const page of items.pages)
    lines.push(link(localizedText(page.title, locale), pageUrl(context, page)));

  if (items.services.length) {
    lines.push("", `## ${labels.services}`, "");
    for (const service of items.services) lines.push(serviceLine(context, service));
  }

  if (items.posts.length) {
    lines.push("", `## ${dict.blog.title}`, "");
    lines.push(
      link(dict.blog.title, absolute(localePath(locale, routes.blog())), dict.blog.description),
    );
    for (const post of items.posts)
      lines.push(link(localizedText(post.title, locale), postUrl(context, post)));
  }

  lines.push("", `## ${labels.languages}`, "");
  for (const code of locales) {
    lines.push(link(languageName(code, locale), absolute(llmsPath(code))));
  }

  lines.push(
    "",
    "## Optional",
    "",
    link(`${companyName(corpus)}: full text`, absolute(llmsPath(locale, true))),
  );
  lines.push(link("Sitemap", absolute("/sitemap.xml")));
  return `${lines.join("\n")}\n`;
}

export function buildLlmsFullTxt(context: LlmsContext): string {
  const { dict } = context;
  const items = visible(context);
  const lines = header(context);
  lines.push("", contactMarkdown(context, { level: 2 }), "");
  if (items.services.length) {
    lines.push(servicesMarkdown(context, { level: 2 }), "");
    for (const service of items.services)
      lines.push(serviceMarkdown(context, service, { level: 3 }), "");
  }
  if (items.masters.length) lines.push(mastersMarkdown(context, { level: 2 }), "");
  if (items.pages.length) {
    lines.push(`## ${dict.meta.siteName}`, "");
    for (const page of items.pages) lines.push(pageMarkdown(context, page, { level: 3 }), "");
  }
  if (items.posts.length) {
    lines.push(`## ${dict.blog.title}`, "");
    for (const post of items.posts) lines.push(postMarkdown(context, post, { level: 3 }), "");
  }
  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}
