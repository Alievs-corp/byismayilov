import Image from "next/image";
import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons/iconsax";
import { button, buttonArrow, textLink } from "@/components/site/button";
import type { PublicImage } from "@/lib/public/images";

export function HeroPlaceholder({
  brand,
  headline,
  subline,
  primary,
  secondary,
  chips = [],
  subject = null,
}: {
  brand: string;
  headline: string;
  subline: string | null;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
  chips?: string[];
  subject?: PublicImage | null;
}) {
  return (
    <section
      data-hero-placeholder=""
      data-hero-subject={subject ? "" : undefined}
      aria-labelledby="hero-title"
      className="hero-field"
    >
      <div className="hero-inner container-page">
        <p aria-hidden="true" className="hero-ghost">
          {brand}
        </p>
        {subject ? (
          <div className="hero-subject">
            <Image
              src={subject.src}
              alt={subject.alt}
              fill
              priority
              sizes="(min-width: 1024px) 26rem, (min-width: 768px) 34vw, 62vw"
              placeholder={subject.blurDataURL ? "blur" : "empty"}
              blurDataURL={subject.blurDataURL ?? undefined}
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="hero-heading">
          <h1 id="hero-title" className="hero-headline">
            {headline}
          </h1>
          {chips[0] ? (
            <span aria-hidden="true" className="glass-chip" data-chip="0">
              {chips[0]}
            </span>
          ) : null}
        </div>
        <div className="hero-aside">
          {chips[1] ? (
            <span aria-hidden="true" className="glass-chip" data-chip="1">
              {chips[1]}
            </span>
          ) : null}
          {subline ? <p className="hero-subline">{subline}</p> : null}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <Link href={primary.href} className={button({ variant: "light" })}>
              {primary.label}
              <ArrowRightIcon size={20} className={buttonArrow} />
            </Link>
            <Link href={secondary.href} className={textLink({ tone: "light" })}>
              {secondary.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
