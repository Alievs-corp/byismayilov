import type { Metadata } from "next";
import { connection } from "next/server";

import { BookingPanel, parseIdList } from "@/components/site/booking/booking-section";
import { CallIcon } from "@/components/icons/iconsax";
import { Glow } from "@/components/ornament/glow";
import { Ornament } from "@/components/ornament/ornament";
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
      <div className="container-page pt-10 pb-section lg:pt-14">
        <div className="gap-x-column grid gap-y-10 lg:grid-cols-12">
          <div className="rounded-card bg-cream relative z-10 border border-line p-6 sm:p-10 lg:col-span-8 lg:p-12">
            <BookingPanel
              locale={locale}
              dict={dict}
              serviceIds={parseIdList(query.xidmet)}
              masterId={masterId ?? null}
            />
          </div>
          <aside className="relative z-10 lg:col-span-3 lg:col-start-10">
            <div className="lg:sticky lg:top-[calc(var(--spacing-header)+2rem)]">
              <h2 className="text-label text-caramel-ink font-sans uppercase">
                {dict.booking.sideTitle}
              </h2>
              <ol className="mt-6 flex flex-col gap-6">
                {[dict.booking.step1, dict.booking.step2, dict.booking.step3].map((step, index) => (
                  <li key={step} className="flex gap-4">
                    <span className="font-display text-caramel tabular text-h3 leading-none">
                      {index + 1}
                    </span>
                    <span className="text-ink-muted text-small">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-8 border-t border-line pt-6 text-small">{dict.booking.sideNote}</p>
              <div className="relative mt-10 hidden lg:block">
                <Glow
                  name="orb-light"
                  className="top-1/2 left-1/2 w-[22rem] -translate-x-1/2 -translate-y-1/2 opacity-50"
                />
                <Ornament
                  name="magnolia"
                  width={{ base: 200, lg: 240 }}
                  className="text-caramel-ink relative"
                />
              </div>
            </div>
          </aside>
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
