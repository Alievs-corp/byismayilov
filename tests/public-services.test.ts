import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import {
  galleryItems,
  masterServices,
  masters,
  media,
  reviews,
  serviceCategories,
  serviceCategoryLinks,
  serviceImages,
  services,
} from "@/lib/db/schema";
import type { ServicePriceKind } from "@/lib/db/schema/services";
import az from "@/lib/i18n/dictionaries/az.json";
import en from "@/lib/i18n/dictionaries/en.json";
import ru from "@/lib/i18n/dictionaries/ru.json";
import { visibleCategoryIds } from "@/lib/public/category-visibility";
import { queryGallery } from "@/lib/public/gallery";
import { queryMasters } from "@/lib/public/masters";
import { formatDuration, formatPrice } from "@/lib/public/price";
import { queryReviews } from "@/lib/public/reviews";
import { queryBookingOptions, queryServiceBySlug, queryServiceMenu } from "@/lib/public/services";

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

const run = randomUUID().slice(0, 8);
const created = {
  media: new Set<string>(),
  categories: new Set<string>(),
  services: new Set<string>(),
  masters: new Set<string>(),
  gallery: new Set<string>(),
  reviews: new Set<string>(),
};

const slug = (name: string) => `${name.toLowerCase()}-${run}`;

async function addMedia(name: string, mimeType = "image/jpeg"): Promise<string> {
  const [row] = await getDb()
    .insert(media)
    .values({
      key: `test/${run}/${name}`,
      mimeType,
      width: 800,
      height: 1000,
      size: 1000,
      sha256: randomUUID(),
      alt: { az: `${name} az` },
    })
    .returning({ id: media.id });
  created.media.add(row.id);
  return row.id;
}

async function addCategory(
  name: string,
  values: { parentId?: string; isActive?: boolean; sortOrder?: number } = {},
): Promise<string> {
  const [row] = await getDb()
    .insert(serviceCategories)
    .values({ slug: { az: slug(name), ru: `${slug(name)}-ru` }, name: { az: name }, ...values })
    .returning({ id: serviceCategories.id });
  created.categories.add(row.id);
  return row.id;
}

async function addService(
  name: string,
  values: {
    priceKind?: ServicePriceKind;
    priceAmount?: number | null;
    durationMinutes?: number | null;
    status?: "draft" | "published";
    categoryIds?: string[];
    imageIds?: string[];
    sortOrder?: number;
  } = {},
): Promise<string> {
  const [row] = await getDb()
    .insert(services)
    .values({
      slug: { az: slug(name), ru: `${slug(name)}-ru` },
      name: { az: `[${name}]`, ru: `[${name} ru]` },
      priceKind: values.priceKind ?? "on_request",
      priceAmount: values.priceAmount ?? null,
      durationMinutes: values.durationMinutes ?? null,
      status: values.status ?? "published",
      publishedAt: new Date(),
      sortOrder: values.sortOrder ?? -1000,
    })
    .returning({ id: services.id });
  created.services.add(row.id);
  if (values.categoryIds?.length) {
    await getDb()
      .insert(serviceCategoryLinks)
      .values(values.categoryIds.map((categoryId) => ({ serviceId: row.id, categoryId })));
  }
  if (values.imageIds?.length) {
    await getDb()
      .insert(serviceImages)
      .values(
        values.imageIds.map((mediaId, position) => ({ serviceId: row.id, mediaId, position })),
      );
  }
  return row.id;
}

let ids: Record<string, string> = {};

beforeAll(async () => {
  const photo = await addMedia("cover.jpg");
  const before = await addMedia("before.jpg");
  const video = await addMedia("clip.mp4", "video/mp4");
  const root = await addCategory("Root", { sortOrder: -1000 });
  const child = await addCategory("Child", { parentId: root, sortOrder: -999 });
  const hidden = await addCategory("Hidden", { isActive: false, sortOrder: -998 });
  const exact = await addService("Exact", {
    priceKind: "exact",
    priceAmount: 30,
    durationMinutes: 60,
    categoryIds: [root],
    imageIds: [photo],
  });
  const from = await addService("From", {
    priceKind: "from",
    priceAmount: 25.5,
    categoryIds: [child],
  });
  const onRequest = await addService("Request", { categoryIds: [hidden] });
  const draft = await addService("Draft", { status: "draft", categoryIds: [root] });
  const [master] = await getDb()
    .insert(masters)
    .values({
      name: { az: `[Usta ${run}]` },
      role: { az: "[İxtisas]" },
      instagramUrl: "https://www.instagram.com/example",
      sortOrder: -1000,
    })
    .returning({ id: masters.id });
  created.masters.add(master.id);
  const [inactive] = await getDb()
    .insert(masters)
    .values({ name: { az: `[Gizli ${run}]` }, role: { az: "-" }, isActive: false })
    .returning({ id: masters.id });
  created.masters.add(inactive.id);
  await getDb()
    .insert(masterServices)
    .values([
      { masterId: master.id, serviceId: exact },
      { masterId: master.id, serviceId: draft },
    ]);
  const gallery = await getDb()
    .insert(galleryItems)
    .values([
      { mediaId: photo, beforeMediaId: before, categoryId: root, sortOrder: -1000 },
      { mediaId: video, posterId: photo, categoryId: child, sortOrder: -999 },
      { mediaId: photo, isActive: false },
    ])
    .returning({ id: galleryItems.id });
  gallery.forEach((row) => created.gallery.add(row.id));
  const review = await getDb()
    .insert(reviews)
    .values([
      { authorName: `[Müştəri ${run}]`, body: "[Rəy]", rating: 5, sortOrder: -1000 },
      { authorName: `[Gizli ${run}]`, body: "-", isActive: false },
    ])
    .returning({ id: reviews.id });
  review.forEach((row) => created.reviews.add(row.id));
  ids = {
    root,
    child,
    hidden,
    exact,
    from,
    onRequest,
    draft,
    master: master.id,
    inactive: inactive.id,
  };
});

afterAll(async () => {
  const db = getDb();
  if (created.gallery.size)
    await db.delete(galleryItems).where(inArray(galleryItems.id, [...created.gallery]));
  if (created.reviews.size)
    await db.delete(reviews).where(inArray(reviews.id, [...created.reviews]));
  if (created.masters.size)
    await db.delete(masters).where(inArray(masters.id, [...created.masters]));
  if (created.services.size)
    await db.delete(services).where(inArray(services.id, [...created.services]));
  if (created.categories.size) {
    await db
      .delete(serviceCategories)
      .where(inArray(serviceCategories.parentId, [...created.categories]));
    await db
      .delete(serviceCategories)
      .where(inArray(serviceCategories.id, [...created.categories]));
  }
  if (created.media.size) await db.delete(media).where(inArray(media.id, [...created.media]));
});

describe("service prices", () => {
  it("formats every price kind in every locale", () => {
    expect(formatPrice({ kind: "exact", amount: 30 }, "az", az.services)).toBe("30 AZN");
    expect(formatPrice({ kind: "from", amount: 30 }, "az", az.services)).toBe("30 AZN-dən");
    expect(formatPrice({ kind: "on_request", amount: null }, "az", az.services)).toBe(
      "Razılaşma ilə",
    );
    expect(formatPrice({ kind: "from", amount: 30 }, "ru", ru.services)).toBe("от 30 AZN");
    expect(formatPrice({ kind: "on_request", amount: null }, "ru", ru.services)).toBe(
      "По договорённости",
    );
    expect(formatPrice({ kind: "from", amount: 30 }, "en", en.services)).toBe("from 30 AZN");
    expect(formatPrice({ kind: "exact", amount: 25.5 }, "en", en.services)).toBe("25.5 AZN");
    expect(formatPrice({ kind: "exact", amount: null }, "en", en.services)).toBe("On request");
  });

  it("formats durations and hides empty ones", () => {
    expect(formatDuration(60, az.services)).toBe("60 dəq");
    expect(formatDuration(45, ru.services)).toBe("45 мин");
    expect(formatDuration(90, en.services)).toBe("90 min");
    expect(formatDuration(null, en.services)).toBeNull();
  });
});

describe("category visibility", () => {
  it("hides inactive categories and the children of inactive parents", () => {
    const visible = visibleCategoryIds([
      { id: "a", parentId: null, isActive: true },
      { id: "b", parentId: "a", isActive: true },
      { id: "c", parentId: null, isActive: false },
      { id: "d", parentId: "c", isActive: true },
    ]);
    expect([...visible].sort()).toEqual(["a", "b"]);
  });
});

describe("services page data", () => {
  it("groups published services under active categories with child subgroups", async () => {
    const menu = await queryServiceMenu("az");
    const root = menu.groups.find((group) => group.id === ids.root);
    expect(root?.anchor).toBe(slug("Root"));
    expect(root?.services.map((service) => service.id)).toEqual([ids.exact]);
    expect(root?.children.map((group) => group.id)).toEqual([ids.child]);
    expect(root?.children[0]?.services[0]).toMatchObject({
      id: ids.from,
      price: { kind: "from", amount: 25.5 },
    });
    const exact = root?.services[0];
    expect(exact).toMatchObject({
      href: `/xidmetler/${slug("Exact")}`,
      price: { kind: "exact", amount: 30 },
      durationMinutes: 60,
    });
    expect(exact?.image?.src).toBe(`/media/test/${run}/cover.jpg`);
    const all = JSON.stringify(menu);
    expect(all).not.toContain(ids.draft);
    expect(menu.groups.some((group) => group.id === ids.hidden)).toBe(false);
    expect(menu.other.map((service) => service.id)).not.toContain(ids.onRequest);
  });

  it("uses the localized slug for the anchor and the link", async () => {
    const menu = await queryServiceMenu("ru");
    const root = menu.groups.find((group) => group.id === ids.root);
    expect(root?.anchor).toBe(`${slug("Root")}-ru`);
    expect(root?.services[0]?.href).toBe(`/ru/xidmetler/${slug("Exact")}-ru`);
    expect(root?.services[0]?.name).toBe("[Exact ru]");
  });

  it("returns a service with its images, categories and active masters", async () => {
    const service = await queryServiceBySlug("az", slug("Exact"));
    expect(service).toMatchObject({
      id: ids.exact,
      name: "[Exact]",
      price: { kind: "exact", amount: 30 },
      durationMinutes: 60,
      categories: [{ id: ids.root, href: `/xidmetler#${slug("Root")}` }],
      masters: [{ id: ids.master, name: `[Usta ${run}]` }],
    });
    expect(service?.images).toHaveLength(1);
    expect(await queryServiceBySlug("az", slug("Draft"))).toBeNull();
  });

  it("lists booking options without drafts and without duplicates", async () => {
    const groups = await queryBookingOptions("az");
    const flat = groups.flatMap((group) => group.services.map((service) => service.id));
    expect(flat).toContain(ids.exact);
    expect(flat).toContain(ids.from);
    expect(flat).not.toContain(ids.draft);
    expect(new Set(flat).size).toBe(flat.length);
    const child = groups.find((group) => group.id === ids.child);
    expect(child?.name).toBe("Root / Child");
  });
});

describe("masters, gallery and reviews", () => {
  it("lists active masters with their published services", async () => {
    const list = await queryMasters("az");
    const master = list.find((item) => item.id === ids.master);
    expect(master).toMatchObject({
      role: "[İxtisas]",
      instagramUrl: "https://www.instagram.com/example",
      services: [{ id: ids.exact, href: `/xidmetler/${slug("Exact")}` }],
    });
    expect(list.some((item) => item.id === ids.inactive)).toBe(false);
  });

  it("returns active gallery items with before images, videos and category filters", async () => {
    const gallery = await queryGallery("az", null);
    const mine = gallery.items.filter((item) => created.gallery.has(item.id));
    expect(mine).toHaveLength(2);
    const [pair, clip] = mine;
    expect(pair?.before?.src).toBe(`/media/test/${run}/before.jpg`);
    expect(pair?.image?.src).toBe(`/media/test/${run}/cover.jpg`);
    expect(clip?.video).toMatchObject({ src: `/media/test/${run}/clip.mp4`, type: "video/mp4" });
    expect(clip?.video?.poster?.src).toBe(`/media/test/${run}/cover.jpg`);
    expect(gallery.filters.map((filter) => filter.id)).toEqual(
      expect.arrayContaining([ids.root, ids.child]),
    );

    expect(gallery.hasPairs).toBe(true);
    const pairs = await queryGallery("az", "evvel-sonra");
    expect(pairs.pairsOnly).toBe(true);
    expect(pairs.active).toBeNull();
    expect(pairs.items.length).toBeGreaterThan(0);
    expect(pairs.items.every((item) => item.before !== null)).toBe(true);

    const filtered = await queryGallery("az", slug("Child"));
    expect(filtered.active?.id).toBe(ids.child);
    expect(filtered.items.every((item) => item.categoryId === ids.child)).toBe(true);
    expect(filtered.items.some((item) => created.gallery.has(item.id))).toBe(true);
  });

  it("lists only active reviews", async () => {
    const list = await queryReviews("az", 200);
    const mine = list.filter((item) => created.reviews.has(item.id));
    expect(mine).toEqual([
      expect.objectContaining({ authorName: `[Müştəri ${run}]`, body: "[Rəy]", rating: 5 }),
    ]);
  });
});
