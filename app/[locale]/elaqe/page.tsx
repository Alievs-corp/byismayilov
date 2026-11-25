import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { ArrowRightIcon, ExportSquareIcon, LocationIcon } from "@/components/icons/iconsax";
import { button, buttonArrow } from "@/components/site/button";
import {
  ContactDetails,
  hasContactDetails,
  mapEmbedUrl,
  mapHref,
} from "@/components/site/contact-details";
import { JsonLdScript } from "@/components/site/json-ld";
import { Ornament } from "@/components/ornament/ornament";
import { PageHeading } from "@/components/site/page-heading";
import { env } from "@/lib/env";
import { localePath } from "@/lib/i18n/config";
import { fill } from "@/lib/i18n/format";
import { pickLocale } from "@/lib/i18n/localized";
import { getRequestDictionary } from "@/lib/i18n/server";
import { getSiteSettings } from "@/lib/public/settings";
import { staticPaths } from "@/lib/public/slug";
import { routes } from "@/lib/routes";
import { getCorpus } from "@/lib/seo/corpus";
import { companyStatement } from "@/lib/seo/facts";
import { businessJsonLd, contactPageJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { markdownHref } from "@/lib/seo/rewrites";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const { locale, dict } = await getRequestDictionary();
  return pageMetadata({
    locale,
    title: dict.contact.title,
    description: dict.contact.description,
    paths: staticPaths(routes.contact()),
    og: { kind: "contact" },
    markdownPath: markdownHref(localePath(locale, routes.contact())),
  });
}

export default async function ContactPage() {
  await connection();
  const { locale, dict } = await getRequestDictionary();
  const [settings, corpus] = await Promise.all([getSiteSettings(), getCorpus()]);
  const path = localePath(locale, routes.contact());
  const embed = mapEmbedUrl(settings);
  const map = mapHref(settings);
  const address = settings.address ? pickLocale(settings.address, locale) : null;

  return (
    <>
      <PageHeading
        title={dict.contact.title}
        lead={<p>{dict.contact.intro}</p>}
        ornament={
          <Ornament
            name="eucalyptus-line"
            width={{ base: 150, lg: 190 }}
            className="text-caramel-ink"
          />
        }
        breadcrumbs={[
          { label: dict.common.home, href: localePath(locale) },
          { label: dict.contact.title, href: path },
        ]}
      />
      <div className="gap-x-column container-page grid gap-y-12 py-section lg:grid-cols-12">
        <div className="flex flex-col gap-12 lg:col-span-6">
          {hasContactDetails(settings) ? (
            <ContactDetails settings={settings} locale={locale} dict={dict} />
          ) : (
            <p className="text-ink-muted">{dict.contact.empty}</p>
          )}
          {address ? (
            <section
              aria-labelledby="find-us"
              data-reveal=""
              className="rounded-card bg-cream p-6 sm:p-10"
            >
              <h2 id="find-us" className="text-h3">
                {dict.contact.findTitle}
              </h2>
              <p className="text-ink-muted mt-4 max-w-md">
                {fill(dict.contact.findBody, { address })}
              </p>
            </section>
          ) : null}
          <div>
            <Link href={localePath(locale, routes.booking())} className={button({ size: "lg" })}>
              {dict.common.bookOnline}
              <ArrowRightIcon size={20} className={buttonArrow} />
            </Link>
          </div>
        </div>
        <div className="lg:top-header lg:sticky lg:col-span-5 lg:col-start-8 lg:self-start">
          {embed ? (
            <iframe
              src={embed}
              title={dict.contact.map}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="rounded-card bg-soft aspect-[4/5] w-full border-0"
            />
          ) : (
            <div data-reveal="scale" className="map-card lg:aspect-[4/5]">
              <span aria-hidden="true" className="map-card-pin">
                <LocationIcon size={32} />
              </span>
              {address ? (
                <p className="font-display max-w-xs text-center text-h4">{address}</p>
              ) : null}
              {map ? (
                <a
                  href={map}
                  target="_blank"
                  rel="noopener"
                  className={`${button({ variant: "light", size: "sm" })} relative`}
                >
                  {dict.contact.openMap}
                  <ExportSquareIcon size={16} />
                </a>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <JsonLdScript
        data={[
          ...businessJsonLd(settings, locale, env.NEXT_PUBLIC_SITE_URL, {
            description: companyStatement(corpus, locale, dict),
          }),
          contactPageJsonLd({
            name: dict.contact.title,
            description: dict.contact.description,
            url: path,
            locale,
            siteUrl: env.NEXT_PUBLIC_SITE_URL,
          }),
        ]}
      />
    </>
  );
}
