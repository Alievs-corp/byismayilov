import Image from "next/image";

import { cx } from "@/lib/cx";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";
import type { PublicReview } from "@/lib/public/reviews";

import { card } from "../site/button";

export function ReviewRail({
  id,
  reviews,
  dict,
}: {
  id: string;
  reviews: PublicReview[];
  dict: Dictionary;
}) {
  return (
    <ul
      id={id}
      className="rail"
      style={{ "--rail-pad": "var(--spacing-gutter)" } as React.CSSProperties}
    >
      {reviews.map((review, index) => (
        <li key={review.id} data-rail-item="" data-review="">
          <figure
            className={cx(
              card({ tone: index % 3 === 1 ? "blush" : "soft" }),
              "flex h-full flex-col gap-8 p-6 sm:p-8",
            )}
          >
            <span aria-hidden="true" className="font-display text-caramel text-h1 leading-none">
              {"“"}
            </span>
            <blockquote className="font-display -mt-6 text-h4 whitespace-pre-line">
              {review.body}
            </blockquote>
            <figcaption className="mt-auto flex items-center gap-3 text-small">
              {review.photo ? (
                <Image
                  src={review.photo.src}
                  alt={review.photo.alt}
                  width={44}
                  height={44}
                  sizes="44px"
                  className="size-11 rounded-full object-cover"
                />
              ) : null}
              <span>
                <span className="block font-semibold">{review.authorName}</span>
                {review.rating ? (
                  <span className="text-ink-muted block">
                    {fill(dict.reviews.rating, { rating: review.rating })}
                  </span>
                ) : null}
              </span>
              {review.sourceUrl ? (
                <a
                  href={review.sourceUrl}
                  target="_blank"
                  rel="noopener nofollow"
                  className="relative z-1 ml-auto underline underline-offset-4"
                >
                  {dict.reviews.source}
                </a>
              ) : null}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
