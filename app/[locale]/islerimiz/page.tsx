import type { Metadata } from "next";
import { connection } from "next/server";

import { ChipNav } from "@/components/site/chip-nav";
import { EmptyState } from "@/components/site/empty-state";
import { GalleryGrid } from "@/components/site/gallery-grid";
import { PageHeading } from "@/components/site/page-heading";
import { localePath } from "@/lib/i18n/config";
import { getRequestDictionary } from "@/lib/i18n/server";
import { getGallery } from "@/lib/public/gallery";
import { staticPaths } from "@/lib/public/slug";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo/metadata";

export const instant = false;

function categoryParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim().slice(0, 200) || null;
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/[locale]/islerimiz">): Promise<Metadata> {
  await connection();
  const [query, { locale, dict }] = await Promise.all([searchParams, getRequestDictionary()]);
  const gallery = await getGallery(locale, null);
  return pageMetadata({
    locale,
    title: dict.gallery.title,
    description: dict.gallery.description,
    paths: staticPaths(routes.gallery()),
    og: { kind: "gallery" },
    noIndex: gallery.items.length === 0 || categoryParam(query.kateqoriya) !== null,
  });
}

export default async function GalleryPage({ searchParams }: PageProps<"/[locale]/islerimiz">) {
  await connection();
  const [query, { locale, dict }] = await Promise.all([searchParams, getRequestDictionary()]);
  const gallery = await getGallery(locale, categoryParam(query.kateqoriya));
  const path = localePath(locale, routes.gallery());

  return (
    <>
      <PageHeading
        title={dict.gallery.title}
        lead={<p>{dict.gallery.description}</p>}
        breadcrumbLabel={dict.common.breadcrumb}
        breadcrumbs={[
          { label: dict.common.home, href: localePath(locale) },
          { label: dict.gallery.title, href: path },
        ]}
      />
      <div className="container-page flex flex-col gap-10 pb-section">
        {gallery.filters.length > 1 ? (
          <ChipNav
            label={dict.gallery.filter}
            heading={dict.gallery.filter}
            chips={[
              { key: "all", label: dict.gallery.all, href: path, current: !gallery.active },
              ...gallery.filters.map((filter) => ({
                key: filter.id,
                label: filter.name,
                href: `${path}?kateqoriya=${encodeURIComponent(filter.slug)}`,
                current: gallery.active?.id === filter.id,
              })),
            ]}
          />
        ) : null}
        {gallery.items.length ? (
          <GalleryGrid items={gallery.items} dict={dict} />
        ) : (
          <EmptyState
            title={dict.gallery.empty}
            actions={[
              { label: dict.common.allServices, href: localePath(locale, routes.services()) },
            ]}
          />
        )}
      </div>
    </>
  );
}
