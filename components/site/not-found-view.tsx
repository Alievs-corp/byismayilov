import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons/iconsax";
import { Ornament } from "@/components/ornament/ornament";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { routes } from "@/lib/routes";

import { button, buttonArrow, textLink } from "./button";

export function NotFoundView({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <section aria-labelledby="not-found-title" className="not-found">
      <div className="relative container-page flex min-h-[70svh] flex-col items-center justify-center gap-8 py-section text-center">
        <Ornament
          name="blossom-spray"
          width={{ base: 140, lg: 190 }}
          reveal="draw"
          duration={1200}
          className="text-caramel-ink"
        />
        <p aria-hidden="true" className="not-found-code">
          404
        </p>
        <div className="max-w-2xl">
          <h1 id="not-found-title" className="text-h1">
            {dict.notFound.title}
          </h1>
          <p className="text-ink-muted mt-5 text-lead">{dict.notFound.body}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <Link href={localePath(locale)} className={button()}>
            {dict.notFound.home}
            <ArrowRightIcon size={20} className={buttonArrow} />
          </Link>
          <Link href={localePath(locale, routes.services())} className={textLink()}>
            {dict.notFound.services}
          </Link>
        </div>
      </div>
    </section>
  );
}
