import { randomBytes } from "node:crypto";

import { inArray } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { media, serviceCategories as categories, services } from "@/lib/db/schema";
import type { CategoryNodeDto } from "@/lib/validation/categories";
import type { MediaDto, MediaLibraryItem, UploadTicket } from "@/lib/validation/media";
import type { ServiceDetailDto, ServiceInput, ServiceListItemDto } from "@/lib/validation/services";

import { call, createUser, removeUsers, sessionCookie, testRun } from "./support/admin";
import { ensureBucket, objectExists, removeObject } from "./support/storage";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));

const { run, domain, password } = testRun();
const created = {
  services: new Set<string>(),
  categories: new Set<string>(),
  media: new Map<string, string>(),
};

let owner = "";
let editor = "";

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function noiseImage(): Promise<Buffer> {
  return sharp(randomBytes(64 * 48 * 3), { raw: { width: 64, height: 48, channels: 3 } })
    .png()
    .toBuffer();
}

async function upload(
  fileName: string,
  contentType: string,
  body: Buffer,
): Promise<{ response: Response; ticket: UploadTicket }> {
  const ticketResponse = await call("/api/admin/media/uploads", "POST", {
    cookie: owner,
    body: { fileName, contentType, size: body.length },
  });
  expect(ticketResponse.status).toBe(201);
  const ticket = await json<UploadTicket>(ticketResponse);
  const put = await fetch(ticket.url, {
    method: "PUT",
    body: new Uint8Array(body),
    headers: ticket.headers,
  });
  expect(put.status).toBe(200);
  const response = await call("/api/admin/media", "POST", {
    cookie: owner,
    body: { key: ticket.key },
  });
  return { response, ticket };
}

async function uploadMedia(fileName: string, contentType: string, body: Buffer): Promise<MediaDto> {
  const { response } = await upload(fileName, contentType, body);
  expect(response.status).toBe(201);
  const item = await json<MediaDto>(response);
  created.media.set(item.id, item.key);
  return item;
}

async function createCategory(name: string, parentId: string | null = null): Promise<string> {
  const response = await call("/api/admin/categories", "POST", {
    cookie: owner,
    body: {
      name: { az: name },
      slug: { az: `${run}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` },
      description: null,
      parentId,
      imageId: null,
      isActive: true,
      seoTitle: null,
      seoDescription: null,
    },
  });
  expect(response.status).toBe(201);
  const { id } = await json<{ id: string }>(response);
  created.categories.add(id);
  return id;
}

function serviceInput(overrides: Partial<ServiceInput> = {}): ServiceInput {
  return {
    name: { az: `Test xidmət ${run}`, ru: "", en: "" },
    slug: { az: `test-xidmet-${run}`, ru: "", en: "" },
    shortDescription: null,
    description: null,
    categoryIds: [],
    priceKind: "on_request",
    priceAmount: null,
    durationMinutes: null,
    images: [],
    seoTitle: null,
    seoDescription: null,
    status: "draft",
    ...overrides,
  };
}

async function createService(input: ServiceInput): Promise<string> {
  const response = await call("/api/admin/services", "POST", { cookie: owner, body: input });
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
  const { id } = await json<{ id: string }>(response);
  created.services.add(id);
  return id;
}

async function getService(id: string): Promise<ServiceDetailDto> {
  const response = await call("/api/admin/services/[id]", "GET", { cookie: owner, params: { id } });
  expect(response.status).toBe(200);
  return json<ServiceDetailDto>(response);
}

async function listServices(query: string): Promise<ServiceListItemDto[]> {
  const response = await call("/api/admin/services", "GET", {
    cookie: owner,
    path: `/api/admin/services?${query}`,
  });
  expect(response.status).toBe(200);
  return (await json<{ rows: ServiceListItemDto[] }>(response)).rows;
}

beforeAll(async () => {
  await ensureBucket();
  const ownerUser = await createUser("owner", domain, password);
  const editorUser = await createUser("editor", domain, password);
  owner = await sessionCookie(ownerUser.email, password);
  editor = await sessionCookie(editorUser.email, password);
});

beforeEach(() => {
  vi.mocked(revalidateTag).mockClear();
});

afterAll(async () => {
  const db = getDb();
  if (created.services.size) {
    await db.delete(services).where(inArray(services.id, [...created.services]));
  }
  const categoryIds = [...created.categories];
  if (categoryIds.length) {
    await db.update(categories).set({ parentId: null }).where(inArray(categories.id, categoryIds));
    await db.delete(categories).where(inArray(categories.id, categoryIds));
  }
  if (created.media.size) {
    await db.delete(media).where(inArray(media.id, [...created.media.keys()]));
    for (const key of created.media.values()) await removeObject(key);
  }
  await removeUsers(domain);
});

describe("media uploads", () => {
  it("rejects a file type the library does not accept", async () => {
    const response = await call("/api/admin/media/uploads", "POST", {
      cookie: owner,
      body: { fileName: "script.html", contentType: "text/html", size: 120 },
    });
    expect(response.status).toBe(400);
  });

  it("rejects an oversized file before issuing an upload URL", async () => {
    const response = await call("/api/admin/media/uploads", "POST", {
      cookie: owner,
      body: { fileName: "huge.jpg", contentType: "image/jpeg", size: 200 * 1024 * 1024 },
    });
    expect(response.status).toBe(400);
    expect((await json<{ fields: Record<string, string> }>(response)).fields).toHaveProperty(
      "size",
    );
  });

  it("deletes an upload whose content does not match its type", async () => {
    const { response, ticket } = await upload(
      "fake.png",
      "image/png",
      Buffer.from("<script>alert(1)</script>"),
    );
    expect(response.status).toBe(400);
    expect(await objectExists(ticket.key)).toBe(false);
  });

  it("stores dimensions and a placeholder for an image", async () => {
    const image = await uploadMedia("Saç düzümü.png", "image/png", await noiseImage());
    expect(image).toMatchObject({ mimeType: "image/png", width: 64, height: 48 });
    expect(image.key).toMatch(/^uploads\/\d{4}\/\d{2}\/sac-duzumu-[0-9a-f]{8}\.png$/);
    const [row] = await getDb()
      .select()
      .from(media)
      .where(inArray(media.id, [image.id]));
    expect(row?.lqip).toMatch(/^data:image\/webp;base64,/);
  });
});

describe("categories", () => {
  it("keeps the tree two levels deep and reorders siblings", async () => {
    const parent = await createCategory("Parent");
    const child = await createCategory("Child", parent);
    const second = await createCategory("Second", parent);

    const deep = await call("/api/admin/categories", "POST", {
      cookie: owner,
      body: {
        name: { az: "Deep" },
        slug: { az: `${run}-deep` },
        description: null,
        parentId: child,
        imageId: null,
        isActive: true,
        seoTitle: null,
        seoDescription: null,
      },
    });
    expect(deep.status).toBe(400);

    const reorder = await call("/api/admin/categories/reorder", "POST", {
      cookie: owner,
      body: { parentId: parent, orderedIds: [second, child] },
    });
    expect(reorder.status).toBe(204);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith("catalog", { expire: 0 });

    const list = await json<CategoryNodeDto[]>(
      await call("/api/admin/categories", "GET", { cookie: owner }),
    );
    const order = list
      .filter((node) => node.parentId === parent)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((node) => node.id);
    expect(order).toEqual([second, child]);

    const parentWithChildren = await call("/api/admin/categories/reorder", "POST", {
      cookie: owner,
      body: {
        parentId: second,
        orderedIds: [parent],
      },
    });
    expect(parentWithChildren.status).toBe(400);
  });

  it("rejects a duplicate slug with a field error", async () => {
    await createCategory("Unique");
    const response = await call("/api/admin/categories", "POST", {
      cookie: owner,
      body: {
        name: { az: "Unique again" },
        slug: { az: `${run}-unique` },
        description: null,
        parentId: null,
        imageId: null,
        isActive: true,
        seoTitle: null,
        seoDescription: null,
      },
    });
    expect(response.status).toBe(409);
    expect((await json<{ fields: Record<string, string> }>(response)).fields).toHaveProperty(
      "slug.az",
    );
  });
});

describe("services", () => {
  it("rejects an invalid payload with Azerbaijani field messages", async () => {
    const response = await call("/api/admin/services", "POST", {
      cookie: owner,
      body: {
        name: { az: "" },
        slug: { az: "Bad Slug" },
        images: [{ mediaId: "not-a-uuid", alt: { az: "" } }],
        priceKind: "cheap",
        durationMinutes: -5,
        status: "maybe",
      },
    });
    expect(response.status).toBe(400);
    const body = await json<{ fields: Record<string, string> }>(response);
    expect(Object.keys(body.fields)).toEqual(
      expect.arrayContaining([
        "name.az",
        "slug.az",
        "images.0.mediaId",
        "images.0.alt.az",
        "priceKind",
        "durationMinutes",
        "status",
        "categoryIds",
      ]),
    );
    expect(body.fields["name.az"]).toBe("Xidmətin adını yazın.");
  });

  it("needs an amount unless the price is on request, and drops it when it is", async () => {
    const missing = await call("/api/admin/services", "POST", {
      cookie: owner,
      body: serviceInput({ priceKind: "from", slug: { az: `no-price-${run}` } }),
    });
    expect(missing.status).toBe(400);
    expect((await json<{ fields: Record<string, string> }>(missing)).fields).toHaveProperty(
      "priceAmount",
      "Qiyməti AZN ilə yazın.",
    );

    const precise = await call("/api/admin/services", "POST", {
      cookie: owner,
      body: serviceInput({
        priceKind: "exact",
        priceAmount: "12.345",
        slug: { az: `fraction-${run}` },
      }),
    });
    expect(precise.status).toBe(400);

    const negative = await call("/api/admin/services", "POST", {
      cookie: owner,
      body: serviceInput({ priceKind: "exact", priceAmount: -1, slug: { az: `negative-${run}` } }),
    });
    expect(negative.status).toBe(400);

    const onRequest = await createService(
      serviceInput({
        priceKind: "on_request",
        priceAmount: "40",
        durationMinutes: "90",
        slug: { az: `on-request-${run}` },
      }),
    );
    expect(await getService(onRequest)).toMatchObject({
      priceKind: "on_request",
      priceAmount: null,
      durationMinutes: 90,
    });

    const exact = await createService(
      serviceInput({
        priceKind: "exact",
        priceAmount: "25,50",
        slug: { az: `exact-${run}` },
      }),
    );
    expect(await getService(exact)).toMatchObject({ priceKind: "exact", priceAmount: 25.5 });
  });

  it("publishes a service without images", async () => {
    const id = await createService(
      serviceInput({ status: "published", slug: { az: `no-images-${run}` } }),
    );
    expect((await getService(id)).status).toBe("published");
  });

  it("creates, publishes, reorders, duplicates, trashes and purges a service", async () => {
    const parent = await createCategory("Sac");
    const child = await createCategory("Boyama", parent);
    const images = await Promise.all(
      [1, 2, 3].map(async (n) => uploadMedia(`foto-${n}.png`, "image/png", await noiseImage())),
    );

    const input = serviceInput({
      status: "published",
      categoryIds: [child],
      priceKind: "from",
      priceAmount: 30,
      durationMinutes: 60,
      images: images.map((image, index) => ({
        mediaId: image.id,
        alt: { az: `Foto ${index + 1}`, ru: index === 0 ? "Фото 1" : "", en: "" },
      })),
      seoTitle: { az: "[Xidmət başlığı]" },
    });
    const id = await createService(input);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith("catalog", { expire: 0 });

    const detail = await getService(id);
    expect(detail).toMatchObject({
      status: "published",
      categoryIds: [child],
      priceKind: "from",
      priceAmount: 30,
      durationMinutes: 60,
      seoTitle: { az: "[Xidmət başlığı]", ru: null, en: null },
    });
    expect(detail.publishedAt).not.toBeNull();
    expect(detail.images.map((image) => image.mediaId)).toEqual(images.map((image) => image.id));
    expect(detail.images[0]?.alt).toEqual({ az: "Foto 1", ru: "Фото 1", en: null });

    const inParent = await listServices(`categoryId=${parent}&status=published&search=${run}`);
    expect(inParent.map((row) => row.id)).toContain(id);
    const drafts = await listServices(`status=draft&search=${run}`);
    expect(drafts.map((row) => row.id)).not.toContain(id);

    const reversed = [...input.images].reverse();
    const update = await call("/api/admin/services/[id]", "PUT", {
      cookie: owner,
      params: { id },
      body: { ...input, images: reversed },
    });
    expect(update.status).toBe(200);
    expect((await getService(id)).images.map((image) => image.mediaId)).toEqual(
      reversed.map((image) => image.mediaId),
    );
    const [thumbnail] = await listServices(`search=${run}&status=published`);
    expect(thumbnail?.thumbnail?.src).toBe(`/media/${images[2]?.key}`);

    const conflict = await call("/api/admin/services", "POST", {
      cookie: owner,
      body: serviceInput({ slug: input.slug }),
    });
    expect(conflict.status).toBe(409);
    expect((await json<{ fields: Record<string, string> }>(conflict)).fields).toHaveProperty(
      "slug.az",
    );

    const slugCheck = await call("/api/admin/slugs", "GET", {
      cookie: owner,
      path: `/api/admin/slugs?entity=service&slug=${input.slug.az}`,
    });
    expect(await json(slugCheck)).toEqual({
      available: false,
      suggestion: `${input.slug.az}-2`,
    });

    const copyResponse = await call("/api/admin/services/[id]/duplicate", "POST", {
      cookie: owner,
      params: { id },
    });
    expect(copyResponse.status).toBe(201);
    const copyId = (await json<{ id: string }>(copyResponse)).id;
    created.services.add(copyId);
    const copy = await getService(copyId);
    expect(copy).toMatchObject({
      status: "draft",
      categoryIds: [child],
      priceKind: "from",
      priceAmount: 30,
    });
    expect(copy.slug.az).toBe(`${input.slug.az}-kopiya`);
    expect(copy.name.az).toBe(`${input.name.az} (kopiya)`);
    expect(copy.images).toHaveLength(3);

    const usage = await call("/api/admin/media", "GET", {
      cookie: owner,
      path: `/api/admin/media?search=${encodeURIComponent(images[0]?.key ?? "")}&kind=image`,
    });
    const [usedImage] = (await json<{ rows: MediaLibraryItem[] }>(usage)).rows;
    expect(usedImage?.usage.services).toBe(2);
    const inUse = await call("/api/admin/media/[id]", "DELETE", {
      cookie: owner,
      params: { id: images[0]?.id ?? "" },
    });
    expect(inUse.status).toBe(409);

    const trash = await call("/api/admin/services/bulk", "POST", {
      cookie: owner,
      body: { action: "trash", ids: [id, copyId] },
    });
    expect(await json(trash)).toEqual({ updated: 2, skipped: 0 });
    expect((await listServices(`search=${run}`)).map((row) => row.id)).not.toContain(id);
    expect((await listServices(`search=${run}&status=trash`)).map((row) => row.id)).toEqual(
      expect.arrayContaining([id, copyId]),
    );

    const editorPurge = await call("/api/admin/services/bulk", "POST", {
      cookie: editor,
      body: { action: "purge", ids: [copyId] },
    });
    expect(editorPurge.status).toBe(403);

    const restore = await call("/api/admin/services/bulk", "POST", {
      cookie: editor,
      body: { action: "restore", ids: [id] },
    });
    expect(await json(restore)).toEqual({ updated: 1, skipped: 0 });
    expect((await getService(id)).status).toBe("draft");

    const purge = await call("/api/admin/services/bulk", "POST", {
      cookie: owner,
      body: { action: "purge", ids: [copyId, id] },
    });
    expect(await json(purge)).toEqual({ updated: 1, skipped: 1 });
    const gone = await call("/api/admin/services/[id]", "GET", {
      cookie: owner,
      params: { id: copyId },
    });
    expect(gone.status).toBe(404);

    const move = await call("/api/admin/categories/[id]", "DELETE", {
      cookie: owner,
      params: { id: child },
      body: { moveServicesTo: parent },
    });
    expect(move.status).toBe(204);
    created.categories.delete(child);
    expect((await getService(id)).categoryIds).toEqual([parent]);
    const after = await json<CategoryNodeDto[]>(
      await call("/api/admin/categories", "GET", { cookie: owner }),
    );
    expect(after.find((node) => node.id === parent)?.serviceCount).toBe(1);
  });

  it("lists names and categories in every locale for the admin language switch", async () => {
    const category = await createCategory(`Dilli ${run}`);
    const id = await createService(
      serviceInput({
        name: { az: `Dilli xidmət ${run}`, ru: `Услуга ${run}`, en: "" },
        slug: { az: `dilli-xidmet-${run}` },
        categoryIds: [category],
      }),
    );
    const row = (await listServices(`search=${run}`)).find((item) => item.id === id);
    expect(row?.name).toEqual({
      az: `Dilli xidmət ${run}`,
      ru: `Услуга ${run}`,
      en: null,
    });
    expect(row?.slug).toEqual(expect.objectContaining({ az: `dilli-xidmet-${run}` }));
    expect(row?.categories).toEqual([expect.objectContaining({ az: `Dilli ${run}` })]);

    const nodes = await json<CategoryNodeDto[]>(
      await call("/api/admin/categories", "GET", { cookie: owner }),
    );
    expect(nodes.find((node) => node.id === category)?.name).toEqual(
      expect.objectContaining({ az: `Dilli ${run}` }),
    );
  });

  it("features services from the form and in bulk, and keeps copies off the home page", async () => {
    const featured = await createService(
      serviceInput({
        name: { az: `Ana səhifə ${run}` },
        slug: { az: `ana-sehife-${run}` },
        isFeatured: true,
      }),
    );
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith("catalog", { expire: 0 });
    const plain = await createService(
      serviceInput({ name: { az: `Adi ${run}` }, slug: { az: `adi-${run}` } }),
    );
    expect((await getService(featured)).isFeatured).toBe(true);
    expect((await getService(plain)).isFeatured).toBe(false);
    const listed = await listServices(`search=${run}`);
    expect(listed.find((row) => row.id === featured)?.isFeatured).toBe(true);
    expect(listed.find((row) => row.id === plain)?.isFeatured).toBe(false);

    const featuredInput = serviceInput({
      name: { az: `Ana səhifə ${run}` },
      slug: { az: `ana-sehife-${run}` },
      isFeatured: false,
    });
    const update = await call("/api/admin/services/[id]", "PUT", {
      cookie: editor,
      params: { id: featured },
      body: featuredInput,
    });
    expect(update.status).toBe(200);
    expect((await getService(featured)).isFeatured).toBe(false);

    vi.mocked(revalidateTag).mockClear();
    const feature = await call("/api/admin/services/bulk", "POST", {
      cookie: editor,
      body: { action: "feature", ids: [featured, plain] },
    });
    expect(await json(feature)).toEqual({ updated: 2, skipped: 0 });
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith("catalog", { expire: 0 });
    expect((await getService(plain)).isFeatured).toBe(true);

    const copyResponse = await call("/api/admin/services/[id]/duplicate", "POST", {
      cookie: owner,
      params: { id: plain },
    });
    expect(copyResponse.status).toBe(201);
    const copyId = (await json<{ id: string }>(copyResponse)).id;
    created.services.add(copyId);
    expect((await getService(copyId)).isFeatured).toBe(false);

    await call("/api/admin/services/bulk", "POST", {
      cookie: owner,
      body: { action: "trash", ids: [plain] },
    });
    const unfeature = await call("/api/admin/services/bulk", "POST", {
      cookie: owner,
      body: { action: "unfeature", ids: [featured, plain] },
    });
    expect(await json(unfeature)).toEqual({ updated: 1, skipped: 1 });
    expect((await getService(featured)).isFeatured).toBe(false);
    expect((await getService(plain)).isFeatured).toBe(true);
  });

  it("deletes an unused file from the library and storage", async () => {
    const image = await uploadMedia("unused.png", "image/png", await noiseImage());
    const response = await call("/api/admin/media/[id]", "DELETE", {
      cookie: editor,
      params: { id: image.id },
    });
    expect(response.status).toBe(204);
    created.media.delete(image.id);
    expect(await objectExists(image.key)).toBe(false);
  });

  it("answers 404 for a malformed id instead of a database error", async () => {
    const response = await call("/api/admin/services/[id]", "GET", {
      cookie: owner,
      params: { id: "not-a-uuid" },
    });
    expect(response.status).toBe(404);
  });
});
