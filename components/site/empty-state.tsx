import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons/iconsax";
import { Ornament } from "@/components/ornament/ornament";
import { cx } from "@/lib/cx";

import { button, buttonArrow, textLink } from "./button";

export function EmptyState({
  title,
  body,
  actions,
  ornament = true,
  className,
}: {
  title: string;
  body?: string;
  actions: { label: string; href: string }[];
  ornament?: boolean;
  className?: string;
}) {
  const primary = actions[actions.length - 1];
  const rest = actions.slice(0, -1);
  return (
    <div
      data-empty-state=""
      className={cx(
        "rounded-card bg-cream flex flex-col items-center gap-6 px-6 py-14 text-center sm:px-10 lg:py-20",
        className,
      )}
    >
      {ornament ? (
        <Ornament
          name="blossom-spray"
          width={{ base: 120, lg: 150 }}
          reveal="draw"
          duration={1200}
          className="text-caramel-ink"
        />
      ) : null}
      <div className="max-w-xl">
        <p className="font-display text-h3">{title}</p>
        {body ? <p className="text-ink-muted mt-3">{body}</p> : null}
      </div>
      {actions.length ? (
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {primary ? (
            <Link href={primary.href} className={button()}>
              {primary.label}
              <ArrowRightIcon size={20} className={buttonArrow} />
            </Link>
          ) : null}
          {rest.map((action) => (
            <Link key={action.href} href={action.href} className={textLink()}>
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
