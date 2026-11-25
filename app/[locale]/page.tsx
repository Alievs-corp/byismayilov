import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { BookingBand } from "@/components/home/booking-band";
import { ContactBlock } from "@/components/home/contact-block";
import { HeroFilm } from "@/components/home/hero-film";
import { HeroPlaceholder } from "@/components/home/hero-placeholder";
import { MasterFeature } from "@/components/home/master-feature";
import { ReviewRail } from "@/components/home/review-rail";
import { ServiceRail } from "@/components/home/service-rail";
import { WorkMosaic } from "@/components/home/work-mosaic";
import { ArrowRightIcon } from "@/components/icons/iconsax";
import { Ornament } from "@/components/ornament/ornament";
import { FactBlockView } from "@/components/seo/fact-block";
import { button, buttonArrow, textLink } from "@/components/site/button";
import { hasContactDetails } from "@/components/site/contact-details";
import { JsonLdScript } from "@/components/site/json-ld";
import { RailControls } from "@/components/site/rail";
import { RichText } from "@/components/site/rich-text";
import { SectionHead } from "@/components/site/section-head";
import { cx } from "@/lib/cx";
import { env } from "@/lib/env";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
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

function Section({
  id,
  tone = "white",
  children,
}: {
  id: string;
  tone?: "white" | "cream";
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      data-home-section={id}
      className={cx("defer-render", tone === "cream" && "bg-cream")}
    >
      <div className="container-page py-section">{children}</div>
    </section>
  );
}

async function BuiltInSection({
  section,
  locale,
  dict,
  skipGalleryItem,
}: {
  section: Extract<HomeSection, { title: string | null }>;
  locale: Locale;
  dict: Dictionary;
  skipGalleryItem: string | null;
}) {
  const id = `home-${section.key}`;
  const booking = { label: dict.common.bookOnline, href: localePath(locale, routes.booking()) };
  switch (section.key) {
    case "services": {
      const services = await getFeaturedServices(locale);
      if (!services.length) return null;
      const rail = `${id}-rail`;
      return (
        <Section id={id}>
          <SectionHead
            id={id}
            title={section.title ?? dict.home.servicesTitle}
            ornament={
              <Ornament
                name="hair-strand"
                width={{ base: 96, md: 120, lg: 140 }}
                ink={1.2}
                className="text-caramel-ink"
              />
            }
            body={
              <>
                <p>{dict.home.servicesBody}</p>
                <Link
                  href={localePath(locale, routes.services())}
                  className={cx(textLink(), "mt-2")}
                >
                  {dict.common.allServices}
                </Link>
              </>
            }
            aside={
              <RailControls target={rail} previous={dict.common.previous} next={dict.common.next} />
            }
          />
          <div className="mt-12 lg:mt-16">
            <ServiceRail id={rail} services={services} locale={locale} dict={dict} />
          </div>
        </Section>
      );
    }
    case "masters": {
      const masters = (await getMasters(locale)).slice(0, 4);
      if (!masters.length) return null;
      return (
        <Section id={id} tone="cream">
          <MasterFeature
            id={id}
            title={section.title ?? dict.home.masterLabel}
            masters={masters}
            locale={locale}
            dict={dict}
          />
        </Section>
      );
    }
    case "gallery": {
      const items = (await getGalleryPreview(locale)).filter((item) => item.id !== skipGalleryItem);
      if (!items.length) return null;
      return (
        <Section id={id}>
          <SectionHead
            id={id}
            title={section.title ?? dict.home.galleryTitle}
            body={<p>{dict.home.galleryBody}</p>}
            aside={
              <Link href={localePath(locale, routes.gallery())} className={textLink()}>
                {dict.home.allWork}
                <ArrowRightIcon size={16} />
              </Link>
            }
          />
          <div className="mt-12 lg:mt-16">
            <WorkMosaic items={items} />
          </div>
        </Section>
      );
    }
    case "reviews": {
      const reviews = await getReviews(locale);
      if (!reviews.length) return null;
      const rail = `${id}-rail`;
      return (
        <Section id={id}>
          <SectionHead
            id={id}
            title={section.title ?? dict.home.reviewsTitle}
            aside={
              <RailControls target={rail} previous={dict.common.previous} next={dict.common.next} />
            }
          />
          <div className="mt-12">
            <ReviewRail id={rail} reviews={reviews} dict={dict} />
          </div>
        </Section>
      );
    }
    case "booking":
      return (
        <section aria-labelledby={id} data-home-section={id} className="defer-render">
          <div className="container-page py-section">
            <BookingBand
              id={id}
              title={section.title ?? dict.home.bookingTitle}
              body={dict.home.bookingBody}
              primary={booking}
            />
          </div>
        </section>
      );
    case "posts": {
      const posts = await getLatestPosts(locale);
      if (!posts.length) return null;
      return (
        <Section id={id}>
          <SectionHead
            id={id}
            title={section.title ?? dict.home.postsTitle}
            aside={
              <Link href={localePath(locale, routes.blog())} className={textLink()}>
                {dict.blog.back}
              </Link>
            }
          />
          <ul className="mt-12 border-t border-line">
            {posts.map((post) => (
              <li key={post.id} className="border-b border-line">
                <Link
                  href={post.href}
                  prefetch={false}
                  className="group/post flex min-h-20 items-center justify-between gap-6 py-5"
                >
                  <span className="font-display text-h3">{post.title}</span>
                  <ArrowRightIcon
                    size={24}
                    className="shrink-0 transition-transform duration-200 group-hover/post:translate-x-1"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      );
    }
    case "contact": {
      const settings = await getSiteSettings();
      if (!hasContactDetails(settings)) return null;
      return (
        <Section id={id} tone="cream">
          <ContactBlock
            id={id}
            title={section.title ?? dict.home.contactTitle}
            body={dict.home.contactBody}
            settings={settings}
            locale={locale}
            dict={dict}
            booking={booking}
          />
        </Section>
      );
    }
  }
}

function CustomSection({ id, block }: { id: string; block: CustomBlock }) {
  const dark = block.tone === "dark";
  return (
    <section
      aria-labelledby={block.title ? `custom-${id}` : undefined}
      className={dark ? "surface-dark" : block.tone === "light" ? "bg-cream" : undefined}
    >
      <div className="gap-x-column container-page grid gap-y-10 py-section lg:grid-cols-12">
        <div className={block.image || block.video ? "lg:col-span-6" : "lg:col-span-8"}>
          {block.eyebrow ? (
            <p className={cx("text-label uppercase", !dark && "text-caramel-ink")}>
              {block.eyebrow}
            </p>
          ) : null}
          {block.title ? (
            <h2 id={`custom-${id}`} className="mt-4 text-h2">
              {block.title}
            </h2>
          ) : null}
          {block.body ? <RichText doc={block.body} className="mt-6" /> : null}
          {block.link ? (
            <Link
              href={block.link.href}
              className={cx(button({ variant: dark ? "light" : "filled" }), "mt-8")}
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
              className="rounded-card h-auto w-full"
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
              className="rounded-card h-auto w-full"
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
  const [hero, sections, settings, requestHeaders, corpus, gallery] = await Promise.all([
    getHero(locale),
    getHomeSections(locale),
    getSiteSettings(),
    headers(),
    getCorpus(),
    getGalleryPreview(locale),
  ]);
  const saveData = requestHeaders.get("save-data")?.toLowerCase() === "on";
  const booking = { label: dict.hero.book, href: localePath(locale, routes.booking()) };
  const subjectItem = hero?.film ? null : (gallery.find((item) => item.image) ?? null);

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
          subline={hero?.subline ?? dict.hero.subline}
          primary={booking}
          secondary={{ label: dict.hero.services, href: localePath(locale, routes.services()) }}
          chips={[dict.hero.chipA, dict.hero.chipB].filter(Boolean)}
          subject={subjectItem?.image ?? null}
        />
      )}
      {sections
        .filter((section) => section.visible)
        .map((section) =>
          section.key === "custom" ? (
            <CustomSection key={section.id} id={section.id} block={section.block} />
          ) : (
            <BuiltInSection
              key={section.key}
              section={section}
              locale={locale}
              dict={dict}
              skipGalleryItem={subjectItem?.id ?? null}
            />
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
