import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { HeroFilm } from "@/components/home/hero-film";
import { HeroPlaceholder } from "@/components/home/hero-placeholder";
import { ArrowRightIcon } from "@/components/icons/iconsax";
import { FactBlockView } from "@/components/seo/fact-block";
import { button, buttonArrow } from "@/components/site/button";
import { ContactDetails, hasContactDetails } from "@/components/site/contact-details";
import { GalleryGrid } from "@/components/site/gallery-grid";
import { JsonLdScript } from "@/components/site/json-ld";
import { MasterCards } from "@/components/site/master-cards";
import { RichText } from "@/components/site/rich-text";
import { ServiceRows } from "@/components/site/service-list";
import { cx } from "@/lib/cx";
import { env } from "@/lib/env";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";
import { pickExact, pickLocale } from "@/lib/i18n/localized";
import { getRequestDictionary } from "@/lib/i18n/server";
import { getGalleryPreview } from "@/lib/public/gallery";
import {
  getHero,
  getHomeSections,
  getLatestPosts,
  type CustomBlock,
  type HomeSection,
} from "@/lib/public/home";
import { getMasters } from "@/lib/public/masters";
import { getReviews } from "@/lib/public/reviews";
import { getFeaturedServices } from "@/lib/public/services";
import { getSiteSettings } from "@/lib/public/settings";
import { staticPaths } from "@/lib/public/slug";
import { routes } from "@/lib/routes";
import { getCorpus } from "@/lib/seo/corpus";
import { companyFactBlock, companyStatement } from "@/lib/seo/facts";
import { businessJsonLd, websiteJsonLd, type OfferCatalogEntry } from "@/lib/seo/json-ld";
import { hasLocale, localizedText, type Corpus } from "@/lib/seo/model";
import { pageMetadata } from "@/lib/seo/metadata";
import { markdownHref } from "@/lib/seo/rewrites";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const [{ locale, dict }, settings] = await Promise.all([
    getRequestDictionary(),
    getSiteSettings(),
  ]);
  return pageMetadata({
    locale,
    title: pickExact(settings.seoTitle, locale) ?? dict.meta.homeTitle,
    absoluteTitle: true,
    description: pickExact(settings.seoDescription, locale) ?? dict.meta.description,
    paths: staticPaths(routes.home()),
    og: { kind: "home" },
    markdownPath: markdownHref(localePath(locale, routes.home())),
  });
}

function SectionShell({
  id,
  title,
  link,
  children,
}: {
  id: string;
  title: string;
  link?: { label: string; href: string } | null;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} data-home-section={id}>
      <div className="container-page py-section">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h2 id={id} className="text-h2">
            {title}
          </h2>
          {link ? (
            <Link
              href={link.href}
              className="inline-flex min-h-11 items-center text-small font-medium uppercase underline underline-offset-4"
            >
              {link.label}
            </Link>
          ) : null}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

async function BuiltInSection({
  section,
  locale,
  dict,
}: {
  section: Extract<HomeSection, { title: string | null }>;
  locale: Locale;
  dict: Dictionary;
}) {
  const id = `home-${section.key}`;
  switch (section.key) {
    case "services": {
      const services = await getFeaturedServices(locale);
      if (!services.length) return null;
      return (
        <SectionShell
          id={id}
          title={section.title ?? dict.home.servicesTitle}
          link={{ label: dict.common.allServices, href: localePath(locale, routes.services()) }}
        >
          <ServiceRows services={services} locale={locale} dict={dict} />
        </SectionShell>
      );
    }
    case "masters": {
      const masters = (await getMasters(locale)).slice(0, 3);
      if (!masters.length) return null;
      return (
        <SectionShell
          id={id}
          title={section.title ?? dict.home.mastersTitle}
          link={{ label: dict.masters.title, href: localePath(locale, routes.masters()) }}
        >
          <MasterCards masters={masters} locale={locale} dict={dict} headingLevel={3} />
        </SectionShell>
      );
    }
    case "gallery": {
      const items = await getGalleryPreview(locale);
      if (!items.length) return null;
      return (
        <SectionShell
          id={id}
          title={section.title ?? dict.home.galleryTitle}
          link={{ label: dict.gallery.title, href: localePath(locale, routes.gallery()) }}
        >
          <GalleryGrid items={items} dict={dict} />
        </SectionShell>
      );
    }
    case "reviews": {
      const reviews = await getReviews(locale);
      if (!reviews.length) return null;
      return (
        <SectionShell id={id} title={section.title ?? dict.home.reviewsTitle}>
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <li key={review.id} data-review="" className="border border-line p-6">
                <figure className="flex h-full flex-col gap-4">
                  <blockquote className="whitespace-pre-line">{review.body}</blockquote>
                  <figcaption className="mt-auto flex items-center gap-3 text-small">
                    {review.photo ? (
                      <Image
                        src={review.photo.src}
                        alt={review.photo.alt}
                        width={40}
                        height={40}
                        sizes="40px"
                        className="size-10 rounded-full object-cover"
                      />
                    ) : null}
                    <span>
                      <span className="block font-medium">{review.authorName}</span>
                      {review.rating ? (
                        <span className="text-ink-muted block">
                          {fill(dict.reviews.rating, { rating: review.rating })}
                        </span>
                      ) : null}
                    </span>
                    {review.sourceUrl ? (
                      <a
                        href={review.sourceUrl}
                        target="_blank"
                        rel="noopener nofollow"
                        className="ml-auto underline underline-offset-4"
                      >
                        {dict.reviews.source}
                      </a>
                    ) : null}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </SectionShell>
      );
    }
    case "booking":
      return (
        <section aria-labelledby={id} data-home-section={id} className="surface-dark">
          <div className="container-page flex flex-col items-start gap-6 py-section">
            <h2 id={id} className="text-h2">
              {section.title ?? dict.home.bookingTitle}
            </h2>
            <p className="max-w-2xl text-lead">{dict.home.bookingBody}</p>
            <Link
              href={localePath(locale, routes.booking())}
              className={button({ variant: "accent" })}
            >
              {dict.common.bookOnline}
              <ArrowRightIcon size={20} className={buttonArrow} />
            </Link>
          </div>
        </section>
      );
    case "posts": {
      const posts = await getLatestPosts(locale);
      if (!posts.length) return null;
      return (
        <SectionShell
          id={id}
          title={section.title ?? dict.home.postsTitle}
          link={{ label: dict.blog.back, href: localePath(locale, routes.blog()) }}
        >
          <ul className="border-t border-line">
            {posts.map((post) => (
              <li key={post.id} className="border-b border-line py-4">
                <Link href={post.href} prefetch={false} className="text-h4 hover:underline">
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        </SectionShell>
      );
    }
    case "contact": {
      const settings = await getSiteSettings();
      if (!hasContactDetails(settings)) return null;
      return (
        <SectionShell
          id={id}
          title={section.title ?? dict.home.contactTitle}
          link={{ label: dict.contact.title, href: localePath(locale, routes.contact()) }}
        >
          <ContactDetails settings={settings} locale={locale} dict={dict} />
        </SectionShell>
      );
    }
  }
}

function CustomSection({ id, block }: { id: string; block: CustomBlock }) {
  const dark = block.tone === "dark";
  return (
    <section
      aria-labelledby={block.title ? `custom-${id}` : undefined}
      className={dark ? "surface-dark" : block.tone === "light" ? "surface-soft" : undefined}
    >
      <div className="gap-x-column container-page grid gap-y-10 py-section lg:grid-cols-12">
        <div className={block.image || block.video ? "lg:col-span-6" : "lg:col-span-8"}>
          {block.eyebrow ? <p className="text-label uppercase">{block.eyebrow}</p> : null}
          {block.title ? (
            <h2 id={`custom-${id}`} className="mt-4 text-h2">
              {block.title}
            </h2>
          ) : null}
          {block.body ? <RichText doc={block.body} className="mt-6" /> : null}
          {block.link ? (
            <Link
              href={block.link.href}
              className={cx(button({ variant: dark ? "accent" : "filled" }), "mt-8")}
            >
              {block.link.label}
              <ArrowRightIcon size={20} className={buttonArrow} />
            </Link>
          ) : null}
        </div>
        {block.image ? (
          <div className="lg:col-span-6">
            <Image
              src={block.image.src}
              alt={block.image.alt}
              width={block.image.width}
              height={block.image.height}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="h-auto w-full"
            />
          </div>
        ) : block.video ? (
          <div className="lg:col-span-6">
            <video
              controls
              muted={!block.video.sound}
              playsInline
              preload="metadata"
              poster={block.poster?.src}
              aria-label={block.video.label ?? undefined}
              className="h-auto w-full"
            >
              <source src={block.video.src} type={block.video.type} />
            </video>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function offerCatalog(corpus: Corpus, locale: Locale): OfferCatalogEntry[] {
  const servicesPath = localePath(locale, routes.services());
  return corpus.categories
    .filter((category) => !category.parentId && hasLocale(category.name, locale))
    .map((category) => ({
      name: localizedText(category.name, locale),
      url: `${servicesPath}#${pickLocale(category.slug, locale)}`,
      items: corpus.services
        .filter(
          (service) => service.categoryIds.includes(category.id) && hasLocale(service.name, locale),
        )
        .map((service) => ({
          name: localizedText(service.name, locale),
          url: localePath(locale, routes.service(pickLocale(service.slug, locale))),
          price: { kind: service.priceKind, amount: service.priceAmount },
        })),
    }));
}

export default async function HomePage() {
  await connection();
  const { locale, dict } = await getRequestDictionary();
  const [hero, sections, settings, requestHeaders, corpus] = await Promise.all([
    getHero(locale),
    getHomeSections(locale),
    getSiteSettings(),
    headers(),
    getCorpus(),
  ]);
  const saveData = requestHeaders.get("save-data")?.toLowerCase() === "on";
  const booking = { label: dict.hero.book, href: localePath(locale, routes.booking()) };

  return (
    <>
      <JsonLdScript
        data={[
          ...businessJsonLd(settings, locale, env.NEXT_PUBLIC_SITE_URL, {
            description: companyStatement(corpus, locale, dict),
            hasOfferCatalog: offerCatalog(corpus, locale),
          }),
          websiteJsonLd({ locale, siteUrl: env.NEXT_PUBLIC_SITE_URL, name: settings.legalName }),
        ]}
      />
      {hero?.film ? (
        <HeroFilm
          hero={{ ...hero, cta: hero.cta ?? booking }}
          staticOnly={saveData}
          chapters={[]}
          panel={null}
        />
      ) : (
        <HeroPlaceholder
          brand={dict.meta.siteName}
          headline={hero?.headline || dict.hero.headline}
          subline={hero?.subline ?? null}
          primary={booking}
          secondary={{ label: dict.hero.services, href: localePath(locale, routes.services()) }}
        />
      )}
      {sections
        .filter((section) => section.visible)
        .map((section) =>
          section.key === "custom" ? (
            <CustomSection key={section.id} id={section.id} block={section.block} />
          ) : (
            <BuiltInSection key={section.key} section={section} locale={locale} dict={dict} />
          ),
        )}
      <div className="container-page py-section">
        <FactBlockView
          block={companyFactBlock(corpus, locale, dict)}
          className="border-t border-line pt-12 lg:pt-16"
        />
      </div>
    </>
  );
}
