import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons/iconsax";
import { button, buttonArrow } from "@/components/site/button";

export function HeroPlaceholder({
  brand,
  headline,
  subline,
  primary,
  secondary,
}: {
  brand: string;
  headline: string;
  subline: string | null;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}) {
  return (
    <section data-hero-placeholder="" aria-labelledby="hero-title" className="border-b border-line">
      <div className="container-page flex flex-col gap-6 pt-section pb-section">
        <p className="text-label">{brand}</p>
        <h1 id="hero-title" className="max-w-4xl text-h1">
          {headline}
        </h1>
        {subline ? <p className="text-ink-muted max-w-2xl text-lead">{subline}</p> : null}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link href={primary.href} className={button()}>
            {primary.label}
            <ArrowRightIcon size={20} className={buttonArrow} />
          </Link>
          <Link
            href={secondary.href}
            className="inline-flex min-h-11 items-center text-small font-medium uppercase underline underline-offset-4"
          >
            {secondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
