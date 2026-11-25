import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

export function SectionHead({
  id,
  title,
  body,
  aside,
  ornament,
  eyebrow,
  as: Heading = "h2",
  className,
}: {
  id: string;
  title: string;
  body?: ReactNode;
  aside?: ReactNode;
  ornament?: ReactNode;
  eyebrow?: string;
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div
      className={cx("section-head gap-x-column grid items-end gap-y-6 md:grid-cols-12", className)}
    >
      <div className="flex items-end gap-5 md:col-span-7 lg:col-span-6 xl:col-span-5">
        <div className="min-w-0">
          {eyebrow ? <p className="text-label text-caramel-ink mb-4 uppercase">{eyebrow}</p> : null}
          <Heading id={id} className="text-safe text-h2">
            {title}
          </Heading>
        </div>
        {ornament ? (
          <div className="mb-1 hidden shrink-0 sm:block xl:hidden">{ornament}</div>
        ) : null}
      </div>
      {ornament ? (
        <div className="hidden justify-center self-center xl:col-span-2 xl:flex">{ornament}</div>
      ) : null}
      {body ? (
        <div
          className={cx(
            "text-ink-muted text-small md:col-span-5 lg:col-span-4",
            ornament ? "xl:col-span-3" : "lg:col-start-7 xl:col-start-6",
          )}
        >
          {body}
        </div>
      ) : null}
      {aside ? (
        <div className="flex justify-start md:col-span-12 md:justify-end lg:col-span-2 lg:col-start-11 xl:col-span-2">
          {aside}
        </div>
      ) : null}
    </div>
  );
}
