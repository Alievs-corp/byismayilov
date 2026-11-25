import { eq, inArray, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { masterServices, masters, media, services } from "@/lib/db/schema";
import type { MasterDto, MasterInput, MasterServiceOptionDto } from "@/lib/validation/masters";

import { call, createUser, removeUsers, sessionCookie, testRun } from "./support/admin";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

const { run, domain, password } = testRun();

let editor = "";
let photoId = "";
let serviceId = "";
let otherServiceId = "";
let trashedServiceId = "";

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function input(name: string, overrides: Partial<MasterInput> = {}): MasterInput {
  return {
    name: { az: `${name} ${run}`, ru: "", en: `${name} EN ${run}` },
    role: { az: "[İxtisas]", ru: "[Специализация]", en: "" },
    bio: { az: "", ru: "", en: "" },
    photoId: "",
    instagramUrl: "",
    serviceIds: [],
    isActive: true,
    ...overrides,
  };
}

async function create(name: string, overrides: Partial<MasterInput> = {}): Promise<string> {
  const response = await call("/api/admin/masters", "POST", {
    cookie: editor,
    body: input(name, overrides),
  });
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
  return (await json<{ id: string }>(response)).id;
}

async function list(): Promise<MasterDto[]> {
  const all = await json<MasterDto[]>(await call("/api/admin/masters", "GET", { cookie: editor }));
  return all.filter((master) => master.name.az.endsWith(run));
}

beforeAll(async () => {
  const user = await createUser("editor", domain, password);
  editor = await sessionCookie(user.email, password);
  const db = getDb();
  const [row] = await db
    .insert(media)
    .values({
      key: `tests/master-${run}.jpg`,
      mimeType: "image/jpeg",
      width: 800,
      height: 800,
      size: 1000,
      sha256: `master-${run}`,
    })
    .returning({ id: media.id });
  photoId = row?.id ?? "";
  const rows = await db
    .insert(services)
    .values([
      { name: { az: `Manikür ${run}` }, slug: { az: `manikur-${run}` }, status: "published" },
      { name: { az: `Boyama ${run}` }, slug: { az: `boyama-${run}` } },
      { name: { az: `Köhnə ${run}` }, slug: { az: `kohne-${run}` }, deletedAt: new Date() },
    ])
    .returning({ id: services.id });
  [serviceId, otherServiceId, trashedServiceId] = rows.map((service) => service.id) as [
    string,
    string,
    string,
  ];
});

afterAll(async () => {
  const db = getDb();
  await db.delete(masters).where(sql`${masters.name} ->> 'az' like ${`%${run}`}`);
  await db
    .delete(services)
    .where(inArray(services.id, [serviceId, otherServiceId, trashedServiceId]));
  if (photoId) await db.delete(media).where(eq(media.id, photoId));
  await removeUsers(domain);
});

describe("masters", () => {
  it("lets an editor create, update, hide, reorder and delete a master", async () => {
    const id = await create("Aysel", {
      photoId,
      bio: { az: "[Qısa bioqrafiya]", ru: "", en: "" },
      instagramUrl: "https://www.instagram.com/example",
      serviceIds: [serviceId, otherServiceId, serviceId],
    });
    expect(vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag)).toContain("content");

    const [created] = (await list()).filter((master) => master.id === id);
    expect(created).toMatchObject({
      name: { az: `Aysel ${run}`, ru: null, en: `Aysel EN ${run}` },
      role: { az: "[İxtisas]", ru: "[Специализация]", en: null },
      bio: { az: "[Qısa bioqrafiya]", ru: null, en: null },
      instagramUrl: "https://www.instagram.com/example",
      isActive: true,
    });
    expect(created?.serviceIds.sort()).toEqual([serviceId, otherServiceId].sort());
    expect(created?.photo?.id).toBe(photoId);

    const updated = await call("/api/admin/masters/[id]", "PUT", {
      cookie: editor,
      params: { id },
      body: input("Aysel", { role: { az: "[Usta]" }, serviceIds: [otherServiceId] }),
    });
    expect(updated.status).toBe(200);
    const [after] = (await list()).filter((master) => master.id === id);
    expect(after).toMatchObject({
      role: { az: "[Usta]" },
      bio: null,
      instagramUrl: null,
      photo: null,
      serviceIds: [otherServiceId],
    });

    const second = await create("Rəşad");
    const all = await json<MasterDto[]>(
      await call("/api/admin/masters", "GET", { cookie: editor }),
    );
    const orderedIds = [
      second,
      ...all.map((master) => master.id).filter((value) => value !== second),
    ];
    const reorder = await call("/api/admin/masters/reorder", "POST", {
      cookie: editor,
      body: { orderedIds },
    });
    expect(reorder.status).toBe(204);
    const stale = await call("/api/admin/masters/reorder", "POST", {
      cookie: editor,
      body: { orderedIds: orderedIds.slice(1) },
    });
    expect(stale.status).toBe(409);

    const hidden = await call("/api/admin/masters/[id]", "PATCH", {
      cookie: editor,
      params: { id },
      body: { isActive: false },
    });
    expect(hidden.status).toBe(204);
    expect((await list()).find((master) => master.id === id)?.isActive).toBe(false);

    const removed = await call("/api/admin/masters/[id]", "DELETE", {
      cookie: editor,
      params: { id },
    });
    expect(removed.status).toBe(204);
    expect((await list()).some((master) => master.id === id)).toBe(false);
    const links = await getDb()
      .select()
      .from(masterServices)
      .where(eq(masterServices.masterId, id));
    expect(links).toEqual([]);
  });

  it("offers every service that is not in the trash", async () => {
    const response = await call("/api/admin/masters/service-options", "GET", { cookie: editor });
    expect(response.status).toBe(200);
    const options = await json<MasterServiceOptionDto[]>(response);
    const ours = options.filter((option) => option.name.endsWith(run));
    expect(ours.map((option) => option.id).sort()).toEqual([serviceId, otherServiceId].sort());
    expect(ours.find((option) => option.id === otherServiceId)?.status).toBe("draft");
  });

  it("rejects missing names, bad links, photos and services", async () => {
    const cases: Partial<MasterInput>[] = [
      { name: { az: "", ru: "", en: "" } },
      { role: { az: "", ru: "", en: "" } },
      { instagramUrl: "https://example.com/aysel" },
      { instagramUrl: "http://instagram.com/aysel" },
      { instagramUrl: "https://www.instagram.com/" },
      { photoId: "00000000-0000-4000-8000-000000000000" },
      { serviceIds: ["00000000-0000-4000-8000-000000000000"] },
      { serviceIds: [trashedServiceId] },
    ];
    for (const overrides of cases) {
      const response = await call("/api/admin/masters", "POST", {
        cookie: editor,
        body: input("Səhv", overrides),
      });
      expect(response.status, JSON.stringify(overrides)).toBe(400);
    }
    expect((await list()).some((master) => master.name.az.startsWith("Səhv"))).toBe(false);
  });
});
