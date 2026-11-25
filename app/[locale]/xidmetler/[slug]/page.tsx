import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ArrowRightIcon } from "@/components/icons/iconsax";
import { FactBlockView } from "@/components/seo/fact-block";
import { button, buttonArrow } from "@/components/site/button";
import { JsonLdScript } from "@/components/site/json-ld";
import { PageHeading } from "@/components/site/page-heading";
import { RichText } from "@/components/site/rich-text";
import { richTextToPlain, summarize } from "@/lib/content/rich-text";
import { env } from "@/lib/env";
import { localePath } from "@/lib/i18n/config";
import { fill } from "@/lib/i18n/format";
import { getRequestDictionary } from "@/lib/i18n/server";
import { formatDuration, formatPrice } from "@/lib/public/price";
import { getServiceBySlug } from "@/lib/public/services";
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

export default async function ServicePage({ params }: PageProps<"/[locale]/xidmetler/[slug]">) {
  await connection();
  const [{ slug }, { locale, dict }] = await Promise.all([params, getRequestDictionary()]);
  const service = await getServiceBySlug(locale, slug);
  if (!service) notFound();
  redirectToCanonicalSlug(service.slug, locale, slug, routes.service);
  const corpus = await getCorpus();
  const corpusService = corpus.services.find((item) => item.id === service.id);
  const servicesPath = localePath(locale, routes.services());
  const booking = `${localePath(locale, routes.booking())}?xidmet=${service.id}`;
  const price = formatPrice(service.price, locale, dict.services);
  const duration = formatDuration(service.durationMinutes, dict.services);
  const [category] = service.categories;

  return (
    <>
      <article>
        <PageHeading
          eyebrow={category?.name ?? null}
          title={service.name}
          breadcrumbLabel={dict.common.breadcrumb}
          breadcrumbs={[
            { label: dict.common.home, href: localePath(locale) },
            { label: dict.services.title, href: servicesPath },
            ...(category ? [{ label: category.name, href: category.href }] : []),
            { label: service.name, href: service.href },
          ]}
        >
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3">
            <div>
              <dt className="text-ink-muted text-small">{dict.services.price}</dt>
              <dd data-service-price="" className="tabular text-h4">
                {price}
              </dd>
            </div>
            {duration ? (
              <div>
                <dt className="text-ink-muted text-small">{dict.services.duration}</dt>
                <dd className="tabular text-h4">{duration}</dd>
              </div>
            ) : null}
          </dl>
          <Link href={booking} className={`${button()} mt-8`}>
            {dict.services.book}
            <ArrowRightIcon size={20} className={buttonArrow} />
          </Link>
        </PageHeading>
        <div className="container-page flex flex-col gap-14 pb-section">
          {service.images.length ? (
            <section aria-label={dict.services.gallery}>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {service.images.map((image, index) => (
                  <li key={image.src} className="bg-soft relative aspect-[4/5] overflow-clip">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      loading={index === 0 ? "eager" : "lazy"}
                      className="object-cover"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {service.shortDescription ? (
            <RichText doc={service.shortDescription} className="text-lead" />
          ) : null}
          {service.description ? <RichText doc={service.description} /> : null}
          {service.masters.length ? (
            <section aria-labelledby="service-masters">
              <h2 id="service-masters" className="text-h3">
                {dict.services.masters}
              </h2>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {service.masters.map((master) => (
                  <li key={master.id} className="flex items-center gap-4">
                    {master.photo ? (
                      <Image
                        src={master.photo.src}
                        alt={master.photo.alt}
                        width={64}
                        height={64}
                        sizes="64px"
                        className="size-16 rounded-full object-cover"
                      />
                    ) : null}
                    <span>
                      <span className="block font-medium">{master.name}</span>
                      <span className="text-ink-muted block text-small">{master.role}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {corpusService ? (
            <FactBlockView
              block={serviceFactBlock(corpus, corpusService, locale, dict)}
              className="border-t border-line pt-12"
            />
          ) : null}
        </div>
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
