import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ArticleBody } from "@/components/site/article-body";
import { JsonLdScript } from "@/components/site/json-ld";
import { PageHeading } from "@/components/site/page-heading";
import { richTextToPlain, summarize } from "@/lib/content/rich-text";
import { env } from "@/lib/env";
import { localePath } from "@/lib/i18n/config";
import { pickLocale } from "@/lib/i18n/localized";
import { getRequestDictionary } from "@/lib/i18n/server";
import { getPageBySlug } from "@/lib/public/pages";
import { localizedPaths, redirectToCanonicalSlug } from "@/lib/public/slug";
import { routes } from "@/lib/routes";
import { entityInfo, getCorpus } from "@/lib/seo/corpus";
import { companyStatement } from "@/lib/seo/facts";
import { aboutPageJsonLd, businessJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { markdownHref } from "@/lib/seo/rewrites";
import { describeEntity } from "@/lib/seo/text";

export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[slug]">): Promise<Metadata> {
  await connection();
  const [{ slug }, { locale, dict }] = await Promise.all([params, getRequestDictionary()]);
  const page = await getPageBySlug(locale, slug);
  if (!page) notFound();
  redirectToCanonicalSlug(page.slug, locale, slug, routes.page);
  const info = await entityInfo("page", page.id);
  return pageMetadata({
    locale,
    title: page.seoTitle ?? page.title,
    absoluteTitle: Boolean(page.seoTitle),
    description: describeEntity({
      locale,
      name: page.title,
      admin: page.seoDescription,
      summary: summarize(richTextToPlain(page.content)),
      fallback: dict.meta.description,
    }),
    paths: localizedPaths(page.slug, routes.page),
    availableLocales: info.locales,
    og: { kind: "page", slug },
    markdownPath: markdownHref(localePath(locale, routes.page(slug))),
  });
}

export default async function CmsPage({ params }: PageProps<"/[locale]/[slug]">) {
  await connection();
  const [{ slug }, { locale, dict }] = await Promise.all([params, getRequestDictionary()]);
  const page = await getPageBySlug(locale, slug);
  if (!page) notFound();
  redirectToCanonicalSlug(page.slug, locale, slug, routes.page);
  const path = localePath(locale, routes.page(pickLocale(page.slug, locale)));
  const corpus = page.kind === "about" ? await getCorpus() : null;

  return (
    <>
      <PageHeading
        title={page.title}
        breadcrumbs={[
          { label: dict.common.home, href: localePath(locale) },
          { label: page.title, href: path },
        ]}
      />
      {page.cover ? (
        <div className="container-page">
          <div className="rounded-card bg-soft relative aspect-[4/3] overflow-clip sm:aspect-[16/9] lg:aspect-[21/9]">
            <Image
              src={page.cover.src}
              alt={page.cover.alt}
              fill
              sizes="(min-width: 1760px) 1664px, calc(100vw - 2rem)"
              loading="eager"
              className="object-cover"
            />
          </div>
        </div>
      ) : null}
      {page.content ? (
        <div className="container-page py-section">
          <ArticleBody doc={page.content} contentsLabel={dict.pages.contents} />
        </div>
      ) : null}
      {corpus ? (
        <JsonLdScript
          data={[
            ...businessJsonLd(corpus.settings, locale, env.NEXT_PUBLIC_SITE_URL, {
              description: companyStatement(corpus, locale, dict),
            }),
            aboutPageJsonLd({
              name: page.title,
              description: summarize(richTextToPlain(page.content)) || null,
              url: path,
              locale,
              siteUrl: env.NEXT_PUBLIC_SITE_URL,
            }),
          ]}
        />
      ) : null}
    </>
  );
}
