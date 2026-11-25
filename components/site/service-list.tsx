import Link from "next/link";

import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatDuration, formatPrice } from "@/lib/public/price";
import type { ServiceListItem } from "@/lib/public/services";

export function ServiceRows({
  services,
  locale,
  dict,
}: {
  services: ServiceListItem[];
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <ul className="border-t border-line">
      {services.map((service) => {
        const duration = formatDuration(service.durationMinutes, dict.services);
        return (
          <li
            key={service.id}
            data-service-row=""
            className="grid gap-x-6 gap-y-1 border-b border-line py-4 sm:grid-cols-[1fr_auto]"
          >
            <div>
              <Link
                href={service.href}
                prefetch={false}
                className="text-h4 underline-offset-4 hover:underline"
              >
                {service.name}
              </Link>
              {service.summary ? (
                <p className="text-ink-muted mt-1 text-small">{service.summary}</p>
              ) : null}
            </div>
            <p className="tabular text-small sm:text-right">
              <span data-service-price="" className="block font-medium">
                {formatPrice(service.price, locale, dict.services)}
              </span>
              {duration ? <span className="text-ink-muted block">{duration}</span> : null}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
