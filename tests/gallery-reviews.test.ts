import { inArray, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { galleryItems, masters, media, reviews, serviceCategories } from "@/lib/db/schema";
import type { GalleryItemDto, GalleryItemInput, GalleryOptionsDto } from "@/lib/validation/gallery";
import type { ReviewDto, ReviewInput } from "@/lib/validation/reviews";

import { call, createUser, removeUsers, sessionCookie, testRun } from "./support/admin";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

const { run, domain, password } = testRun();

let editor = "";
let imageId = "";
let beforeId = "";
let videoId = "";
let pdfId = "";
let categoryId = "";
let masterId = "";

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function insertMedia(name: string, mimeType: string): Promise<string> {
  const [row] = await getDb()
    .insert(media)
    .values({
      key: `tests/${name}-${run}`,
      mimeType,
      width: mimeType.startsWith("image/") ? 1200 : null,
      height: mimeType.startsWith("image/") ? 900 : null,
      size: 1000,
      sha256: `${name}-${run}`,
    })
    .returning({ id: media.id });
  return row?.id ?? "";
}

beforeAll(async () => {
  const user = await createUser("editor", domain, password);
  editor = await sessionCookie(user.email, password);
  imageId = await insertMedia("after.jpg", "image/jpeg");
  beforeId = await insertMedia("before.jpg", "image/jpeg");
  videoId = await insertMedia("clip.mp4", "video/mp4");
  pdfId = await insertMedia("price.pdf", "application/pdf");
  const db = getDb();
  const [category] = await db
    .insert(serviceCategories)
    .values({ name: { az: `Saç ${run}` }, slug: { az: `sac-${run}` } })
    .returning({ id: serviceCategories.id });
  categoryId = category?.id ?? "";
  const [master] = await db
    .insert(masters)
    .values({ name: { az: `Usta ${run}` }, role: { az: "[İxtisas]" } })
    .returning({ id: masters.id });
  masterId = master?.id ?? "";
});

afterAll(async () => {
  const db = getDb();
  await db
    .delete(galleryItems)
    .where(inArray(galleryItems.mediaId, [imageId, videoId, beforeId, pdfId]));
  await db.delete(reviews).where(like(reviews.authorName, `%${run}`));
  await db.delete(serviceCategories).where(inArray(serviceCategories.id, [categoryId]));
  await db.delete(masters).where(sql`${masters.name} ->> 'az' like ${`%${run}`}`);
  await db.delete(media).where(inArray(media.id, [imageId, beforeId, videoId, pdfId]));
  await removeUsers(domain);
});

function galleryInput(overrides: Partial<GalleryItemInput> = {}): GalleryItemInput {
  return {
    mediaId: imageId,
    beforeMediaId: "",
    posterId: "",
    caption: { az: `[İzah] ${run}`, ru: "", en: "" },
    categoryId: "",
    masterId: "",
    isActive: true,
    ...overrides,
  };
}

async function ourGallery(): Promise<GalleryItemDto[]> {
  const all = await json<GalleryItemDto[]>(
    await call("/api/admin/gallery-items", "GET", { cookie: editor }),
  );
  return all.filter((item) => item.caption?.az.endsWith(run));
}

describe("gallery", () => {
  it("stores a before and after photo with its category and master", async () => {
    const response = await call("/api/admin/gallery-items", "POST", {
      cookie: editor,
      body: galleryInput({ beforeMediaId: beforeId, categoryId, masterId }),
    });
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
    const { id } = await json<{ id: string }>(response);
    const [item] = (await ourGallery()).filter((row) => row.id === id);
    expect(item).toMatchObject({
      media: expect.objectContaining({ id: imageId }),
      before: expect.objectContaining({ id: beforeId }),
      poster: null,
      categoryId,
      categoryName: { az: `Saç ${run}` },
      masterId,
      masterName: { az: `Usta ${run}` },
      isActive: true,
    });

    const options = await json<GalleryOptionsDto>(
      await call("/api/admin/gallery-items/options", "GET", { cookie: editor }),
    );
    expect(options.categories).toContainEqual({
      id: categoryId,
      name: `Saç ${run}`,
      parentId: null,
    });
    expect(options.masters).toContainEqual({ id: masterId, name: `Usta ${run}` });

    const video = await call("/api/admin/gallery-items/[id]", "PUT", {
      cookie: editor,
      params: { id },
      body: galleryInput({ mediaId: videoId, posterId: imageId }),
    });
    expect(video.status).toBe(200);
    const [after] = (await ourGallery()).filter((row) => row.id === id);
    expect(after).toMatchObject({
      media: expect.objectContaining({ id: videoId }),
      poster: expect.objectContaining({ id: imageId }),
      before: null,
      categoryId: null,
      masterId: null,
    });

    const hidden = await call("/api/admin/gallery-items/[id]", "PATCH", {
      cookie: editor,
      params: { id },
      body: { isActive: false },
    });
    expect(hidden.status).toBe(204);

    const removed = await call("/api/admin/gallery-items/[id]", "DELETE", {
      cookie: editor,
      params: { id },
    });
    expect(removed.status).toBe(204);
    expect((await ourGallery()).some((row) => row.id === id)).toBe(false);
  });

  it("rejects documents, a before photo on a video and unknown references", async () => {
    const cases: Partial<GalleryItemInput>[] = [
      { mediaId: "" },
      { mediaId: pdfId },
      { mediaId: videoId, beforeMediaId: beforeId },
      { beforeMediaId: videoId },
      { posterId: pdfId },
      { categoryId: "00000000-0000-4000-8000-000000000000" },
      { masterId: "00000000-0000-4000-8000-000000000000" },
    ];
    for (const overrides of cases) {
      const response = await call("/api/admin/gallery-items", "POST", {
        cookie: editor,
        body: galleryInput(overrides),
      });
      expect(response.status, JSON.stringify(overrides)).toBe(400);
    }
  });
});

function reviewInput(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return {
    authorName: `[Müştəri] ${run}`,
    body: "[Rəy mətni]",
    rating: null,
    photoId: "",
    sourceUrl: "",
    isActive: true,
    ...overrides,
  };
}

async function ourReviews(): Promise<ReviewDto[]> {
  const all = await json<ReviewDto[]>(await call("/api/admin/reviews", "GET", { cookie: editor }));
  return all.filter((review) => review.authorName.endsWith(run));
}

describe("reviews", () => {
  it("lets an editor create, update, reorder and delete a review", async () => {
    const create = async (overrides: Partial<ReviewInput> = {}) => {
      const response = await call("/api/admin/reviews", "POST", {
        cookie: editor,
        body: reviewInput(overrides),
      });
      expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
      return (await json<{ id: string }>(response)).id;
    };
    const id = await create({ rating: 5, photoId: imageId, sourceUrl: "https://example.com/r" });
    const [created] = (await ourReviews()).filter((review) => review.id === id);
    expect(created).toMatchObject({
      rating: 5,
      body: "[Rəy mətni]",
      sourceUrl: "https://example.com/r",
      photo: expect.objectContaining({ id: imageId }),
    });

    const updated = await call("/api/admin/reviews/[id]", "PUT", {
      cookie: editor,
      params: { id },
      body: reviewInput({ body: "[Başqa mətn]" }),
    });
    expect(updated.status).toBe(200);
    expect((await ourReviews()).find((review) => review.id === id)).toMatchObject({
      body: "[Başqa mətn]",
      rating: null,
      photo: null,
      sourceUrl: null,
    });

    const second = await create();
    const all = await json<ReviewDto[]>(
      await call("/api/admin/reviews", "GET", { cookie: editor }),
    );
    const orderedIds = [
      second,
      ...all.map((review) => review.id).filter((value) => value !== second),
    ];
    const reorder = await call("/api/admin/reviews/reorder", "POST", {
      cookie: editor,
      body: { orderedIds },
    });
    expect(reorder.status).toBe(204);
    const [first] = (
      await json<ReviewDto[]>(await call("/api/admin/reviews", "GET", { cookie: editor }))
    ).sort((a, b) => a.sortOrder - b.sortOrder);
    expect(first?.id).toBe(second);

    const removed = await call("/api/admin/reviews/[id]", "DELETE", {
      cookie: editor,
      params: { id },
    });
    expect(removed.status).toBe(204);
    expect((await ourReviews()).some((review) => review.id === id)).toBe(false);
  });

  it("rejects empty text, out of range ratings and bad links", async () => {
    const cases: Partial<ReviewInput>[] = [
      { authorName: "" },
      { body: " " },
      { rating: 0 },
      { rating: 6 },
      { rating: 4.5 },
      { sourceUrl: "javascript:alert(1)" },
      { photoId: pdfId },
    ];
    for (const overrides of cases) {
      const response = await call("/api/admin/reviews", "POST", {
        cookie: editor,
        body: reviewInput(overrides),
      });
      expect(response.status, JSON.stringify(overrides)).toBe(400);
    }
  });
});
