import { randomBytes } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import {
  galleryItems,
  masters,
  media,
  reviews,
  serviceCategories,
  serviceImages,
  services,
} from "@/lib/db/schema";
import type { MediaLibraryItem, MediaUsageItem } from "@/lib/validation/media";

import { call, createUser, removeUsers, sessionCookie, testRun } from "./support/admin";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

const { run, domain, password } = testRun();

let cookie = "";
let imageId = "";
let imageKey = "";
const ids = {
  services: [] as string[],
  categories: [] as string[],
  masters: [] as string[],
  gallery: [] as string[],
  reviews: [] as string[],
};

beforeAll(async () => {
  const user = await createUser("editor", domain, password);
  cookie = await sessionCookie(user.email, password);
  imageKey = `tests/${run}/usage.png`;
  const [row] = await getDb()
    .insert(media)
    .values({
      key: imageKey,
      mimeType: "image/png",
      width: 400,
      height: 300,
      size: 100,
      sha256: randomBytes(32).toString("hex"),
    })
    .returning({ id: media.id });
  imageId = row?.id ?? "";
});

afterAll(async () => {
  const db = getDb();
  if (ids.gallery.length)
    await db.delete(galleryItems).where(inArray(galleryItems.id, ids.gallery));
  if (ids.reviews.length) await db.delete(reviews).where(inArray(reviews.id, ids.reviews));
  if (ids.masters.length) await db.delete(masters).where(inArray(masters.id, ids.masters));
  if (ids.services.length) await db.delete(services).where(inArray(services.id, ids.services));
  if (ids.categories.length) {
    await db.delete(serviceCategories).where(inArray(serviceCategories.id, ids.categories));
  }
  await db.delete(media).where(eq(media.id, imageId));
  await removeUsers(domain);
});

describe("media usage across the salon sections", () => {
  it("lists every service, category, master, gallery item and review that uses a file", async () => {
    const db = getDb();
    const [service] = await db
      .insert(services)
      .values({ name: { az: `Xidmət ${run}` }, slug: { az: `usage-xidmet-${run}` } })
      .returning({ id: services.id });
    ids.services.push(service?.id ?? "");
    await db
      .insert(serviceImages)
      .values({ serviceId: service?.id ?? "", mediaId: imageId, position: 0 });
    const [category] = await db
      .insert(serviceCategories)
      .values({ name: { az: `Kateqoriya ${run}` }, slug: { az: `usage-kat-${run}` }, imageId })
      .returning({ id: serviceCategories.id });
    ids.categories.push(category?.id ?? "");
    const [master] = await db
      .insert(masters)
      .values({ name: { az: `Usta ${run}` }, role: { az: "[İxtisas]" }, photoId: imageId })
      .returning({ id: masters.id });
    ids.masters.push(master?.id ?? "");
    const [work] = await db
      .insert(galleryItems)
      .values({ mediaId: imageId, caption: { az: `İş ${run}` } })
      .returning({ id: galleryItems.id });
    ids.gallery.push(work?.id ?? "");
    const [before] = await db
      .insert(galleryItems)
      .values({ mediaId: imageId, beforeMediaId: imageId })
      .returning({ id: galleryItems.id });
    ids.gallery.push(before?.id ?? "");
    const [review] = await db
      .insert(reviews)
      .values({ authorName: `Müştəri ${run}`, body: "[Rəy mətni]", photoId: imageId })
      .returning({ id: reviews.id });
    ids.reviews.push(review?.id ?? "");

    const usage = await call("/api/admin/media/[id]/usage", "GET", {
      cookie,
      params: { id: imageId },
    });
    expect(usage.status).toBe(200);
    const items = (await usage.json()) as MediaUsageItem[];
    expect(items).toEqual(
      expect.arrayContaining([
        {
          kind: "services",
          id: service?.id,
          label: `Xidmət ${run}`,
          href: `/admin/services/${service?.id}`,
        },
        {
          kind: "categories",
          id: category?.id,
          label: `Kateqoriya ${run}`,
          href: `/admin/categories/${category?.id}`,
        },
        { kind: "masters", id: master?.id, label: `Usta ${run}`, href: "/admin/masters" },
        { kind: "gallery", id: work?.id, label: `İş ${run}`, href: "/admin/gallery" },
        { kind: "gallery", id: before?.id, label: null, href: "/admin/gallery" },
        { kind: "reviews", id: review?.id, label: `Müştəri ${run}`, href: "/admin/reviews" },
      ]),
    );
    expect(items).toHaveLength(6);

    const library = await call("/api/admin/media", "GET", {
      cookie,
      path: `/api/admin/media?search=${encodeURIComponent(imageKey)}&kind=image`,
    });
    const [listed] = ((await library.json()) as { rows: MediaLibraryItem[] }).rows;
    expect(listed?.usage).toMatchObject({
      services: 1,
      categories: 1,
      masters: 1,
      gallery: 2,
      reviews: 1,
    });

    const refused = await call("/api/admin/media/[id]", "DELETE", {
      cookie,
      params: { id: imageId },
    });
    expect(refused.status).toBe(409);
  });
});
