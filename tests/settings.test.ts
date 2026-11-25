import { randomBytes, randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { mailtoHref, telHref, whatsappHref } from "@/lib/contact-links";
import { getDb } from "@/lib/db";
import { media, settings } from "@/lib/db/schema";
import { getSiteSettings } from "@/lib/public/settings";
import {
  legalNameWithoutMmc,
  openingHoursSchema,
  settingsInputSchema,
  type SettingsDto,
  type SettingsInput,
} from "@/lib/validation/settings";

import { call, createUser, removeUsers, sessionCookie, testRun } from "./support/admin";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

const { run, domain, password } = testRun();

let owner = "";
let editor = "";
let snapshot: typeof settings.$inferSelect | undefined;
const mediaIds: Record<"square" | "wide" | "pdf" | "svg", string> = {
  square: "",
  wide: "",
  pdf: "",
  svg: "",
};

async function insertMedia(
  name: string,
  mimeType: string,
  width: number | null,
  height: number | null,
): Promise<string> {
  const extension = mimeType === "application/pdf" ? "pdf" : mimeType.split("/")[1];
  const [row] = await getDb()
    .insert(media)
    .values({
      key: `tests/${run}/${name}.${extension?.replace("+xml", "")}`,
      mimeType,
      width,
      height,
      size: 1024,
      sha256: randomBytes(32).toString("hex"),
      alt: { az: `Test ${name}` },
    })
    .returning({ id: media.id });
  return row?.id ?? "";
}

function input(overrides: Partial<SettingsInput> = {}): SettingsInput {
  return {
    logoLightId: mediaIds.svg,
    logoDarkId: mediaIds.wide,
    faviconId: mediaIds.square,
    phones: [
      { label: { az: "Ofis", ru: "Офис", en: "" }, number: "(012) 526 54 23" },
      { label: { az: "Mobil" }, number: "+994 55 255 54 23" },
    ],
    emails: [{ address: " Salon@Example.com " }, { address: "info@example.com" }],
    address: { az: "[Ünvan], Bakı", ru: "", en: "[Address], Baku" },
    mapUrl: "https://maps.google.com/?cid=1",
    workingHours: { az: "[İş saatları]", ru: "", en: "" },
    whatsappNumber: "+994 55 255 54 23",
    socials: [
      { network: "instagram", url: "https://www.instagram.com/example" },
      { network: "facebook", url: "https://www.facebook.com/example" },
    ],
    seoTitle: { az: `Salon ${run}`, ru: "", en: "" },
    seoDescription: { az: "[Təsvir]", ru: "", en: "" },
    ogImageId: mediaIds.wide,
    legalName: "byismayilov",
    bookingNotifyEmail: "",
    openingHours: "Mo-Sa 10:00-20:00",
    priceRange: "$$",
    geoLatitude: "40.409264",
    geoLongitude: 49.867092,
    ...overrides,
  };
}

async function put(body: SettingsInput, cookie = owner): Promise<Response> {
  return call("/api/admin/settings", "PUT", { cookie, body });
}

async function fields(response: Response): Promise<Record<string, string>> {
  expect(response.status).toBe(400);
  return ((await response.json()) as { fields: Record<string, string> }).fields;
}

beforeAll(async () => {
  [snapshot] = await getDb().select().from(settings).where(eq(settings.id, 1));
  const ownerUser = await createUser("owner", domain, password);
  const editorUser = await createUser("editor", domain, password);
  owner = await sessionCookie(ownerUser.email, password);
  editor = await sessionCookie(editorUser.email, password);
  mediaIds.square = await insertMedia("favicon", "image/png", 512, 512);
  mediaIds.wide = await insertMedia("wide", "image/jpeg", 1200, 630);
  mediaIds.pdf = await insertMedia("document", "application/pdf", null, null);
  mediaIds.svg = await insertMedia("logo", "image/svg+xml", null, null);
});

beforeEach(() => {
  vi.mocked(revalidateTag).mockClear();
});

afterAll(async () => {
  const db = getDb();
  if (snapshot) {
    const { id, ...columns } = snapshot;
    await db.update(settings).set(columns).where(eq(settings.id, id));
  } else {
    await db.delete(settings).where(eq(settings.id, 1));
  }
  await db.delete(media).where(inArray(media.id, Object.values(mediaIds)));
  await removeUsers(domain);
});

describe("settings API", () => {
  it("lets the owner read the settings and keeps editors out", async () => {
    const response = await call("/api/admin/settings", "GET", { cookie: owner });
    expect(response.status).toBe(200);
    const body = (await response.json()) as SettingsDto;
    expect(Array.isArray(body.phones)).toBe(true);
    expect(body.searchIndexing).toBe(true);
    expect((await call("/api/admin/settings", "GET", { cookie: editor })).status).toBe(403);
  });

  it("saves, normalises and returns the settings, then expires the public cache", async () => {
    const response = await put(input());
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    const saved = (await response.json()) as SettingsDto;
    expect(saved).toMatchObject({
      phones: [
        { label: { az: "Ofis", ru: "Офис", en: null }, number: "+994125265423" },
        { label: { az: "Mobil", ru: null, en: null }, number: "+994552555423" },
      ],
      emails: ["salon@example.com", "info@example.com"],
      address: { az: "[Ünvan], Bakı", ru: null, en: "[Address], Baku" },
      whatsappNumber: "994552555423",
      legalName: "byismayilov",
      bookingNotifyEmail: null,
      openingHours: "Mo-Sa 10:00-20:00",
      priceRange: "$$",
      geoLatitude: 40.409264,
      geoLongitude: 49.867092,
      logoLightId: mediaIds.svg,
    });
    expect(saved.media.map((item) => item.id).sort()).toEqual(
      [mediaIds.svg, mediaIds.wide, mediaIds.square].sort(),
    );
    expect(revalidateTag).toHaveBeenCalledWith("settings", { expire: 0 });

    const again = await call("/api/admin/settings", "GET", { cookie: owner });
    expect(await again.json()).toEqual(saved);
  });

  it("refuses an editor and keeps every language of a field on save", async () => {
    const refused = await put(
      input({ bookingNotifyEmail: `notify-${run}@byismayilov.test` }),
      editor,
    );
    expect(refused.status).toBe(403);

    const response = await put(
      input({
        bookingNotifyEmail: `notify-${run}@byismayilov.test`,
        address: {
          az: "[Ünvan], Bakı",
          ru: "[Адрес], Баку",
          en: "[Address], Baku",
        },
        searchIndexing: false,
      }),
    );
    expect(response.status).toBe(200);
    const saved = (await response.json()) as SettingsDto;
    expect(saved).toMatchObject({
      bookingNotifyEmail: `notify-${run}@byismayilov.test`,
      address: {
        az: "[Ünvan], Bakı",
        ru: "[Адрес], Баку",
        en: "[Address], Baku",
      },
      searchIndexing: false,
    });
    const site = await getSiteSettings();
    expect(site.searchIndexing).toBe(false);
    expect(JSON.stringify(site)).not.toContain(`notify-${run}`);
  });

  it("rejects a company name with MMC", async () => {
    const response = await put(input({ legalName: "Salon MMC" }));
    expect((await fields(response)).legalName).toContain("MMC");
    expect(revalidateTag).not.toHaveBeenCalled();

    for (const value of ["salon mmc", "MMC Salon", "Salon, Mmc.", "«Salon» MMC-si"]) {
      expect(legalNameWithoutMmc.safeParse(value).success, value).toBe(false);
    }
    for (const value of ["byismayilov", "Mmcx Group", "", null]) {
      expect(legalNameWithoutMmc.safeParse(value).success, String(value)).toBe(true);
    }
  });

  it("rejects missing media and media of the wrong kind", async () => {
    const missing = await fields(await put(input({ logoLightId: randomUUID() })));
    expect(missing.logoLightId).toBe("Şəkil tapılmadı.");

    const wrong = await fields(
      await put(
        input({
          ogImageId: mediaIds.svg,
          logoDarkId: mediaIds.pdf,
          faviconId: mediaIds.wide,
        }),
      ),
    );
    expect(Object.keys(wrong).sort()).toEqual(["faviconId", "logoDarkId", "ogImageId"]);
  });

  it("validates contact rows", async () => {
    const empty = await fields(await put(input({ phones: [] })));
    expect(empty.phones).toBe("Ən azı bir telefon nömrəsi əlavə edin.");

    const invalid = await fields(
      await put(
        input({
          phones: [
            { label: { az: "" }, number: "123" },
            { label: { az: "A" }, number: "055 255 54 23" },
            { label: { az: "B" }, number: "+994552555423" },
          ],
          emails: [{ address: "not-an-email" }],
          socials: [
            { network: "instagram", url: "http://instagram.com/example" },
            { network: "instagram", url: "https://instagram.com/example" },
          ],
          whatsappNumber: "12345",
          mapUrl: "javascript:alert(1)",
        }),
      ),
    );
    expect(Object.keys(invalid).sort()).toEqual([
      "emails.0.address",
      "mapUrl",
      "phones.0.label.az",
      "phones.0.number",
      "socials.0.url",
      "socials.1.network",
      "whatsappNumber",
    ]);

    const duplicate = await fields(
      await put(
        input({
          phones: [
            { label: { az: "A" }, number: "055 255 54 23" },
            { label: { az: "B" }, number: "+994552555423" },
          ],
        }),
      ),
    );
    expect(duplicate).toEqual({ "phones.1.number": "Bu nömrə artıq əlavə olunub." });
  });

  it("accepts empty optional fields", () => {
    const parsed = settingsInputSchema.parse(
      input({
        emails: [],
        socials: [],
        whatsappNumber: "",
        mapUrl: "",
        legalName: "",
        address: { az: "", ru: "", en: "" },
      }),
    );
    expect(parsed).toMatchObject({
      emails: [],
      whatsappNumber: null,
      mapUrl: null,
      legalName: null,
      address: null,
    });
  });
});

describe("salon location fields", () => {
  it("accepts schema.org opening hours and rejects free text", () => {
    for (const value of [
      "Mo-Sa 10:00-20:00",
      "Mo-Fr 09:00-19:00; Sa 10:00-16:00",
      "Su 00:00-24:00",
      "",
    ]) {
      expect(openingHoursSchema.safeParse(value).success, value).toBe(true);
    }
    for (const value of ["Bazar ertəsi 10-20", "Mo-Sa 10-20", "Mo-Sa 25:00-26:00"]) {
      expect(openingHoursSchema.safeParse(value).success, value).toBe(false);
    }
  });

  it("needs latitude and longitude together and in range", async () => {
    const half = await fields(await put(input({ geoLongitude: "" })));
    expect(Object.keys(half)).toEqual(["geoLongitude"]);
    const range = await fields(await put(input({ geoLatitude: "91", geoLongitude: "-181" })));
    expect(Object.keys(range).sort()).toEqual(["geoLatitude", "geoLongitude"]);
    const text = await fields(
      await put(input({ priceRange: "x".repeat(21), openingHours: "daily" })),
    );
    expect(Object.keys(text).sort()).toEqual(["openingHours", "priceRange"]);
    const parsed = settingsInputSchema.parse(
      input({ geoLatitude: "", geoLongitude: null, priceRange: "", openingHours: "" }),
    );
    expect(parsed).toMatchObject({
      geoLatitude: null,
      geoLongitude: null,
      priceRange: null,
      openingHours: null,
    });
  });
});

describe("contact links", () => {
  it("builds tel, WhatsApp and mailto links", () => {
    expect(telHref("055 255 54 23")).toBe("tel:+994552555423");
    expect(telHref("+994125265423")).toBe("tel:+994125265423");
    expect(whatsappHref("994552555423")).toBe("https://wa.me/994552555423");
    expect(whatsappHref("+994 55 255 54 23")).toBe("https://wa.me/994552555423");
    expect(whatsappHref("055 255 54 23", "Salam")).toBe("https://wa.me/994552555423?text=Salam");
    expect(mailtoHref("salon@example.com")).toBe("mailto:salon@example.com");
    expect(mailtoHref("salon@example.com", "Təklif")).toBe(
      "mailto:salon@example.com?subject=T%C9%99klif",
    );
  });
});
