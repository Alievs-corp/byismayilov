import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import type { SettingsTextOverrides } from "@/lib/db/schema/settings";
import az from "@/lib/i18n/dictionaries/az.json";
import { getBaseDictionary, getDictionary } from "@/lib/i18n/dictionaries";
import { applyTextOverrides, editableTextKeys, flattenDictionary } from "@/lib/i18n/text-overrides";
import type { SiteTextsDto } from "@/lib/validation/site-texts";

import { call, createUser, removeUsers, sessionCookie, testRun } from "./support/admin";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  connection: async () => undefined,
}));

const { domain, password } = testRun();

let owner = "";
let editor = "";
let previous: { textOverrides: SettingsTextOverrides } | null = null;

beforeAll(async () => {
  const [row] = await getDb().select().from(settings).where(eq(settings.id, 1));
  previous = row ? { textOverrides: row.textOverrides } : null;
  const ownerUser = await createUser("owner", domain, password);
  const editorUser = await createUser("editor", domain, password);
  owner = await sessionCookie(ownerUser.email, password);
  editor = await sessionCookie(editorUser.email, password);
});

afterAll(async () => {
  const db = getDb();
  if (previous) {
    await db
      .update(settings)
      .set({ textOverrides: previous.textOverrides })
      .where(eq(settings.id, 1));
  } else {
    await db.delete(settings).where(eq(settings.id, 1));
  }
  await removeUsers(domain);
});

describe("text overrides", () => {
  it("replaces only the named leaf of the requested language", () => {
    const next = applyTextOverrides(az, "az", {
      "booking.successTitle": { az: "Qəbul olundu", ru: "Принято" },
    });
    expect(next.booking.successTitle).toBe("Qəbul olundu");
    expect(next.booking.successBody).toBe(az.booking.successBody);
    expect(az.booking.successTitle).not.toBe("Qəbul olundu");
    expect(applyTextOverrides(az, "en", { "booking.successTitle": { az: "x" } })).toBe(az);
  });

  it("ignores keys the dictionary does not have", () => {
    const next = applyTextOverrides(az, "az", { "nothing.here": { az: "x" } });
    expect(flattenDictionary(next)).toEqual(flattenDictionary(az));
  });

  it("does not offer language names or the honeypot label for editing", () => {
    const keys = editableTextKeys(az);
    expect(keys).toContain("booking.successTitle");
    expect(keys).toContain("notFound.title");
    expect(keys.some((key) => key.startsWith("locales."))).toBe(false);
    expect(keys).not.toContain("booking.honeypot");
  });
});

describe("site texts API", () => {
  it("is closed to editors", async () => {
    expect((await call("/api/admin/site-texts", "GET", { cookie: editor })).status).toBe(403);
  });

  it("saves overrides per language, drops empty values and feeds the public dictionary", async () => {
    const saved = await call("/api/admin/site-texts", "PUT", {
      cookie: owner,
      body: {
        texts: {
          "booking.successTitle": {
            az: " Qəbul olundu ",
            ru: "Принято",
            en: "",
          },
          "notFound.title": { az: "", ru: "", en: "" },
        },
      },
    });
    expect(saved.status).toBe(200);
    const dto = (await saved.json()) as SiteTextsDto;
    expect(dto.texts).toEqual({
      "booking.successTitle": { az: "Qəbul olundu", ru: "Принято" },
    });

    expect((await getDictionary("az")).booking.successTitle).toBe("Qəbul olundu");
    expect((await getDictionary("ru")).booking.successTitle).toBe("Принято");
    const english = await getDictionary("en");
    expect(english.booking.successTitle).toBe((await getBaseDictionary("en")).booking.successTitle);
  });

  it("rejects unknown keys and texts that lose a placeholder", async () => {
    const unknown = await call("/api/admin/site-texts", "PUT", {
      cookie: owner,
      body: { texts: { "made.up": { az: "x" } } },
    });
    expect(unknown.status).toBe(400);

    const lost = await call("/api/admin/site-texts", "PUT", {
      cookie: owner,
      body: { texts: { "blog.shown": { az: "Hamısı" } } },
    });
    expect(lost.status).toBe(400);
    expect(await lost.json()).toMatchObject({
      fields: { "texts.blog.shown.az": expect.any(String) },
    });

    const kept = await call("/api/admin/site-texts", "PUT", {
      cookie: owner,
      body: { texts: { "blog.shown": { az: "{total} yazıdan {shown}" } } },
    });
    expect(kept.status).toBe(200);
  });
});
