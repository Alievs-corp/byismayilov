import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { ArrowRightIcon } from "@/components/icons/iconsax";
import { button, buttonArrow } from "@/components/site/button";
import { ChipNav } from "@/components/site/chip-nav";
import { EmptyState } from "@/components/site/empty-state";
import { JsonLdScript } from "@/components/site/json-ld";
import { PageHeading } from "@/components/site/page-heading";
import { RichText } from "@/components/site/rich-text";
import { ServiceRows } from "@/components/site/service-list";
import { cx } from "@/lib/cx";
import { env } from "@/lib/env";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";
import { getRequestDictionary } from "@/lib/i18n/server";
import { getServiceMenu, type ServiceGroup, type ServiceListItem } from "@/lib/public/services";
import { staticPaths } from "@/lib/public/slug";
import { routes } from "@/lib/routes";
import { collectionPageJsonLd, offerCatalogJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { markdownHref } from "@/lib/seo/rewrites";

export const instant = false;

const otherAnchor = "diger";

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

function collect(group: ServiceGroup): ServiceListItem[] {
  return [...group.services, ...group.children.flatMap(collect)];
}

function CategorySection({
  anchor,
  name,
  description,
  count,
  index,
  services,
  subgroups,
  locale,
  dict,
}: {
  anchor: string;
  name: string;
  description: ServiceGroup["description"];
  count: number;
  index: number;
  services: ServiceListItem[];
  subgroups: ServiceGroup[];
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <section
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      data-service-category=""
      className={cx(
        "scroll-mt-[calc(var(--spacing-header)+4.5rem)] py-14 lg:py-24",
        index % 2 === 1 && "bg-cream",
      )}
    >
      <div className="gap-x-column container-page grid gap-y-8 lg:grid-cols-12">
        <header className="lg:col-span-4">
          <div className="lg:sticky lg:top-[calc(var(--spacing-header)+5.5rem)]">
            <p className="text-label text-caramel-ink tabular mb-4 uppercase">
              {String(index + 1).padStart(2, "0")}
              <span aria-hidden="true"> / </span>
              <span className="sr-only">, </span>
              {fill(dict.services.count, { count })}
            </p>
            <h2 id={`${anchor}-title`} className="text-safe text-h2">
              {name}
            </h2>
            {description ? (
              <RichText doc={description} className="text-ink-muted mt-5 max-w-md text-small" />
            ) : null}
          </div>
        </header>
        <div className="lg:col-span-8">
          {services.length ? <ServiceRows services={services} locale={locale} dict={dict} /> : null}
          {subgroups.map((child) => (
            <div
              key={child.id}
              id={child.anchor}
              data-service-subcategory=""
              className="mt-12 scroll-mt-[calc(var(--spacing-header)+4.5rem)]"
            >
              <h3 className="mb-5 text-h3">{child.name}</h3>
              <ServiceRows services={collect(child)} locale={locale} dict={dict} />
            </div>
          ))}
        </div>
      </div>
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
    ...menu.groups.map((group) => ({
      name: group.name,
      url: `${path}#${group.anchor}`,
      items: collect(group).map((service) => ({
        name: service.name,
        url: service.href,
        price: service.price,
      })),
    })),
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
  const chips = [
    ...menu.groups.map((group) => ({
      key: group.id,
      label: group.name,
      href: `#${group.anchor}`,
      count: collect(group).length,
    })),
    ...(menu.other.length
      ? [
          {
            key: otherAnchor,
            label: dict.services.other,
            href: `#${otherAnchor}`,
            count: menu.other.length,
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
      {chips.length > 1 ? (
        <div
          data-category-bar=""
          className="sticky top-[var(--spacing-header)] z-30 border-b border-line bg-white/90 py-3 backdrop-blur-md"
        >
          <div className="container-page">
            <ChipNav label={dict.services.jump} chips={chips} />
          </div>
        </div>
      ) : null}
      {empty ? (
        <div className="container-page pt-10 pb-section">
          <EmptyState
            title={dict.services.empty}
            actions={[{ label: dict.common.bookOnline, href: booking }]}
          />
        </div>
      ) : null}
      {menu.groups.map((group, index) => (
        <CategorySection
          key={group.id}
          anchor={group.anchor}
          name={group.name}
          description={group.description}
          count={collect(group).length}
          index={index}
          services={group.services}
          subgroups={group.children}
          locale={locale}
          dict={dict}
        />
      ))}
      {menu.other.length ? (
        <CategorySection
          anchor={otherAnchor}
          name={dict.services.other}
          description={null}
          count={menu.other.length}
          index={menu.groups.length}
          services={menu.other}
          subgroups={[]}
          locale={locale}
          dict={dict}
        />
      ) : null}
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
