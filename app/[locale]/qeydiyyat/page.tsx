import type { Metadata } from "next";
import { connection } from "next/server";

import { BookingPanel, parseIdList } from "@/components/site/booking/booking-section";
import { CallIcon } from "@/components/icons/iconsax";
import { JsonLdScript } from "@/components/site/json-ld";
import { PageHeading } from "@/components/site/page-heading";
import { telHref } from "@/lib/contact-links";
import { env } from "@/lib/env";
import { localePath } from "@/lib/i18n/config";
import { getRequestDictionary } from "@/lib/i18n/server";
import { formatAzerbaijaniPhone } from "@/lib/phone";
import { getSiteSettings } from "@/lib/public/settings";
import { staticPaths } from "@/lib/public/slug";
import { routes } from "@/lib/routes";
import { contactPageJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { markdownHref } from "@/lib/seo/rewrites";

export const instant = false;

export async function generateMetadata({
  searchParams,
}: PageProps<"/[locale]/qeydiyyat">): Promise<Metadata> {
  await connection();
  const [query, { locale, dict }] = await Promise.all([searchParams, getRequestDictionary()]);
  return pageMetadata({
    locale,
    title: dict.booking.title,
    description: dict.booking.description,
    paths: staticPaths(routes.booking()),
    og: { kind: "booking" },
    noIndex: Boolean(query.xidmet || query.usta),
    markdownPath: markdownHref(localePath(locale, routes.booking())),
  });
}

export default async function BookingPage({ searchParams }: PageProps<"/[locale]/qeydiyyat">) {
  await connection();
  const [query, { locale, dict }, settings] = await Promise.all([
    searchParams,
    getRequestDictionary(),
    getSiteSettings(),
  ]);
  const path = localePath(locale, routes.booking());
  const [masterId] = parseIdList(query.usta);
  const phone = settings.phones[0];

  return (
    <>
      <PageHeading
        title={dict.booking.title}
        lead={<p>{dict.booking.intro}</p>}
        breadcrumbLabel={dict.common.breadcrumb}
        breadcrumbs={[
          { label: dict.common.home, href: localePath(locale) },
          { label: dict.booking.title, href: path },
        ]}
      >
        {phone ? (
          <p className="mt-6 text-small">
            {dict.booking.direct}:{" "}
            <a
              href={telHref(phone.number)}
              className="tabular inline-flex min-h-11 items-center gap-2 underline underline-offset-4"
            >
              <CallIcon size={16} />
              {formatAzerbaijaniPhone(phone.number)}
            </a>
          </p>
        ) : null}
      </PageHeading>
      <div className="container-page pb-section">
        <div className="max-w-4xl">
          <BookingPanel
            locale={locale}
            dict={dict}
            serviceIds={parseIdList(query.xidmet)}
            masterId={masterId ?? null}
          />
        </div>
      </div>
      <JsonLdScript
        data={contactPageJsonLd({
          name: dict.booking.title,
          description: dict.booking.description,
          url: path,
          locale,
          siteUrl: env.NEXT_PUBLIC_SITE_URL,
        })}
      />
    </>
  );
}
