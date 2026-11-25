import Image from "next/image";
import Link from "next/link";

import { ArrowRightIcon, InstagramIcon } from "@/components/icons/iconsax";
import { button, buttonArrow, chip, textLink } from "@/components/site/button";
import { cx } from "@/lib/cx";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { PublicMaster } from "@/lib/public/masters";
import { routes } from "@/lib/routes";

export function MasterFeature({
  id,
  title,
  masters,
  locale,
  dict,
}: {
  id: string;
  title: string;
  masters: PublicMaster[];
  locale: Locale;
  dict: Dictionary;
}) {
  const [master, ...others] = masters;
  if (!master) return null;
  const booking = localePath(locale, routes.booking());
  return (
    <div className="gap-x-column grid items-center gap-y-10 md:grid-cols-12">
      <div className="md:col-span-5 lg:col-span-5">
        <div className="master-photo rounded-card bg-champagne relative aspect-[4/5] overflow-clip">
          {master.photo ? (
            <Image
              src={master.photo.src}
              alt={master.photo.alt}
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              placeholder={master.photo.blurDataURL ? "blur" : "empty"}
              blurDataURL={master.photo.blurDataURL ?? undefined}
              className="object-cover"
            />
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-6 md:col-span-7 lg:col-span-6 lg:col-start-7">
        <p className="text-label text-caramel-ink uppercase">{title}</p>
        <h2 id={id} className="text-safe text-h1">
          {master.name}
        </h2>
        <p className="font-display text-ink max-w-xl text-h4">{master.role}</p>
        {master.bio ? <p className="text-ink-muted max-w-xl">{master.bio}</p> : null}
        {master.services.length ? (
          <ul className="flex flex-wrap gap-2">
            {master.services.slice(0, 6).map((service) => (
              <li key={service.id}>
                <Link
                  href={service.href}
                  prefetch={false}
                  className={cx(chip({ tone: "outline" }), "hover:border-ink min-h-10")}
                >
                  {service.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-2">
          <Link href={`${booking}?usta=${master.id}`} className={button()}>
            {dict.masters.book}
            <ArrowRightIcon size={20} className={buttonArrow} />
          </Link>
          {master.instagramUrl ? (
            <a href={master.instagramUrl} target="_blank" rel="noopener" className={textLink()}>
              <InstagramIcon size={20} />
              {dict.masters.instagram}
            </a>
          ) : null}
        </div>
        {others.length ? (
          <ul className="mt-4 flex flex-col border-t border-line">
            {others.map((other) => (
              <li key={other.id} className="border-b border-line">
                <Link
                  href={`${localePath(locale, routes.masters())}#${other.id}`}
                  className="flex min-h-14 items-center justify-between gap-4 py-3"
                >
                  <span className="font-display text-h4">{other.name}</span>
                  <span className="text-ink-muted text-small">{other.role}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
