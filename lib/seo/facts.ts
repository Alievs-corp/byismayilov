import { pickExact } from "@/lib/i18n/localized";
import { locales, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";
import { formatDuration, formatPrice } from "@/lib/public/price";

import { languageName, siteName } from "./config";
import {
  hasLocale,
  localizedText,
  summaryText,
  type Corpus,
  type CorpusCategory,
  type CorpusService,
} from "./model";

export type Fact = { label: string; value: string };

export type FactBlock = {
  id: string;
  heading: string;
  answer: string;
  facts: Fact[];
};

type FactLabels = {
  keyFacts: string;
  languages: string;
  servicesCount: string;
  mastersCount: string;
  priceRange: string;
  category: string;
  services: string;
  masters: string;
};

export const factLabels: Record<Locale, FactLabels> = {
  az: {
    keyFacts: "Əsas faktlar",
    languages: "Sayt dilləri",
    servicesCount: "Xidmətlər",
    mastersCount: "Ustalar",
    priceRange: "Qiymət aralığı",
    category: "Kateqoriya",
    services: "Xidmətlər",
    masters: "Ustalar",
  },
  ru: {
    keyFacts: "Ключевые факты",
    languages: "Языки сайта",
    servicesCount: "Услуг",
    mastersCount: "Мастеров",
    priceRange: "Диапазон цен",
    category: "Категория",
    services: "Услуги",
    masters: "Мастера",
  },
  en: {
    keyFacts: "Key facts",
    languages: "Site languages",
    servicesCount: "Services",
    mastersCount: "Masters",
    priceRange: "Price range",
    category: "Category",
    services: "Services",
    masters: "Masters",
  },
};

const answerLimit = 260;

export function companyName(corpus: Corpus): string {
  return corpus.settings.legalName?.trim() || siteName;
}

export function companyStatement(corpus: Corpus, locale: Locale, dict: Dictionary): string {
  return pickExact(corpus.settings.seoDescription, locale) ?? dict.meta.description;
}

export function contactFacts(corpus: Corpus, locale: Locale, dict: Dictionary): Fact[] {
  const { settings } = corpus;
  const rows: Fact[] = [];
  const address = localizedText(settings.address, locale);
  if (address) rows.push({ label: dict.contact.address, value: address });
  for (const phone of settings.phones) {
    rows.push({
      label: localizedText(phone.label, locale) || dict.contact.phone,
      value: phone.number,
    });
  }
  if (settings.emails.length) {
    rows.push({ label: dict.contact.email, value: settings.emails.join(", ") });
  }
  const hours = localizedText(settings.workingHours, locale);
  if (hours) rows.push({ label: dict.contact.hours, value: hours });
  return rows;
}

export function companyFactBlock(corpus: Corpus, locale: Locale, dict: Dictionary): FactBlock {
  const labels = factLabels[locale];
  const rows: Fact[] = contactFacts(corpus, locale, dict);
  if (corpus.settings.priceRange) {
    rows.push({ label: labels.priceRange, value: corpus.settings.priceRange });
  }
  if (corpus.services.length) {
    rows.push({ label: labels.servicesCount, value: String(corpus.services.length) });
  }
  if (corpus.masters.length) {
    rows.push({ label: labels.mastersCount, value: String(corpus.masters.length) });
  }
  rows.push({
    label: labels.languages,
    value: locales.map((code) => languageName(code, locale)).join(", "),
  });
  return {
    id: "company-facts",
    heading: `${companyName(corpus)}: ${labels.keyFacts}`,
    answer: companyStatement(corpus, locale, dict),
    facts: rows,
  };
}

export function serviceCategory(corpus: Corpus, service: CorpusService): CorpusCategory | null {
  const id = service.categoryIds[0];
  return corpus.categories.find((category) => category.id === id) ?? null;
}

export function serviceMasters(corpus: Corpus, service: CorpusService, locale: Locale): string[] {
  return corpus.masters
    .filter((master) => master.serviceIds.includes(service.id) && hasLocale(master.name, locale))
    .map((master) => localizedText(master.name, locale));
}

export function serviceFactBlock(
  corpus: Corpus,
  service: CorpusService,
  locale: Locale,
  dict: Dictionary,
): FactBlock {
  const labels = factLabels[locale];
  const name = localizedText(service.name, locale);
  const category = serviceCategory(corpus, service);
  const rows: Fact[] = [
    {
      label: dict.services.price,
      value: formatPrice(
        { kind: service.priceKind, amount: service.priceAmount },
        locale,
        dict.services,
      ),
    },
  ];
  const duration = formatDuration(service.durationMinutes, dict.services);
  if (duration) rows.push({ label: dict.services.duration, value: duration });
  if (category) rows.push({ label: labels.category, value: localizedText(category.name, locale) });
  const masters = serviceMasters(corpus, service, locale);
  if (masters.length) rows.push({ label: labels.masters, value: masters.join(", ") });
  return {
    id: "service-facts",
    heading: `${name}: ${labels.keyFacts}`,
    answer:
      summaryText(service.shortDescription, service.description, locale, answerLimit) ||
      fill(dict.services.detailDescription, { name }),
    facts: rows,
  };
}

export function factBlockMarkdown(block: FactBlock): string {
  return [
    `**${block.answer}**`,
    "",
    ...block.facts.map((fact) => `- ${fact.label}: ${fact.value}`),
  ].join("\n");
}
