import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { ArrowRightIcon } from "@/components/icons/iconsax";
import { button, buttonArrow } from "@/components/site/button";
import { ContactDetails, hasContactDetails, mapEmbedUrl } from "@/components/site/contact-details";
import { JsonLdScript } from "@/components/site/json-ld";
import { PageHeading } from "@/components/site/page-heading";
import { env } from "@/lib/env";
import { localePath } from "@/lib/i18n/config";
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

  return (
    <>
      <PageHeading
        title={dict.contact.title}
        lead={<p>{dict.contact.intro}</p>}
        breadcrumbLabel={dict.common.breadcrumb}
        breadcrumbs={[
          { label: dict.common.home, href: localePath(locale) },
          { label: dict.contact.title, href: path },
        ]}
      />
      <div className="container-page flex flex-col gap-12 pb-section">
        {hasContactDetails(settings) ? (
          <ContactDetails settings={settings} locale={locale} dict={dict} />
        ) : (
          <p className="text-ink-muted">{dict.contact.empty}</p>
        )}
        {embed ? (
          <iframe
            src={embed}
            title={dict.contact.map}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="aspect-video w-full border-0"
          />
        ) : null}
        <div>
          <Link href={localePath(locale, routes.booking())} className={button()}>
            {dict.common.bookOnline}
            <ArrowRightIcon size={20} className={buttonArrow} />
          </Link>
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
