import Image from "next/image";
import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons/iconsax";
import { button, buttonArrow } from "@/components/site/button";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatDuration, formatPrice } from "@/lib/public/price";
import type { ServiceListItem } from "@/lib/public/services";
import { routes } from "@/lib/routes";

export function ServiceRows({
  services,
  locale,
  dict,
}: {
  services: ServiceListItem[];
  locale: Locale;
  dict: Dictionary;
}) {
  const booking = localePath(locale, routes.booking());
  return (
    <ul data-reveal-group="" className="border-t border-line">
      {services.map((service) => {
        const duration = formatDuration(service.durationMinutes, dict.services);
        return (
          <li
            key={service.id}
            data-service-row=""
            data-reveal="rule"
            className="group/row relative flex gap-4 py-5 sm:items-center sm:gap-6 sm:py-6"
          >
            <div className="bg-soft relative aspect-[4/5] w-[4.5rem] shrink-0 overflow-clip rounded-md sm:w-24">
              {service.image ? (
                <Image
                  src={service.image.src}
                  alt=""
                  fill
                  sizes="96px"
                  placeholder={service.image.blurDataURL ? "blur" : "empty"}
                  blurDataURL={service.image.blurDataURL ?? undefined}
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="grid min-w-0 flex-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <div className="min-w-0">
                <h3 className="text-safe text-h4">
                  <Link href={service.href} prefetch={false} className="card-link">
                    {service.name}
                  </Link>
                </h3>
                {service.summary ? (
                  <p className="text-ink-muted mt-1 line-clamp-2 text-small">{service.summary}</p>
                ) : null}
              </div>
              <p className="tabular flex flex-wrap items-baseline gap-x-3 text-small sm:flex-col sm:items-end sm:gap-0 sm:text-right">
                <span data-service-price="" className="font-display text-h4">
                  {formatPrice(service.price, locale, dict.services)}
                </span>
                {duration ? <span className="text-ink-muted">{duration}</span> : null}
              </p>
              <Link
                href={`${booking}?xidmet=${service.id}`}
                prefetch={false}
                data-service-book=""
                aria-label={`${dict.services.bookService}: ${service.name}`}
                className={`${button({ variant: "outline", size: "sm" })} relative z-10 self-start sm:self-center`}
              >
                {dict.services.bookService}
                <ArrowRightIcon size={16} className={buttonArrow} />
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
