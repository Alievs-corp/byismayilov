import type { ReactNode } from "react";

import { cx } from "@/lib/cx";
import type { BreadcrumbItem } from "@/lib/seo/json-ld";

import { BreadcrumbData } from "./breadcrumbs";
import { FitHeading } from "./fit-heading";

export function PageHeading({
  title,
  eyebrow,
  lead,
  breadcrumbs,
  lang,
  ornament,
  children,
}: {
  title: string;
  eyebrow?: string | null;
  lead?: ReactNode;
  breadcrumbs: BreadcrumbItem[];
  lang?: string;
  ornament?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <BreadcrumbData items={breadcrumbs} />
      <div className="relative container-page pt-12 pb-14 lg:pt-24 lg:pb-24">
        <div
          className={cx(
            "gap-x-column grid gap-y-6 lg:grid-cols-12",
            ornament ? "lg:grid-rows-[auto_1fr]" : null,
          )}
        >
          <div className="min-w-0 lg:col-span-8">
            {eyebrow && eyebrow.toLocaleLowerCase() !== title.toLocaleLowerCase() ? (
              <p className="text-label text-caramel-ink mb-5 uppercase">{eyebrow}</p>
            ) : null}
            <FitHeading text={title} lang={lang} />
          </div>
          {ornament ? (
            <div className="hidden items-end justify-end lg:col-span-3 lg:col-start-10 lg:row-span-2 lg:flex">
              {ornament}
            </div>
          ) : null}
          {lead || children ? (
            <div className="lg:col-span-6 lg:col-start-1">
              {lead ? (
                <div lang={lang} className="text-ink-muted max-w-2xl text-lead">
                  {lead}
                </div>
              ) : null}
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
