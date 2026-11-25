import "server-only";

import { asc, eq } from "drizzle-orm";

import type { DomainError } from "@/lib/api/server";
import { getDb } from "@/lib/db";
import { media, reviews } from "@/lib/db/schema";
import type { ReviewDto, ReviewValues } from "@/lib/validation/reviews";

import { checkImage } from "./content";
import { toMediaDto } from "./media";
import { nextSortOrder } from "./ordering";

const missing: DomainError = { status: 404, message: "Rəy tapılmadı." };

export async function listReviews(): Promise<ReviewDto[]> {
  const rows = await getDb()
    .select({ review: reviews, photo: media })
    .from(reviews)
    .leftJoin(media, eq(media.id, reviews.photoId))
    .orderBy(asc(reviews.sortOrder), asc(reviews.createdAt));
  return rows.map(({ review, photo }) => ({
    id: review.id,
    authorName: review.authorName,
    body: review.body,
    rating: review.rating,
    sourceUrl: review.sourceUrl,
    photo: photo ? toMediaDto(photo) : null,
    sortOrder: review.sortOrder,
    isActive: review.isActive,
  }));
}

export async function createReview(
  values: ReviewValues,
): Promise<{ id: string } | { error: DomainError }> {
  const error = await checkImage("photoId", values.photoId);
  if (error) return { error };
  const [row] = await getDb()
    .insert(reviews)
    .values({ ...values, sortOrder: nextSortOrder(reviews) })
    .returning({ id: reviews.id });
  if (!row) throw new Error("Review was not created");
  return { id: row.id };
}

export async function updateReview(
  id: string,
  values: ReviewValues,
): Promise<{ id: string } | { error: DomainError }> {
  const error = await checkImage("photoId", values.photoId);
  if (error) return { error };
  const updated = await getDb()
    .update(reviews)
    .set(values)
    .where(eq(reviews.id, id))
    .returning({ id: reviews.id });
  return updated.length ? { id } : { error: missing };
}
