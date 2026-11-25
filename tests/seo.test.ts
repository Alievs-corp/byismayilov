import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import {
  masterServices,
  masters,
  media,
  pages,
  posts,
  serviceCategories,
  serviceCategoryLinks,
  serviceImages,
  services,
} from "@/lib/db/schema";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { SiteSettings } from "@/lib/public/settings";
import { ogImagePath } from "@/lib/seo/config";
import { queryCorpus } from "@/lib/seo/corpus";
import { companyFactBlock, serviceFactBlock } from "@/lib/seo/facts";
import { changedUrls, indexNowBody, isPublicHost, snapshotOf } from "@/lib/seo/indexnow";
import {
  aboutPageJsonLd,
  blogPostingJsonLd,
  breadcrumbJsonLd,
  businessJsonLd,
  collectionPageJsonLd,
  contactPageJsonLd,
  faqPageJsonLd,
  offerCatalogJsonLd,
  offerJsonLd,
  organizationJsonLd,
  parseAddress,
  serializeJsonLd,
  serviceJsonLd,
  websiteJsonLd,
  type JsonLd,
} from "@/lib/seo/json-ld";
import { buildLlmsFullTxt, buildLlmsTxt } from "@/lib/seo/llms";
import { richTextToMarkdown, serviceMarkdown } from "@/lib/seo/markdown";
import { resolveMarkdown } from "@/lib/seo/markdown-route";
import { pageMetadata, paginatedPaths, paginatedText } from "@/lib/seo/metadata";
import type { Corpus, CorpusService } from "@/lib/seo/model";
import { resolveOgCard } from "@/lib/seo/og-card";
import { buildRobots } from "@/lib/seo/robots";
import { markdownHref, markdownRewrite, normalizePathname, seoRewrite } from "@/lib/seo/rewrites";
import { rootMetadata, verificationMetadata } from "@/lib/seo/root";
import { buildSitemap, buildSitemapUrls } from "@/lib/seo/sitemap";
import { seoSettingsSchema } from "@/lib/validation/settings";
import { clampText, describeEntity, fitDescription, fitTitle } from "@/lib/seo/text";
import { validateJsonLdNode } from "@/lib/seo/validate";

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  connection: async () => undefined,
}));

const siteUrl = "https://salon.example";

const paths = {
  az: "/xidmetler/sac-kesimi",
  ru: "/ru/xidmetler/strizhka",
  en: "/en/xidmetler/haircut",
};

const settings: SiteSettings = {
  logoLight: { src: "/media/logo.png", mimeType: "image/png", width: 465, height: 203, alt: null },
  logoDark: null,
  favicon: null,
  ogImage: null,
  phones: [{ label: { az: "Salon", ru: "Салон" }, number: "+994501234567" }],
  emails: ["salon@example.com"],
  address: {
    az: "[Küçə] 1, AZ1000, Bakı",
    ru: "[Улица] 1, AZ1000, Баку",
    en: "1 [Street], AZ1000, Baku",
  },
  mapUrl: "https://maps.google.com/?cid=1",
  workingHours: { az: "[İş saatları]" },
  openingHours: "Mo-Sa 10:00-20:00",
  priceRange: "[Qiymət aralığı]",
  geo: { latitude: 40.4093, longitude: 49.8671 },
  whatsappNumber: null,
  socials: [{ network: "instagram", url: "https://www.instagram.com/example" }],
  legalName: null,
  seoTitle: null,
  seoDescription: null,
  searchIndexing: true,
  seo: {},
};

function doc(text: string) {
  return {
    type: "doc" as const,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

const service: CorpusService = {
  id: "s1",
  slug: { az: "sac-kesimi", ru: "strizhka", en: "haircut" },
  name: { az: "[Saç kəsimi]", ru: "[Стрижка]", en: "[Haircut]" },
  shortDescription: { az: doc("[Qısa təsvir]. İkinci cümlə."), ru: doc("[Краткое описание].") },
  description: null,
  priceKind: "from",
  priceAmount: 30,
  durationMinutes: 60,
  categoryIds: ["c1"],
  images: [{ key: "a/sac.jpg", width: 800, height: 600, alt: { az: "Saç" }, caption: null }],
  seoTitle: null,
  seoDescription: null,
  updatedAt: "2026-11-01T10:00:00.000Z",
};

const corpus: Corpus = {
  settings,
  settingsUpdatedAt: "2026-10-01T10:00:00.000Z",
  galleryUpdatedAt: null,
  categories: [
    {
      id: "c1",
      parentId: null,
      slug: { az: "sac", ru: "volosy" },
      name: { az: "[Saç]", ru: "[Волосы]" },
      description: { az: doc("[Saç xidmətləri].") },
      seoTitle: null,
      seoDescription: null,
      image: null,
      updatedAt: "2026-10-15T10:00:00.000Z",
    },
  ],
  services: [service],
  masters: [
    {
      id: "m1",
      name: { az: "[Usta]", ru: "[Мастер]" },
      role: { az: "[Stilist]" },
      bio: null,
      instagramUrl: "https://www.instagram.com/master",
      serviceIds: ["s1"],
      photo: null,
      updatedAt: "2026-10-20T10:00:00.000Z",
    },
  ],
  pages: [
    {
      id: "g1",
      kind: "about",
      slug: { az: "haqqimizda", ru: "o-nas" },
      title: { az: "Haqqımızda", ru: "О нас" },
      content: null,
      cover: null,
      seoTitle: null,
      seoDescription: null,
      updatedAt: "2026-09-01T10:00:00.000Z",
    },
  ],
  posts: [],
};

type RobotsRule = {
  userAgent: string | string[];
  allow?: string;
  disallow?: string | string[];
};

function rulesOf(searchIndexing: boolean, policy: "open" | "search-only" | "closed"): RobotsRule[] {
  return buildRobots(searchIndexing, policy).rules as RobotsRule[];
}

function groupWith(rules: RobotsRule[], agent: string): RobotsRule | undefined {
  return rules.find((rule) => Array.isArray(rule.userAgent) && rule.userAgent.includes(agent));
}

describe("text fitting", () => {
  it("cuts at a word boundary and marks the cut", () => {
    expect(clampText("a ".repeat(100), 20).length).toBeLessThanOrEqual(20);
    expect(clampText("Qısa mətn", 50)).toBe("Qısa mətn");
    expect(clampText("Çox uzun başlıq burada davam edir", 20)).toMatch(/…$/);
  });

  it("limits Russian titles tighter than Latin ones and reserves room for the site name", () => {
    const long = "Комплексный уход за волосами с окрашиванием и укладкой для торжественных случаев";
    expect(fitTitle(long, "ru", 14).length).toBeLessThanOrEqual(41);
    expect(fitTitle(long, "en", 0).length).toBeLessThanOrEqual(60);
  });

  it("starts an entity description with its name, adds the summary and pads to a useful length", () => {
    const text = describeEntity({
      locale: "en",
      name: "[Haircut]",
      admin: "A short admin text.",
      summary: "A longer summary of the service that explains what happens during the visit.",
      fallback: "[Haircut] at the byismayilov salon. Price, duration and online booking.",
    });
    expect(text.startsWith("[Haircut]: A short admin text.")).toBe(true);
    expect(text.length).toBeGreaterThanOrEqual(90);
    expect(text.length).toBeLessThanOrEqual(155);
  });

  it("pads a short description from the next part and stays inside the limit", () => {
    const text = fitDescription(
      [
        "Qısa.",
        "Daha uzun ikinci cümlə burada, xidmətin nə olduğunu izah edir və sətri tamamlayır, ona görə də uzunluq kifayət edir.",
      ],
      "az",
    );
    expect(text.length).toBeGreaterThanOrEqual(90);
    expect(text.length).toBeLessThanOrEqual(155);
    expect(fitDescription([null, "  "], "en")).toBe("");
  });
});

describe("page metadata", () => {
  it("sets canonical, hreflang for translated locales with x-default and a large Twitter card", () => {
    const metadata = pageMetadata({
      locale: "ru",
      title: "Стрижка",
      description: "  Описание  ",
      paths,
      og: { kind: "service", slug: "strizhka" },
    });
    expect(metadata.alternates?.canonical).toBe("/ru/xidmetler/strizhka");
    expect(metadata.alternates?.languages).toEqual({
      ...paths,
      "x-default": "/xidmetler/sac-kesimi",
    });
    expect(metadata.description).toBe("Описание");
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title: "Стрижка" });
    expect(metadata.openGraph).toMatchObject({
      url: "/ru/xidmetler/strizhka",
      locale: "ru_RU",
      alternateLocale: ["az_AZ", "en_US"],
      siteName: "byismayilov",
      images: [{ url: "/og/ru/service/strizhka.png", width: 1200, height: 630 }],
    });
  });

  it("drops a missing translation from hreflang and points its page at the Azerbaijani one", () => {
    const metadata = pageMetadata({
      locale: "en",
      title: "Haircut",
      paths,
      availableLocales: ["az", "ru"],
    });
    expect(metadata.alternates?.canonical).toBe(paths.az);
    expect(metadata.alternates?.languages).toEqual({
      az: paths.az,
      ru: paths.ru,
      "x-default": paths.az,
    });
    expect(metadata.openGraph).toMatchObject({ alternateLocale: ["az_AZ", "ru_RU"] });
  });

  it("always has a social image: generated one, the page photo or the site default", () => {
    expect(pageMetadata({ locale: "az", title: "Saç", paths }).openGraph?.images).toEqual([
      { url: ogImagePath("az", "home"), alt: "Saç", width: 1200, height: 630 },
    ]);
    const photo = pageMetadata({
      locale: "az",
      title: "Saç",
      paths,
      image: { src: "/media/sac.jpg", width: 800, height: 600, alt: "" },
      absoluteTitle: true,
    });
    expect(photo.title).toEqual({ absolute: "Saç" });
    expect(photo.openGraph?.images).toEqual([
      { url: "/media/sac.jpg", alt: "Saç", width: 800, height: 600 },
    ]);
  });

  it("clamps long titles and descriptions per language", () => {
    const metadata = pageMetadata({
      locale: "ru",
      title: "Очень длинный заголовок страницы про комплексный уход за волосами и кожей",
      description: "слово ".repeat(60),
      paths,
    });
    expect(String(metadata.title).length).toBeLessThanOrEqual(41);
    expect(metadata.description?.length).toBeLessThanOrEqual(140);
  });

  it("advertises the Markdown alternate and article dates", () => {
    const metadata = pageMetadata({
      locale: "az",
      title: "Yazı",
      paths,
      markdownPath: "/xidmetler/sac-kesimi.md",
      type: "article",
      publishedTime: "2026-01-01T00:00:00.000Z",
      modifiedTime: "2026-02-01T00:00:00.000Z",
    });
    expect(metadata.alternates?.types).toEqual({ "text/markdown": "/xidmetler/sac-kesimi.md" });
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-01-01T00:00:00.000Z",
      modifiedTime: "2026-02-01T00:00:00.000Z",
    });
  });

  it("marks noindex pages and keeps paginated pages self-canonical with a page suffix", () => {
    expect(pageMetadata({ locale: "az", title: "X", paths, noIndex: true }).robots).toEqual({
      index: false,
      follow: true,
    });
    expect(paginatedPaths(paths, 1)).toBe(paths);
    expect(paginatedPaths(paths, 3).ru).toBe("/ru/xidmetler/strizhka?page=3");
    expect(paginatedText("Yazılar.", 2, "Səhifə 2")).toBe("Yazılar – Səhifə 2");
  });

  it("adds search engine verification tags only for the codes that are set", () => {
    expect(verificationMetadata({})).toBeUndefined();
    expect(
      verificationMetadata({
        googleVerification: "g-code",
        yandexVerification: "y-code",
        bingVerification: "b-code",
      }),
    ).toEqual({ google: "g-code", yandex: "y-code", other: { "msvalidate.01": "b-code" } });
    const root = rootMetadata({
      origin: siteUrl,
      siteName: "byismayilov",
      description: "d",
      searchIndexing: false,
      seo: { googleVerification: "g-code" },
    });
    expect(root.robots).toEqual({ index: false, follow: false });
    expect(root.verification).toEqual({ google: "g-code" });
  });
});

function validate(node: JsonLd): string[] {
  return validateJsonLdNode(node);
}

describe("JSON-LD builders", () => {
  it("builds one BeautySalon entity from settings, in the page locale", () => {
    const [business, ...rest] = businessJsonLd(settings, "ru", siteUrl, {
      description: "[Описание салона]",
      hasOfferCatalog: [
        {
          name: "[Волосы]",
          url: "/ru/xidmetler#volosy",
          items: [
            {
              name: "[Стрижка]",
              url: "/ru/xidmetler/strizhka",
              price: { kind: "exact", amount: 30 },
            },
          ],
        },
      ],
    });
    expect(rest).toEqual([]);
    expect(business).toMatchObject({
      "@type": "BeautySalon",
      "@id": `${siteUrl}/#organization`,
      name: "byismayilov",
      url: `${siteUrl}/ru`,
      telephone: "+994501234567",
      email: "salon@example.com",
      hasMap: "https://maps.google.com/?cid=1",
      openingHours: "Mo-Sa 10:00-20:00",
      priceRange: "[Qiymət aralığı]",
      geo: { "@type": "GeoCoordinates", latitude: 40.4093, longitude: 49.8671 },
      sameAs: ["https://www.instagram.com/example"],
      address: {
        "@type": "PostalAddress",
        streetAddress: "[Улица] 1",
        postalCode: "AZ1000",
        addressLocality: "Баку",
        addressCountry: "AZ",
      },
      logo: { "@type": "ImageObject", url: `${siteUrl}/media/logo.png`, width: 465, height: 203 },
      contactPoint: [expect.objectContaining({ telephone: "+994501234567", name: "Салон" })],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        itemListElement: [
          {
            "@type": "OfferCatalog",
            name: "[Волосы]",
            url: `${siteUrl}/ru/xidmetler#volosy`,
            itemListElement: [
              {
                "@type": "Offer",
                price: "30.00",
                priceCurrency: "AZN",
                itemOffered: { "@type": "Service", name: "[Стрижка]" },
              },
            ],
          },
        ],
      },
    });
    expect(validate(business as JsonLd)).toEqual([]);
    expect(JSON.stringify(business)).not.toMatch(/alternateName|aggregateRating|brand/);
  });

  it("falls back to a plain Organization when there is no address", () => {
    const data = organizationJsonLd({ ...settings, address: null }, "az", siteUrl);
    expect(data["@type"]).toBe("Organization");
    expect(data).not.toHaveProperty("address");
  });

  it("splits an address into the parts the text states and invents none", () => {
    expect(parseAddress("[Küçə] 1, AZ1000, Bakı")).toEqual({
      streetAddress: "[Küçə] 1",
      postalCode: "AZ1000",
      addressLocality: "Bakı",
    });
    expect(parseAddress("Somewhere 5")).toEqual({ streetAddress: "Somewhere 5" });
  });

  it("prices offers only when a price is published", () => {
    expect(offerJsonLd({ kind: "on_request", amount: null })).toBeNull();
    expect(offerJsonLd({ kind: "exact", amount: 25.5 })).toEqual({
      "@type": "Offer",
      price: "25.50",
      priceCurrency: "AZN",
    });
    expect(offerJsonLd({ kind: "from", amount: 30 })).toEqual({
      "@type": "Offer",
      priceCurrency: "AZN",
      priceSpecification: {
        "@type": "PriceSpecification",
        minPrice: "30.00",
        priceCurrency: "AZN",
      },
    });
    const catalog = offerCatalogJsonLd(
      "Xidmətlər",
      [
        {
          name: "[Saç]",
          url: "/xidmetler#sac",
          items: [
            { name: "[X]", url: "/xidmetler/x", price: { kind: "on_request", amount: null } },
          ],
        },
      ],
      siteUrl,
    );
    expect(JSON.stringify(catalog)).not.toContain("price");
  });

  it("describes a service with its offer, provider and images", () => {
    const data = serviceJsonLd(
      {
        name: "[Saç kəsimi]",
        url: "/xidmetler/sac-kesimi",
        images: ["/media/sac.jpg"],
        description: "[Təsvir]",
        category: "[Saç]",
        price: { kind: "from", amount: 30 },
      },
      siteUrl,
    );
    expect(data).toMatchObject({
      "@type": "Service",
      "@id": `${siteUrl}/xidmetler/sac-kesimi#service`,
      url: `${siteUrl}/xidmetler/sac-kesimi`,
      image: [`${siteUrl}/media/sac.jpg`],
      serviceType: "[Saç]",
      provider: { "@id": `${siteUrl}/#organization` },
      offers: {
        "@type": "Offer",
        priceCurrency: "AZN",
        priceSpecification: { minPrice: "30.00" },
        url: `${siteUrl}/xidmetler/sac-kesimi`,
      },
    });
    expect(validate(data)).toEqual([]);
    const onRequest = serviceJsonLd(
      {
        name: "[X]",
        url: "/xidmetler/x",
        images: [],
        description: null,
        category: null,
        price: { kind: "on_request", amount: null },
      },
      siteUrl,
    );
    expect(onRequest).not.toHaveProperty("offers");
    expect(validate(onRequest)).toEqual([]);
    expect(validate({ ...data, offers: { "@type": "Offer", priceCurrency: "USD" } })).toEqual([
      "Service offer is not priced in AZN",
      "Service offer has neither a price nor a minimum price",
    ]);
  });

  it("builds breadcrumbs, collection pages with item lists, about and contact pages", () => {
    const crumbs = breadcrumbJsonLd(
      [
        { label: "Ana səhifə", href: "/" },
        { label: "Xidmətlər", href: "/xidmetler" },
        { label: "Saç kəsimi" },
      ],
      siteUrl,
    );
    expect(validate(crumbs)).toEqual([]);
    expect(crumbs.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Ana səhifə", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Xidmətlər", item: `${siteUrl}/xidmetler` },
      { "@type": "ListItem", position: 3, name: "Saç kəsimi" },
    ]);

    const collection = collectionPageJsonLd({
      name: "Xidmətlər",
      url: "/xidmetler",
      locale: "az",
      siteUrl,
      items: [{ name: "Saç", url: "/xidmetler/sac-kesimi", image: "/media/sac.jpg" }],
    });
    expect(validate(collection)).toEqual([]);
    expect(collection.mainEntity).toMatchObject({
      "@type": "ItemList",
      numberOfItems: 1,
      itemListElement: [
        { position: 1, url: `${siteUrl}/xidmetler/sac-kesimi`, image: `${siteUrl}/media/sac.jpg` },
      ],
    });

    const about = aboutPageJsonLd({
      name: "Haqqımızda",
      url: "/haqqimizda",
      locale: "az",
      siteUrl,
    });
    const contact = contactPageJsonLd({ name: "Əlaqə", url: "/elaqe", locale: "az", siteUrl });
    expect(about).toMatchObject({
      "@type": "AboutPage",
      about: { "@id": `${siteUrl}/#organization` },
    });
    expect(contact).toMatchObject({
      "@type": "ContactPage",
      mainEntity: { "@id": `${siteUrl}/#organization` },
    });
    expect(validate(about)).toEqual([]);
    expect(validate(contact)).toEqual([]);
  });

  it("builds WebSite and BlogPosting with real dates and a publisher", () => {
    const site = websiteJsonLd({ locale: "en", siteUrl });
    expect(site).toMatchObject({
      "@type": "WebSite",
      name: "byismayilov",
      url: `${siteUrl}/en`,
      inLanguage: "en",
    });
    expect(site).not.toHaveProperty("potentialAction");
    expect(site).not.toHaveProperty("alternateName");
    const post = blogPostingJsonLd({
      headline: "Yazı",
      url: "/bloq/yazi",
      image: "/media/y.jpg",
      datePublished: "2026-01-01T00:00:00.000Z",
      dateModified: "2026-02-01T00:00:00.000Z",
      locale: "az",
      siteUrl,
      publisherName: "byismayilov",
      logo: "/media/logo.png",
    });
    expect(validate(post)).toEqual([]);
    expect(post).toMatchObject({
      dateModified: "2026-02-01T00:00:00.000Z",
      publisher: { logo: { url: `${siteUrl}/media/logo.png` } },
    });
  });

  it("emits FAQPage only when real questions exist", () => {
    expect(faqPageJsonLd([])).toBeNull();
    expect(faqPageJsonLd([{ question: " ", answer: "x" }])).toBeNull();
    const faq = faqPageJsonLd([{ question: "Q?", answer: "A." }]);
    expect(faq && validate(faq)).toEqual([]);
  });

  it("serialises without allowing a script break-out", () => {
    const text = serializeJsonLd({ "@type": "Thing", name: "</script><b>" });
    expect(text).not.toContain("</script>");
    expect(JSON.parse(text)).toMatchObject({ name: "</script><b>" });
  });
});

describe("SEO settings", () => {
  it("keeps only valid verification codes and defaults the AI policy to open", () => {
    expect(
      seoSettingsSchema.parse({ googleVerification: " abc_DEF-123 ", bingVerification: "" }),
    ).toEqual({
      googleVerification: "abc_DEF-123",
      aiCrawlers: "open",
    });
    expect(seoSettingsSchema.safeParse({ googleVerification: "<script>" }).success).toBe(false);
    expect(seoSettingsSchema.safeParse({ indexNowKey: "short" }).success).toBe(false);
    expect(
      seoSettingsSchema.parse({ indexNowKey: "abcdef0123456789", aiCrawlers: "closed" }),
    ).toEqual({
      indexNowKey: "abcdef0123456789",
      aiCrawlers: "closed",
    });
    expect(seoSettingsSchema.safeParse({ aiCrawlers: "everything" }).success).toBe(false);
  });
});

describe("robots.txt", () => {
  it("allows answer engines and user fetchers by default and names the sitemap", () => {
    const result = buildRobots(true);
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
    const rules = rulesOf(true, "open");
    expect(rules[0]).toEqual({ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/md/"] });
    const answers = groupWith(rules, "OAI-SearchBot");
    expect(answers?.userAgent).toEqual(
      expect.arrayContaining(["ChatGPT-User", "Claude-User", "PerplexityBot", "Perplexity-User"]),
    );
    expect(answers?.allow).toBe("/");
  });

  it("keeps training crawlers out under search-only and everything AI out under closed", () => {
    expect(groupWith(rulesOf(true, "open"), "GPTBot")?.disallow).toEqual([
      "/admin",
      "/api",
      "/md/",
    ]);
    expect(groupWith(rulesOf(true, "search-only"), "GPTBot")?.disallow).toBe("/");
    expect(groupWith(rulesOf(true, "search-only"), "ChatGPT-User")?.allow).toBe("/");
    const closed = rulesOf(true, "closed");
    expect(groupWith(closed, "ChatGPT-User")?.disallow).toBe("/");
    expect(closed[0]).toMatchObject({ userAgent: "*", allow: "/" });
  });

  it("keeps every crawler out while indexing is switched off", () => {
    expect(rulesOf(false, "open")).toEqual([{ userAgent: "*", disallow: "/" }]);
  });
});

describe("sitemap from a corpus", () => {
  it("lists translated locales only, with reciprocal alternates and x-default", () => {
    const urls = buildSitemapUrls(corpus, siteUrl);
    const serviceUrls = urls.filter((url) => /\/xidmetler\/[^/]+$/.test(url.loc));
    expect(serviceUrls.map((url) => url.loc)).toEqual([
      `${siteUrl}/xidmetler/sac-kesimi`,
      `${siteUrl}/ru/xidmetler/strizhka`,
      `${siteUrl}/en/xidmetler/haircut`,
    ]);
    for (const url of serviceUrls) {
      expect(url.languages).toEqual({
        az: `${siteUrl}/xidmetler/sac-kesimi`,
        ru: `${siteUrl}/ru/xidmetler/strizhka`,
        en: `${siteUrl}/en/xidmetler/haircut`,
        "x-default": `${siteUrl}/xidmetler/sac-kesimi`,
      });
      expect(Object.values(url.languages)).toContain(url.loc);
      expect(url.lastModified).toBe("2026-11-01T10:00:00.000Z");
      expect(url.images).toEqual([`${siteUrl}/media/a/sac.jpg`]);
    }
  });

  it("lists the fixed salon pages and leaves out empty sections", () => {
    const entries = buildSitemap(corpus, siteUrl).map((entry) => entry.url);
    for (const path of [
      "/",
      "/en",
      "/xidmetler",
      "/ustalar",
      "/qeydiyyat",
      "/elaqe",
      "/ru/elaqe",
    ]) {
      expect(entries, path).toContain(`${siteUrl}${path}`);
    }
    expect(entries.some((url) => url.includes("/bloq"))).toBe(false);
    expect(entries.some((url) => url.includes("/islerimiz"))).toBe(false);
    expect(
      buildSitemap({ ...corpus, galleryUpdatedAt: "2026-11-02T00:00:00.000Z" }, siteUrl).some(
        (entry) => entry.url === `${siteUrl}/islerimiz`,
      ),
    ).toBe(true);
  });

  it("uses the newest database date for the home page", () => {
    const entries = buildSitemap(corpus, siteUrl);
    expect(entries.find((entry) => entry.url === `${siteUrl}/`)?.lastModified).toBe(
      "2026-11-01T10:00:00.000Z",
    );
  });
});

describe("rewrites and normalisation", () => {
  it("maps Markdown addresses to the md route and back", () => {
    expect(markdownRewrite("/xidmetler/sac.md")).toBe("/md/az/xidmetler/sac");
    expect(markdownRewrite("/ru/xidmetler/strizhka.md")).toBe("/md/ru/xidmetler/strizhka");
    expect(markdownRewrite("/index.md")).toBe("/md/az");
    expect(markdownRewrite("/en/index.md")).toBe("/md/en");
    expect(markdownRewrite("/xidmetler/sac")).toBeNull();
    expect(markdownHref("/")).toBe("/index.md");
    expect(markdownHref("/ru")).toBe("/ru/index.md");
    expect(markdownHref("/ru/bloq?page=2")).toBe("/ru/bloq.md");
  });

  it("serves the IndexNow key file only for key-shaped root text files", () => {
    expect(seoRewrite("/0123456789abcdef.txt")).toBe("/indexnow-key/0123456789abcdef");
    expect(seoRewrite("/robots.txt")).toBeNull();
    expect(seoRewrite("/llms-full.txt")).toBeNull();
    expect(seoRewrite("/short.txt")).toBeNull();
  });

  it("collapses slashes and lower-cases ASCII letters without touching encoded bytes", () => {
    expect(normalizePathname("/Xidmetler/", true)).toBe("/xidmetler");
    expect(normalizePathname("//ru//Xidmetler//X", true)).toBe("/ru/xidmetler/x");
    expect(normalizePathname("/%D0%90B", true)).toBe("/%D0%90b");
    expect(normalizePathname("/AbCdEfGh12.txt", true)).toBe("/AbCdEfGh12.txt");
    expect(normalizePathname("/admin/Users/", false)).toBe("/admin/Users");
    expect(normalizePathname("/", true)).toBe("/");
  });
});

describe("generative engine files", () => {
  async function context(locale: "az" | "ru" | "en") {
    return { corpus, locale, dict: await getDictionary(locale), siteUrl };
  }

  it("builds llms.txt in the proposed shape with real facts, prices and language links", async () => {
    const text = buildLlmsTxt(await context("en"));
    expect(text).toMatch(/^# byismayilov\n\n> .+\n\n- /);
    expect(text).toContain("- Address: 1 [Street], AZ1000, Baku");
    expect(text).toMatch(/\n## [^\n]+\n\n- \[/);
    expect(text).toContain(`[[Haircut]](${siteUrl}/en/xidmetler/haircut): from 30 AZN, 60 min`);
    expect(text).toContain(`${siteUrl}/en/qeydiyyat`);
    expect(text).toContain(`${siteUrl}/ru/llms.txt`);
    expect(text).toContain(`${siteUrl}/en/llms-full.txt`);
    expect(text).toContain("## Optional");
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("leaves untranslated services out of a language file and keeps them in Azerbaijani", async () => {
    const untranslated = { ...corpus, services: [{ ...service, name: { az: "[Saç kəsimi]" } }] };
    const en = { ...(await context("en")), corpus: untranslated };
    expect(buildLlmsTxt(en)).not.toContain("/xidmetler/haircut");
    expect(buildLlmsTxt(await context("az"))).toContain(`${siteUrl}/xidmetler/sac-kesimi`);
  });

  it("builds llms-full.txt with contact, services by category and masters", async () => {
    const text = buildLlmsFullTxt(await context("az"));
    expect(text).toContain("## Əlaqə");
    expect(text).toContain("### [Saç]");
    expect(text).toContain("### [Saç kəsimi]");
    expect(text).toContain("- Qiymət: 30 AZN-dən");
    expect(text).toContain("- Müddət: 60 dəq");
    expect(text).toContain("## Ustalar");
    expect(text).toContain("- Xidmətlər: [Saç kəsimi]");
  });

  it("renders fact blocks from admin content with answer-first text", async () => {
    const dict = await getDictionary("az");
    const company = companyFactBlock(corpus, "az", dict);
    expect(company.answer).toBe(dict.meta.description);
    expect(company.facts).toEqual(
      expect.arrayContaining([
        { label: dict.contact.address, value: "[Küçə] 1, AZ1000, Bakı" },
        { label: "Qiymət aralığı", value: "[Qiymət aralığı]" },
        { label: "Xidmətlər", value: "1" },
        { label: "Sayt dilləri", value: "Azərbaycanca, Rusca, İngiliscə" },
      ]),
    );
    const block = serviceFactBlock(corpus, service, "az", dict);
    expect(block.answer).toBe("[Qısa təsvir]. İkinci cümlə.");
    expect(block.facts).toEqual([
      { label: "Qiymət", value: "30 AZN-dən" },
      { label: "Müddət", value: "60 dəq" },
      { label: "Kateqoriya", value: "[Saç]" },
      { label: "Ustalar", value: "[Usta]" },
    ]);
    const onRequest = serviceFactBlock(
      corpus,
      { ...service, priceKind: "on_request", priceAmount: null, durationMinutes: null },
      "ru",
      await getDictionary("ru"),
    );
    expect(onRequest.facts[0]).toEqual({ label: "Цена", value: "По договорённости" });
    expect(onRequest.facts.some((fact) => fact.label === "Длительность")).toBe(false);
  });

  it("converts rich text to Markdown", () => {
    expect(
      richTextToMarkdown({
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Başlıq" }] },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "qalın", marks: [{ type: "bold" }] },
              { type: "text", text: " və " },
              {
                type: "text",
                text: "link",
                marks: [{ type: "link", attrs: { href: "https://x.az" } }],
              },
            ],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "bir" }] }],
              },
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "iki" }] }],
              },
            ],
          },
        ],
      }),
    ).toBe("#### Başlıq\n\n**qalın** və [link](https://x.az)\n\n- bir\n- iki");
    expect(richTextToMarkdown(null)).toBe("");
  });

  it("resolves Markdown alternates for services, fixed pages and CMS pages, and nothing else", async () => {
    const ctx = await context("ru");
    const found = resolveMarkdown(ctx, ["xidmetler", "strizhka"]);
    expect(found?.canonical).toBe(`${siteUrl}/ru/xidmetler/strizhka`);
    expect(found?.body).toMatch(/^# \[Стрижка\]\n\nURL: /);
    expect(resolveMarkdown(ctx, ["xidmetler"])?.body).toContain("## [Волосы]");
    expect(resolveMarkdown(ctx, ["ustalar"])?.body).toContain("## [Мастер]");
    expect(resolveMarkdown(ctx, ["elaqe"])?.canonical).toBe(`${siteUrl}/ru/elaqe`);
    expect(resolveMarkdown(ctx, ["qeydiyyat"])?.body).toContain("# Онлайн-запись");
    expect(resolveMarkdown(ctx, ["o-nas"])?.body).toContain("# О нас");
    expect(resolveMarkdown(ctx, [])?.body).toContain("# byismayilov");
    expect(resolveMarkdown(ctx, ["xidmetler", "yoxdur"])).toBeNull();
    expect(resolveMarkdown(ctx, ["bloq"])).toBeNull();
    expect(resolveMarkdown(ctx, ["mehsullar", "x"])).toBeNull();
    expect(serviceMarkdown(ctx, service)).not.toContain("undefined");
  });

  it("builds the social card from the database fields of each kind", async () => {
    const dict = await getDictionary("ru");
    expect(resolveOgCard(corpus, dict, "ru", "service", "strizhka")).toMatchObject({
      title: "[Стрижка]",
      eyebrow: "[Волосы] / от 30 AZN",
      imageKey: "a/sac.jpg",
    });
    expect(resolveOgCard(corpus, dict, "ru", "service", "yoxdur")).toBeNull();
    expect(resolveOgCard(corpus, dict, "ru", "home", "default")?.title).toBe(dict.meta.homeTitle);
    for (const kind of ["services", "masters", "gallery", "contact", "booking", "blog"] as const) {
      expect(resolveOgCard(corpus, dict, "ru", kind, "default")?.eyebrow).toBe("byismayilov");
    }
  });
});

describe("IndexNow", () => {
  it("only reports addresses whose date changed, or that disappeared", () => {
    const before = snapshotOf(corpus, siteUrl);
    expect(changedUrls(before, before)).toEqual([]);
    const next = new Map(before);
    next.set(`${siteUrl}/xidmetler/sac-kesimi`, "2026-12-01T00:00:00.000Z");
    next.delete(`${siteUrl}/en/xidmetler/haircut`);
    expect(changedUrls(before, next).sort()).toEqual([
      `${siteUrl}/en/xidmetler/haircut`,
      `${siteUrl}/xidmetler/sac-kesimi`,
    ]);
  });

  it("on the first run only reports what changed in the last minutes", () => {
    const now = Date.parse("2026-11-01T10:05:00.000Z");
    const first = changedUrls(null, snapshotOf(corpus, siteUrl), now);
    expect(first).toContain(`${siteUrl}/xidmetler/sac-kesimi`);
    expect(first).not.toContain(`${siteUrl}/elaqe`);
  });

  it("builds the request body and refuses non-public hosts", () => {
    expect(indexNowBody(["https://salon.example/"], "abcdef12", "https://salon.example")).toEqual({
      host: "salon.example",
      key: "abcdef12",
      keyLocation: "https://salon.example/abcdef12.txt",
      urlList: ["https://salon.example/"],
    });
    expect(isPublicHost("https://salon.example")).toBe(true);
    expect(isPublicHost("http://localhost:3071")).toBe(false);
    expect(isPublicHost("http://127.0.0.1:3000")).toBe(false);
  });
});

describe("corpus from the database", () => {
  const run = randomUUID().slice(0, 8);
  const slug = (name: string) => `seo-${name}-${run}`;
  const created = {
    media: [] as string[],
    categories: [] as string[],
    services: [] as string[],
    masters: [] as string[],
    pages: [] as string[],
    posts: [] as string[],
  };
  let result: Corpus;
  const absolute = (path: string) => new URL(path, siteUrl).toString();

  beforeAll(async () => {
    const db = getDb();
    const [image] = await db
      .insert(media)
      .values({
        key: `test/${run}/seo.jpg`,
        mimeType: "image/jpeg",
        width: 800,
        height: 600,
        size: 1000,
        sha256: randomUUID(),
      })
      .returning({ id: media.id });
    created.media.push(image.id);

    const categoryRows = await db
      .insert(serviceCategories)
      .values([
        {
          slug: { az: slug("cat"), ru: slug("cat-ru") },
          name: { az: "Kateqoriya", ru: "Категория" },
        },
        { slug: { az: slug("hidden-cat") }, name: { az: "Gizli" }, isActive: false },
      ])
      .returning({ id: serviceCategories.id });
    created.categories.push(...categoryRows.map((row) => row.id));
    const [active, hidden] = created.categories;

    const serviceRows = await db
      .insert(services)
      .values([
        {
          slug: { az: slug("live"), en: slug("live-en") },
          name: { az: "Canlı", en: "Live" },
          status: "published",
          priceKind: "exact",
          priceAmount: 40,
        },
        { slug: { az: slug("draft") }, name: { az: "Qaralama" }, status: "draft" },
        {
          slug: { az: slug("deleted") },
          name: { az: "Silinmiş" },
          status: "published",
          deletedAt: new Date(),
        },
        { slug: { az: slug("hidden") }, name: { az: "Gizli" }, status: "published" },
      ])
      .returning({ id: services.id });
    created.services.push(...serviceRows.map((row) => row.id));
    const [live, draft, , inHidden] = created.services;
    await db.insert(serviceCategoryLinks).values([
      { serviceId: live, categoryId: active },
      { serviceId: inHidden, categoryId: hidden },
    ]);
    await db.insert(serviceImages).values({ serviceId: live, mediaId: image.id, position: 0 });
    const [master] = await db
      .insert(masters)
      .values({ name: { az: `Usta ${run}` }, role: { az: "Stilist" } })
      .returning({ id: masters.id });
    created.masters.push(master.id);
    await db.insert(masterServices).values([
      { masterId: master.id, serviceId: live },
      { masterId: master.id, serviceId: draft },
    ]);

    const pageRows = await db
      .insert(pages)
      .values([
        { slug: { az: slug("page") }, title: { az: "Səhifə" }, status: "published" },
        { slug: { az: slug("page-draft") }, title: { az: "Səhifə" }, status: "draft" },
      ])
      .returning({ id: pages.id });
    created.pages.push(...pageRows.map((row) => row.id));

    const postRows = await db
      .insert(posts)
      .values([
        {
          slug: { az: slug("post") },
          title: { az: "Yazı" },
          status: "published",
          publishedAt: new Date(Date.now() - 60_000),
        },
        {
          slug: { az: slug("post-future") },
          title: { az: "Gələcək" },
          status: "published",
          publishedAt: new Date(Date.now() + 86_400_000),
        },
        { slug: { az: slug("post-draft") }, title: { az: "Qaralama" }, status: "draft" },
      ])
      .returning({ id: posts.id });
    created.posts.push(...postRows.map((row) => row.id));

    result = await queryCorpus();
  });

  afterAll(async () => {
    const db = getDb();
    if (created.posts.length) await db.delete(posts).where(inArray(posts.id, created.posts));
    if (created.pages.length) await db.delete(pages).where(inArray(pages.id, created.pages));
    if (created.masters.length)
      await db.delete(masters).where(inArray(masters.id, created.masters));
    if (created.services.length)
      await db.delete(services).where(inArray(services.id, created.services));
    if (created.categories.length)
      await db.delete(serviceCategories).where(inArray(serviceCategories.id, created.categories));
    if (created.media.length) await db.delete(media).where(inArray(media.id, created.media));
  });

  it("reads services with prices, images and masters with published services only", () => {
    const live = result.services.find((item) => item.id === created.services[0]);
    expect(live).toMatchObject({ priceKind: "exact", priceAmount: 40 });
    expect(live?.images.map((image) => image.key)).toEqual([`test/${run}/seo.jpg`]);
    const master = result.masters.find((item) => item.id === created.masters[0]);
    expect(master?.serviceIds).toEqual([created.services[0]]);
  });

  it("lists published content in the sitemap with only the translated locales", () => {
    const urls = buildSitemap(result, siteUrl).map((entry) => entry.url);
    for (const path of [
      "/",
      "/ru",
      "/xidmetler",
      "/ustalar",
      "/qeydiyyat",
      "/elaqe",
      `/xidmetler/${slug("live")}`,
      `/en/xidmetler/${slug("live-en")}`,
      `/${slug("page")}`,
      "/bloq",
      `/bloq/${slug("post")}`,
    ]) {
      expect(urls, path).toContain(absolute(path));
    }
    expect(urls).not.toContain(absolute(`/ru/xidmetler/${slug("live")}`));
  });

  it("leaves out drafts, deleted, scheduled and hidden content", () => {
    const listed = buildSitemap(result, siteUrl)
      .map((entry) => entry.url)
      .join("\n");
    for (const name of [
      "draft",
      "deleted",
      "hidden",
      "hidden-cat",
      "page-draft",
      "post-future",
      "post-draft",
    ]) {
      expect(listed).not.toContain(`/${slug(name)}`);
    }
  });

  it("carries real lastmod dates, images and shared alternates", () => {
    const entry = buildSitemap(result, siteUrl).find(
      (item) => item.url === absolute(`/en/xidmetler/${slug("live-en")}`),
    );
    expect(entry?.alternates?.languages).toEqual({
      az: absolute(`/xidmetler/${slug("live")}`),
      en: absolute(`/en/xidmetler/${slug("live-en")}`),
      "x-default": absolute(`/xidmetler/${slug("live")}`),
    });
    expect(entry?.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry?.images).toEqual([absolute(`/media/test/${run}/seo.jpg`)]);
  });
});
