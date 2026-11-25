import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { CSSProperties } from "react";

import { ArrowRightIcon } from "@/components/icons/iconsax";
import { ServiceRail } from "@/components/home/service-rail";
import { FactBlockView } from "@/components/seo/fact-block";
import { button, buttonArrow, card, textLink } from "@/components/site/button";
import { BreadcrumbData } from "@/components/site/breadcrumbs";
import { FitHeading } from "@/components/site/fit-heading";
import { JsonLdScript } from "@/components/site/json-ld";
import { RichText } from "@/components/site/rich-text";
import { SectionHead } from "@/components/site/section-head";
import { richTextToPlain, summarize } from "@/lib/content/rich-text";
import { env } from "@/lib/env";
import { localePath } from "@/lib/i18n/config";
import { fill } from "@/lib/i18n/format";
import { getRequestDictionary } from "@/lib/i18n/server";
import { formatDuration, formatPrice } from "@/lib/public/price";
import {
  getServiceBySlug,
  getServiceMenu,
  type ServiceGroup,
  type ServiceListItem,
  type ServiceMenu,
} from "@/lib/public/services";
import { localizedPaths, redirectToCanonicalSlug } from "@/lib/public/slug";
import { routes } from "@/lib/routes";
import { entityInfo, getCorpus } from "@/lib/seo/corpus";
import { serviceFactBlock } from "@/lib/seo/facts";
import { serviceJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { markdownHref } from "@/lib/seo/rewrites";
import { describeEntity } from "@/lib/seo/text";

export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/xidmetler/[slug]">): Promise<Metadata> {
  await connection();
  const [{ slug }, { locale, dict }] = await Promise.all([params, getRequestDictionary()]);
  const service = await getServiceBySlug(locale, slug);
  if (!service) notFound();
  redirectToCanonicalSlug(service.slug, locale, slug, routes.service);
  const info = await entityInfo("service", service.id);
  return pageMetadata({
    locale,
    title: service.seoTitle ?? service.name,
    absoluteTitle: Boolean(service.seoTitle),
    description: describeEntity({
      locale,
      name: service.name,
      admin: service.seoDescription,
      summary: service.summary,
      fallback: fill(dict.services.detailDescription, { name: service.name }),
    }),
    paths: localizedPaths(service.slug, routes.service),
    availableLocales: info.locales,
    og: { kind: "service", slug },
    markdownPath: markdownHref(localePath(locale, routes.service(slug))),
  });
}

function flatten(group: ServiceGroup): ServiceListItem[] {
  return [...group.services, ...group.children.flatMap(flatten)];
}

function relatedServices(menu: ServiceMenu, serviceId: string, limit: number): ServiceListItem[] {
  const all = [...menu.groups.flatMap(flatten), ...menu.other];
  const own = menu.groups.find((group) => flatten(group).some((item) => item.id === serviceId));
  const siblings = (own ? flatten(own) : []).filter((item) => item.id !== serviceId);
  const rest = all.filter(
    (item) => item.id !== serviceId && !siblings.some((sibling) => sibling.id === item.id),
  );
  return [...siblings, ...rest].slice(0, limit);
}

export default async function ServicePage({ params }: PageProps<"/[locale]/xidmetler/[slug]">) {
  await connection();
  const [{ slug }, { locale, dict }] = await Promise.all([params, getRequestDictionary()]);
  const service = await getServiceBySlug(locale, slug);
  if (!service) notFound();
  redirectToCanonicalSlug(service.slug, locale, slug, routes.service);
  const [corpus, menu] = await Promise.all([getCorpus(), getServiceMenu(locale)]);
  const corpusService = corpus.services.find((item) => item.id === service.id);
  const servicesPath = localePath(locale, routes.services());
  const booking = `${localePath(locale, routes.booking())}?xidmet=${service.id}`;
  const price = formatPrice(service.price, locale, dict.services);
  const duration = formatDuration(service.durationMinutes, dict.services);
  const [category] = service.categories;
  const [cover, ...gallery] = service.images;
  const related = relatedServices(menu, service.id, 3);
  const hasText = Boolean(service.description);

  return (
    <>
      <article>
        <header className="page-heading">
          <BreadcrumbData
            items={[
              { label: dict.common.home, href: localePath(locale) },
              { label: dict.services.title, href: servicesPath },
              ...(category ? [{ label: category.name, href: category.href }] : []),
              { label: service.name, href: service.href },
            ]}
          />
          <div className="relative container-page pt-10 pb-12 lg:pt-14 lg:pb-20">
            <div className="gap-x-column grid items-center gap-y-10 lg:grid-cols-12">
              <div className="min-w-0 lg:col-span-7">
                {category ? (
                  <p className="text-label text-caramel-ink mb-5 uppercase">{category.name}</p>
                ) : null}
                <FitHeading text={service.name} />
                {service.shortDescription ? (
                  <RichText
                    doc={service.shortDescription}
                    className="text-ink-muted mt-6 max-w-xl text-lead"
                  />
                ) : null}
                <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4">
                  <div>
                    <dt className="text-label text-ink-muted uppercase">{dict.services.price}</dt>
                    <dd data-service-price="" className="tabular font-display mt-1 text-h3">
                      {price}
                    </dd>
                  </div>
                  {duration ? (
                    <div>
                      <dt className="text-label text-ink-muted uppercase">
                        {dict.services.duration}
                      </dt>
                      <dd className="tabular font-display mt-1 text-h3">{duration}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
                  <Link href={booking} data-service-book="" className={button()}>
                    {dict.services.book}
                    <ArrowRightIcon size={20} className={buttonArrow} />
                  </Link>
                  <Link href={servicesPath} className={textLink()}>
                    {dict.services.allServices}
                  </Link>
                </div>
              </div>
              <div className="lg:col-span-5">
                <div className="bg-champagne rounded-arch arch-settle relative mx-auto aspect-[4/5] w-full max-w-md overflow-clip lg:max-w-none">
                  {cover ? (
                    <Image
                      src={cover.src}
                      alt={cover.alt}
                      fill
                      sizes="(min-width: 1024px) 40vw, 90vw"
                      loading="eager"
                      fetchPriority="high"
                      quality={75}
                      placeholder={cover.blurDataURL ? "blur" : "empty"}
                      blurDataURL={cover.blurDataURL ?? undefined}
                      className="object-cover"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </header>
        {hasText || service.masters.length ? (
          <div className="gap-x-column container-page grid gap-y-14 pt-14 pb-14 lg:grid-cols-12 lg:pt-24 lg:pb-24">
            {service.description ? (
              <section aria-labelledby="service-overview" className="lg:col-span-7">
                <h2 id="service-overview" className="text-h3">
                  {dict.services.overview}
                </h2>
                <RichText doc={service.description} className="mt-6" />
              </section>
            ) : null}
            {service.masters.length ? (
              <section
                aria-labelledby="service-masters"
                className={hasText ? "lg:col-span-4 lg:col-start-9" : "lg:col-span-8"}
              >
                <h2 id="service-masters" className="text-h3">
                  {dict.services.masters}
                </h2>
                <ul data-reveal-group="" className="mt-6 flex flex-col gap-3">
                  {service.masters.map((master) => (
                    <li
                      key={master.id}
                      data-reveal=""
                      className={`${card({ tone: "soft" })} group/card`}
                    >
                      <div className="flex items-center gap-4 p-4">
                        {master.photo ? (
                          <Image
                            src={master.photo.src}
                            alt=""
                            width={64}
                            height={64}
                            sizes="64px"
                            className="size-16 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="bg-champagne size-16 shrink-0 rounded-full"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-h4">
                            <Link
                              href={`${booking}&usta=${master.id}`}
                              prefetch={false}
                              className="card-link"
                            >
                              {master.name}
                            </Link>
                          </p>
                          <p className="text-ink-muted text-small">{master.role}</p>
                        </div>
                        <ArrowRightIcon size={20} className="shrink-0" />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
        {gallery.length ? (
          <section aria-label={dict.services.gallery} className="container-page pb-14 lg:pb-24">
            <ul className="gap-column grid grid-cols-2 lg:grid-cols-12">
              {gallery.map((image, index) => (
                <li
                  key={image.src}
                  data-reveal="clip"
                  style={{ "--reveal-delay": `${Math.min(index, 3) * 100}ms` } as CSSProperties}
                  className={
                    index === 0
                      ? "bg-soft rounded-card relative col-span-2 aspect-[4/5] overflow-clip lg:col-span-6 lg:aspect-[5/4]"
                      : "bg-soft rounded-card relative aspect-[4/5] overflow-clip lg:col-span-3"
                  }
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(min-width: 1024px) 40vw, 50vw"
                    loading="lazy"
                    className="object-cover"
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {related.length ? (
          <section
            aria-labelledby="service-related"
            className="bg-cream defer-render py-14 lg:py-24"
          >
            <div className="container-page">
              <SectionHead
                id="service-related"
                title={dict.services.related}
                body={<p>{dict.services.relatedBody}</p>}
                aside={
                  <Link href={servicesPath} className={textLink()}>
                    {dict.services.allServices}
                  </Link>
                }
              />
            </div>
            <div className="container-page mt-10">
              <ServiceRail id="related-services" services={related} locale={locale} dict={dict} />
            </div>
          </section>
        ) : null}
        {corpusService ? (
          <div className="container-page pt-14 pb-section">
            <FactBlockView
              block={serviceFactBlock(corpus, corpusService, locale, dict)}
              className="border-t border-line pt-12"
            />
          </div>
        ) : null}
      </article>
      <JsonLdScript
        data={serviceJsonLd(
          {
            name: service.name,
            url: service.href,
            images: service.images.map((image) => image.src),
            description:
              service.summary ||
              summarize(richTextToPlain(service.description)) ||
              fill(dict.services.detailDescription, { name: service.name }),
            category: category?.name ?? null,
            price: service.price,
          },
          env.NEXT_PUBLIC_SITE_URL,
        )}
      />
    </>
  );
}
