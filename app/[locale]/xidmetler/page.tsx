import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { ArrowRightIcon } from "@/components/icons/iconsax";
import { button, buttonArrow } from "@/components/site/button";
import { EmptyState } from "@/components/site/empty-state";
import { JsonLdScript } from "@/components/site/json-ld";
import { PageHeading } from "@/components/site/page-heading";
import { RichText } from "@/components/site/rich-text";
import { ServiceRows } from "@/components/site/service-list";
import { env } from "@/lib/env";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getRequestDictionary } from "@/lib/i18n/server";
import { getServiceMenu, type ServiceGroup } from "@/lib/public/services";
import { staticPaths } from "@/lib/public/slug";
import { routes } from "@/lib/routes";
import { collectionPageJsonLd, offerCatalogJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { markdownHref } from "@/lib/seo/rewrites";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const { locale, dict } = await getRequestDictionary();
  return pageMetadata({
    locale,
    title: dict.services.title,
    description: dict.services.description,
    paths: staticPaths(routes.services()),
    og: { kind: "services" },
    markdownPath: markdownHref(localePath(locale, routes.services())),
  });
}

function GroupSection({
  group,
  locale,
  dict,
  level,
}: {
  group: ServiceGroup;
  locale: Locale;
  dict: Dictionary;
  level: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section
      id={group.anchor}
      aria-labelledby={`${group.anchor}-title`}
      data-service-category=""
      className="scroll-mt-28"
    >
      <Heading id={`${group.anchor}-title`} className={level === 2 ? "text-h2" : "mt-10 text-h3"}>
        {group.name}
      </Heading>
      {group.description ? <RichText doc={group.description} className="mt-4" /> : null}
      {group.services.length ? (
        <div className="mt-6">
          <ServiceRows services={group.services} locale={locale} dict={dict} />
        </div>
      ) : null}
      {group.children.map((child) => (
        <GroupSection key={child.id} group={child} locale={locale} dict={dict} level={3} />
      ))}
    </section>
  );
}

export default async function ServicesPage() {
  await connection();
  const { locale, dict } = await getRequestDictionary();
  const menu = await getServiceMenu(locale);
  const path = localePath(locale, routes.services());
  const booking = localePath(locale, routes.booking());
  const empty = !menu.groups.length && !menu.other.length;
  const catalog = [
    ...menu.groups.map((group) => {
      const collect = (item: ServiceGroup): ServiceGroup["services"] => [
        ...item.services,
        ...item.children.flatMap(collect),
      ];
      return {
        name: group.name,
        url: `${path}#${group.anchor}`,
        items: collect(group).map((service) => ({
          name: service.name,
          url: service.href,
          price: service.price,
        })),
      };
    }),
    ...(menu.other.length
      ? [
          {
            name: dict.services.other,
            url: path,
            items: menu.other.map((service) => ({
              name: service.name,
              url: service.href,
              price: service.price,
            })),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeading
        title={dict.services.title}
        lead={<p>{dict.services.intro}</p>}
        breadcrumbLabel={dict.common.breadcrumb}
        breadcrumbs={[
          { label: dict.common.home, href: localePath(locale) },
          { label: dict.services.title, href: path },
        ]}
      >
        <Link href={booking} className={`${button()} mt-8`}>
          {dict.common.bookOnline}
          <ArrowRightIcon size={20} className={buttonArrow} />
        </Link>
      </PageHeading>
      <div className="container-page flex flex-col gap-16 pb-section">
        {empty ? (
          <EmptyState
            title={dict.services.empty}
            actions={[{ label: dict.common.bookOnline, href: booking }]}
          />
        ) : null}
        {menu.groups.map((group) => (
          <GroupSection key={group.id} group={group} locale={locale} dict={dict} level={2} />
        ))}
        {menu.other.length ? (
          <section aria-labelledby="services-other-title">
            <h2 id="services-other-title" className="text-h2">
              {dict.services.other}
            </h2>
            <div className="mt-6">
              <ServiceRows services={menu.other} locale={locale} dict={dict} />
            </div>
          </section>
        ) : null}
      </div>
      <JsonLdScript
        data={[
          {
            ...collectionPageJsonLd({
              name: dict.services.title,
              description: dict.services.description,
              url: path,
              locale,
              siteUrl: env.NEXT_PUBLIC_SITE_URL,
            }),
            ...(catalog.length
              ? {
                  mainEntity: offerCatalogJsonLd(
                    dict.services.title,
                    catalog,
                    env.NEXT_PUBLIC_SITE_URL,
                  ),
                }
              : {}),
          },
        ]}
      />
    </>
  );
}
