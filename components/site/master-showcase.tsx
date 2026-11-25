import Image from "next/image";
import Link from "next/link";

import { ArrowRightIcon, InstagramIcon } from "@/components/icons/iconsax";
import { button, buttonArrow, chip, textLink } from "@/components/site/button";
import { cx } from "@/lib/cx";
import { fill } from "@/lib/i18n/format";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { PublicMaster } from "@/lib/public/masters";
import { routes } from "@/lib/routes";

export function MasterShowcase({
  masters,
  locale,
  dict,
}: {
  masters: PublicMaster[];
  locale: Locale;
  dict: Dictionary;
}) {
  const booking = localePath(locale, routes.booking());
  const many = masters.length > 1;
  return (
    <ul className="flex flex-col gap-20 lg:gap-32">
      {masters.map((master, index) => {
        const flip = index % 2 === 1;
        return (
          <li key={master.id} id={master.id} data-master-card="" className="scroll-mt-28">
            <article className="gap-x-column grid items-center gap-y-10 md:grid-cols-12">
              <div
                data-reveal=""
                className={cx(
                  "relative md:col-span-5",
                  flip ? "md:order-2 md:col-start-8" : "md:col-start-1",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "bg-blush absolute -top-4 bottom-8 hidden w-4/5 rounded-t-full md:block",
                    flip ? "-right-6" : "-left-6",
                  )}
                />
                <div className="rounded-b-card bg-champagne relative aspect-[4/5] overflow-clip rounded-t-full">
                  {master.photo ? (
                    <Image
                      src={master.photo.src}
                      alt={master.photo.alt}
                      fill
                      sizes="(min-width: 768px) 40vw, 100vw"
                      placeholder={master.photo.blurDataURL ? "blur" : "empty"}
                      blurDataURL={master.photo.blurDataURL ?? undefined}
                      className="object-cover object-[50%_30%]"
                    />
                  ) : null}
                </div>
              </div>
              <div
                data-reveal=""
                className={cx(
                  "flex flex-col gap-6 md:col-span-6",
                  flip ? "md:order-1 md:col-start-1" : "md:col-start-7",
                )}
              >
                <p className="text-label text-caramel-ink tabular uppercase">
                  {many
                    ? fill(dict.masters.position, {
                        n: String(index + 1).padStart(2, "0"),
                        total: String(masters.length).padStart(2, "0"),
                      })
                    : dict.masters.label}
                </p>
                <h2 className="text-safe text-h1">{master.name}</h2>
                <p className="font-display text-ink max-w-xl text-h4">{master.role}</p>
                {master.bio ? <p className="text-ink-muted max-w-xl">{master.bio}</p> : null}
                {master.services.length ? (
                  <div>
                    <p className="text-label text-ink-muted mb-3 uppercase">
                      {dict.masters.services}
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {master.services.map((service) => (
                        <li key={service.id}>
                          <Link
                            href={service.href}
                            prefetch={false}
                            className={cx(
                              chip({ tone: "outline" }),
                              "hover:border-ink min-h-11 px-4",
                            )}
                          >
                            {service.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-2">
                  <Link href={`${booking}?usta=${master.id}`} className={button()}>
                    {dict.masters.book}
                    <ArrowRightIcon size={20} className={buttonArrow} />
                  </Link>
                  {master.instagramUrl ? (
                    <a
                      href={master.instagramUrl}
                      target="_blank"
                      rel="noopener"
                      className={textLink()}
                    >
                      <InstagramIcon size={20} />
                      {dict.masters.instagram}
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
