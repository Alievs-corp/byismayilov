import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons/iconsax";
import { Glow } from "@/components/ornament/glow";
import { Ornament } from "@/components/ornament/ornament";
import { button, buttonArrow, textLink } from "@/components/site/button";

export function BookingBand({
  id,
  title,
  body,
  primary,
  secondary,
}: {
  id: string;
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string } | null;
}) {
  return (
    <div className="booking-band surface-dark">
      <Glow name="wide-dark" float className="booking-band-glow" />
      <Ornament
        name="hair-wave"
        width={{ base: 260, md: 380, lg: 520 }}
        ink={1.2}
        className="booking-band-ornament"
      />
      <div className="relative z-1 flex max-w-2xl flex-col items-start gap-6">
        <h2 id={id} className="text-h2 text-white">
          {title}
        </h2>
        <p className="text-on-dark-muted max-w-lg text-lead">{body}</p>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-2">
          <Link href={primary.href} className={button({ variant: "light" })}>
            {primary.label}
            <ArrowRightIcon size={20} className={buttonArrow} />
          </Link>
          {secondary ? (
            <a href={secondary.href} className={textLink({ tone: "light" })}>
              {secondary.label}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
