import Image from "next/image";
import Link from "next/link";

import { InstagramIcon } from "@/components/icons/iconsax";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { PublicMaster } from "@/lib/public/masters";
import { routes } from "@/lib/routes";

export function MasterCards({
  masters,
  locale,
  dict,
  headingLevel,
}: {
  masters: PublicMaster[];
  locale: Locale;
  dict: Dictionary;
  headingLevel: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const booking = localePath(locale, routes.booking());
  return (
    <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {masters.map((master) => (
        <li key={master.id} data-master-card="">
          <article className="flex h-full flex-col">
            {master.photo ? (
              <div className="bg-soft relative aspect-[4/5] overflow-clip">
                <Image
                  src={master.photo.src}
                  alt={master.photo.alt}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            ) : null}
            <Heading className="mt-4 text-h4">{master.name}</Heading>
            <p className="text-ink-muted text-small">{master.role}</p>
            {master.bio ? <p className="mt-3 text-small">{master.bio}</p> : null}
            {master.services.length ? (
              <div className="mt-3">
                <p className="text-ink-muted text-small">{dict.masters.services}</p>
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-small">
                  {master.services.map((service) => (
                    <li key={service.id}>
                      <Link
                        href={service.href}
                        prefetch={false}
                        className="underline underline-offset-4"
                      >
                        {service.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-small">
              <Link
                href={`${booking}?usta=${master.id}`}
                className="inline-flex min-h-11 items-center underline underline-offset-4"
              >
                {dict.masters.book}
              </Link>
              {master.instagramUrl ? (
                <a
                  href={master.instagramUrl}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex min-h-11 items-center gap-2"
                >
                  <InstagramIcon size={20} />
                  {dict.masters.instagram}
                </a>
              ) : null}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
