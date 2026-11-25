import "server-only";

import { asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { publicTags } from "@/lib/cache/tags";
import { getDb } from "@/lib/db";
import { media, reviews } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";

import { imageColumns, toPublicImage, type PublicImage } from "./images";

export type PublicReview = {
  id: string;
  authorName: string;
  body: string;
  rating: number | null;
  sourceUrl: string | null;
  photo: PublicImage | null;
};

export async function queryReviews(locale: Locale, limit = 12): Promise<PublicReview[]> {
  const rows = await getDb()
    .select({ review: reviews, ...imageColumns })
    .from(reviews)
    .leftJoin(media, eq(media.id, reviews.photoId))
    .where(eq(reviews.isActive, true))
    .orderBy(asc(reviews.sortOrder), asc(reviews.createdAt), asc(reviews.id))
    .limit(limit);
  return rows.map(({ review, ...image }) => ({
    id: review.id,
    authorName: review.authorName,
    body: review.body,
    rating: review.rating,
    sourceUrl: review.sourceUrl,
    photo: toPublicImage(image, locale, review.authorName),
  }));
}

export async function getReviews(locale: Locale): Promise<PublicReview[]> {
  "use cache";
  cacheTag(publicTags.content);
  cacheLife("hours");
  return queryReviews(locale);
}
