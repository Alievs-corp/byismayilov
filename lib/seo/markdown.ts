import {
  isEmptyRichText,
  pickRichText,
  type RichTextDoc,
  type RichTextNode,
} from "@/lib/content/rich-text";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { pickLocale } from "@/lib/i18n/localized";
import { routes } from "@/lib/routes";

import { formatDuration, formatPrice } from "@/lib/public/price";

import {
  companyFactBlock,
  companyName,
  contactFacts,
  factBlockMarkdown,
  factLabels,
  serviceFactBlock,
} from "./facts";
import {
  hasLocale,
  localizedText,
  type Corpus,
  type CorpusCategory,
  type CorpusPage,
  type CorpusPost,
  type CorpusService,
} from "./model";

function inline(nodes: RichTextNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === "hardBreak") return "  \n";
      if (node.type === "image") return String(node.attrs?.alt ?? "");
      let text = node.text ?? inline(node.content);
      if (!text.trim()) return text;
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") text = `**${text}**`;
        else if (mark.type === "italic") text = `*${text}*`;
        else if (mark.type === "code") text = `\`${text}\``;
        else if (mark.type === "link" && typeof mark.attrs?.href === "string") {
          text = `[${text}](${mark.attrs.href})`;
        }
      }
      return text;
    })
    .join("");
}

function block(node: RichTextNode, depth: number, ordered = false, index = 0): string[] {
  const children = node.content ?? [];
  switch (node.type) {
    case "paragraph": {
      const text = inline(children).trim();
      return text ? [text, ""] : [];
    }
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 2)) + 2);
      return [`${"#".repeat(level)} ${inline(children).trim()}`, ""];
    }
    case "bulletList":
    case "orderedList":
      return [
        ...children.flatMap((item, itemIndex) =>
          block(item, depth, node.type === "orderedList", itemIndex),
        ),
        ...(depth === 0 ? [""] : []),
      ];
    case "listItem": {
      const [first, ...rest] = children;
      const marker = ordered ? `${index + 1}.` : "-";
      const head = first ? inline(first.content).trim() : "";
      const nested = rest.flatMap((child) => block(child, depth + 1).filter(Boolean));
      return [`${"  ".repeat(depth)}${marker} ${head}`, ...nested];
    }
    case "blockquote":
      return [
        ...children
          .flatMap((child) => block(child, depth))
          .filter(Boolean)
          .map((line) => `> ${line}`),
        "",
      ];
    case "horizontalRule":
      return ["---", ""];
    case "codeBlock":
      return ["```", inline(children), "```", ""];
    case "table": {
      const rows = children.map((row) =>
        (row.content ?? []).map((cell) =>
          inline(cell.content?.flatMap((p) => p.content ?? [])).trim(),
        ),
      );
      if (!rows.length) return [];
      const width = Math.max(...rows.map((row) => row.length));
      const pad = (row: string[]) => [...row, ...Array(width - row.length).fill("")];
      const [head = [], ...body] = rows;
      return [
        `| ${pad(head).join(" | ")} |`,
        `| ${Array(width).fill("---").join(" | ")} |`,
        ...body.map((row) => `| ${pad(row).join(" | ")} |`),
        "",
      ];
    }
    default:
      return children.flatMap((child) => block(child, depth));
  }
}

export function richTextToMarkdown(doc: RichTextDoc | null | undefined): string {
  if (isEmptyRichText(doc)) return "";
  return (doc?.content ?? [])
    .flatMap((node) => block(node, 0))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function pickMarkdown(field: Parameters<typeof pickRichText>[0], locale: Locale): string {
  return richTextToMarkdown(pickRichText(field, locale));
}

export type MarkdownContext = {
  corpus: Corpus;
  locale: Locale;
  dict: Dictionary;
  siteUrl: string;
};

type Context = MarkdownContext;

function tidy(lines: string[]): string {
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function absoluteRoute(context: Context, route: string): string {
  return new URL(localePath(context.locale, route), context.siteUrl).toString();
}

export function serviceUrl(context: Context, service: CorpusService): string {
  return absoluteRoute(context, routes.service(pickLocale(service.slug, context.locale)));
}

export function categoryUrl(context: Context, category: CorpusCategory): string {
  return `${absoluteRoute(context, routes.services())}#${pickLocale(category.slug, context.locale)}`;
}

export function pageUrl(context: Context, page: CorpusPage): string {
  return absoluteRoute(context, routes.page(pickLocale(page.slug, context.locale)));
}

export function postUrl(context: Context, post: CorpusPost): string {
  return absoluteRoute(context, routes.post(pickLocale(post.slug, context.locale)));
}

export function visibleServices(context: Context): CorpusService[] {
  return context.corpus.services.filter((service) => hasLocale(service.name, context.locale));
}

export function serviceLine(context: Context, service: CorpusService): string {
  const { locale, dict } = context;
  const price = formatPrice(
    { kind: service.priceKind, amount: service.priceAmount },
    locale,
    dict.services,
  );
  const duration = formatDuration(service.durationMinutes, dict.services);
  const note = [price, duration].filter(Boolean).join(", ");
  return `- [${localizedText(service.name, locale)}](${serviceUrl(context, service)}): ${note}`;
}

export function serviceMarkdown(
  context: Context,
  service: CorpusService,
  options: { level?: number } = {},
): string {
  const { corpus, locale, dict } = context;
  const level = options.level ?? 1;
  const facts = serviceFactBlock(corpus, service, locale, dict);
  const body = pickMarkdown(service.description, locale);
  const lines = [
    `${"#".repeat(Math.min(6, level))} ${localizedText(service.name, locale)}`,
    "",
    `URL: ${serviceUrl(context, service)}`,
    "",
    factBlockMarkdown(facts),
    "",
  ];
  if (body) lines.push(body, "");
  return tidy(lines);
}

export function servicesMarkdown(context: Context, options: { level?: number } = {}): string {
  const { corpus, locale, dict } = context;
  const level = options.level ?? 1;
  const h = (extra: number) => "#".repeat(Math.min(6, level + extra));
  const services = visibleServices(context);
  const lines = [
    `${h(0)} ${dict.services.title}`,
    "",
    `URL: ${absoluteRoute(context, routes.services())}`,
    "",
  ];
  const listed = new Set<string>();
  for (const category of corpus.categories.filter((item) => hasLocale(item.name, locale))) {
    const members = services.filter((service) => service.categoryIds.includes(category.id));
    if (!members.length) continue;
    members.forEach((service) => listed.add(service.id));
    lines.push(
      `${h(1)} ${localizedText(category.name, locale)}`,
      "",
      ...members.map((service) => serviceLine(context, service)),
      "",
    );
  }
  const rest = services.filter((service) => !listed.has(service.id));
  if (rest.length) {
    lines.push(
      `${h(1)} ${dict.services.other}`,
      "",
      ...rest.map((service) => serviceLine(context, service)),
      "",
    );
  }
  return tidy(lines);
}

export function mastersMarkdown(context: Context, options: { level?: number } = {}): string {
  const { corpus, locale, dict } = context;
  const level = options.level ?? 1;
  const h = (extra: number) => "#".repeat(Math.min(6, level + extra));
  const lines = [
    `${h(0)} ${dict.masters.title}`,
    "",
    `URL: ${absoluteRoute(context, routes.masters())}`,
    "",
  ];
  for (const master of corpus.masters.filter((item) => hasLocale(item.name, locale))) {
    const services = corpus.services
      .filter((service) => master.serviceIds.includes(service.id))
      .map((service) => localizedText(service.name, locale));
    lines.push(`${h(1)} ${localizedText(master.name, locale)}`, "");
    const role = localizedText(master.role, locale);
    if (role) lines.push(role, "");
    const bio = localizedText(master.bio, locale);
    if (bio) lines.push(bio, "");
    if (services.length) lines.push(`- ${factLabels[locale].services}: ${services.join(", ")}`);
    if (master.instagramUrl) lines.push(`- Instagram: ${master.instagramUrl}`);
    lines.push("");
  }
  return tidy(lines);
}

export function contactMarkdown(context: Context, options: { level?: number } = {}): string {
  const { corpus, locale, dict } = context;
  const heading = "#".repeat(Math.min(6, options.level ?? 1));
  const facts = contactFacts(corpus, locale, dict);
  const lines = [
    `${heading} ${dict.contact.title}`,
    "",
    `URL: ${absoluteRoute(context, routes.contact())}`,
    "",
  ];
  if (facts.length) lines.push(...facts.map((fact) => `- ${fact.label}: ${fact.value}`), "");
  if (corpus.settings.mapUrl) lines.push(`- ${dict.contact.map}: ${corpus.settings.mapUrl}`);
  for (const social of corpus.settings.socials) lines.push(`- ${social.network}: ${social.url}`);
  lines.push("", `${dict.booking.title}: ${absoluteRoute(context, routes.booking())}`);
  return tidy(lines);
}

export function bookingMarkdown(context: Context): string {
  const { dict } = context;
  return tidy([
    `# ${dict.booking.title}`,
    "",
    `URL: ${absoluteRoute(context, routes.booking())}`,
    "",
    dict.booking.intro,
  ]);
}

export function pageMarkdown(
  context: Context,
  page: CorpusPage,
  options: { level?: number } = {},
): string {
  const heading = "#".repeat(Math.min(6, options.level ?? 1));
  const body = pickMarkdown(page.content, context.locale);
  const lines = [
    `${heading} ${localizedText(page.title, context.locale)}`,
    "",
    `URL: ${pageUrl(context, page)}`,
    "",
  ];
  if (body) lines.push(body, "");
  return tidy(lines);
}

export function postMarkdown(
  context: Context,
  post: CorpusPost,
  options: { level?: number } = {},
): string {
  const heading = "#".repeat(Math.min(6, options.level ?? 1));
  const body = pickMarkdown(post.content, context.locale);
  const lines = [
    `${heading} ${localizedText(post.title, context.locale)}`,
    "",
    `URL: ${postUrl(context, post)}`,
    `${context.dict.blog.title}: ${post.publishedAt.slice(0, 10)}`,
    "",
  ];
  const excerpt = localizedText(post.excerpt, context.locale);
  if (excerpt) lines.push(excerpt, "");
  if (body) lines.push(body, "");
  return tidy(lines);
}

export function homeMarkdown(context: Context): string {
  const { corpus, locale, dict } = context;
  const company = companyFactBlock(corpus, locale, dict);
  const lines = [
    `# ${companyName(corpus)}`,
    "",
    `URL: ${absoluteRoute(context, routes.home())}`,
    "",
    factBlockMarkdown(company),
    "",
  ];
  const services = visibleServices(context);
  if (services.length) {
    lines.push(
      `## ${dict.services.title}`,
      "",
      ...services.map((service) => serviceLine(context, service)),
      "",
    );
  }
  lines.push(`${dict.booking.title}: ${absoluteRoute(context, routes.booking())}`);
  return tidy(lines);
}
