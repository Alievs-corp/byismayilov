import Image from "next/image";
import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons/iconsax";
import { card, chip } from "@/components/site/button";
import { cx } from "@/lib/cx";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatDuration, formatPrice } from "@/lib/public/price";
import type { ServiceListItem } from "@/lib/public/services";

export function ServiceCard({
  service,
  locale,
  dict,
  accent = false,
}: {
  service: ServiceListItem;
  locale: Locale;
  dict: Dictionary;
  accent?: boolean;
}) {
  const duration = formatDuration(service.durationMinutes, dict.services);
  return (
    <article
      data-service-card=""
      className={cx(card({ tone: accent ? "blush" : "soft" }), "group/card flex h-full flex-col")}
    >
      <div className="relative aspect-[4/5] overflow-clip">
        {service.image ? (
          <Image
            src={service.image.src}
            alt={service.image.alt}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 80vw"
            placeholder={service.image.blurDataURL ? "blur" : "empty"}
            blurDataURL={service.image.blurDataURL ?? undefined}
            className="card-photo object-cover"
          />
        ) : (
          <span aria-hidden="true" className="card-blank" />
        )}
        <span
          data-service-price=""
          className={cx(chip({ tone: "white" }), "absolute top-4 left-4")}
        >
          {formatPrice(service.price, locale, dict.services)}
        </span>
      </div>
      <div className="flex flex-1 items-end justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0">
          <h3 className="text-safe text-h4">
            <Link href={service.href} prefetch={false} className="card-link">
              {service.name}
            </Link>
          </h3>
          {duration ? <p className="text-ink-muted mt-1 text-small">{duration}</p> : null}
        </div>
        <span
          aria-hidden="true"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white transition-transform duration-200 ease-standard group-hover/card:translate-x-1"
        >
          <ArrowRightIcon size={20} />
        </span>
      </div>
    </article>
  );
}

export function ServiceRail({
  id,
  services,
  locale,
  dict,
}: {
  id: string;
  services: ServiceListItem[];
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <ul
      id={id}
      data-reveal-group=""
      className="rail"
      style={{ "--rail-pad": "var(--spacing-gutter)" } as React.CSSProperties}
    >
      {services.map((service, index) => (
        <li key={service.id} data-rail-item="" data-reveal="side">
          <ServiceCard service={service} locale={locale} dict={dict} accent={index === 1} />
        </li>
      ))}
    </ul>
  );
}
