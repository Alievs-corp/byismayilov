import type { Metadata } from "next";
import { connection } from "next/server";

import { EmptyState } from "@/components/site/empty-state";
import { MasterCards } from "@/components/site/master-cards";
import { PageHeading } from "@/components/site/page-heading";
import { localePath } from "@/lib/i18n/config";
import { getRequestDictionary } from "@/lib/i18n/server";
import { getMasters } from "@/lib/public/masters";
import { staticPaths } from "@/lib/public/slug";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo/metadata";
import { markdownHref } from "@/lib/seo/rewrites";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const { locale, dict } = await getRequestDictionary();
  const masters = await getMasters(locale);
  return pageMetadata({
    locale,
    title: dict.masters.title,
    description: dict.masters.description,
    paths: staticPaths(routes.masters()),
    og: { kind: "masters" },
    noIndex: masters.length === 0,
    markdownPath: markdownHref(localePath(locale, routes.masters())),
  });
}

export default async function MastersPage() {
  await connection();
  const { locale, dict } = await getRequestDictionary();
  const masters = await getMasters(locale);
  const path = localePath(locale, routes.masters());

  return (
    <>
      <PageHeading
        title={dict.masters.title}
        lead={<p>{dict.masters.description}</p>}
        breadcrumbLabel={dict.common.breadcrumb}
        breadcrumbs={[
          { label: dict.common.home, href: localePath(locale) },
          { label: dict.masters.title, href: path },
        ]}
      />
      <div className="container-page pb-section">
        {masters.length ? (
          <MasterCards masters={masters} locale={locale} dict={dict} headingLevel={2} />
        ) : (
          <EmptyState
            title={dict.masters.empty}
            actions={[
              { label: dict.common.bookOnline, href: localePath(locale, routes.booking()) },
            ]}
          />
        )}
      </div>
    </>
  );
}
