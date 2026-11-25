import { randomInt, randomUUID } from "node:crypto";

import { eq, inArray, like } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { POST as submitRoute } from "@/app/api/booking-requests/route";
import { clientIp } from "@/lib/booking-requests/submit";
import { toCsv } from "@/lib/csv";
import { getDb } from "@/lib/db";
import {
  bookingRequestServices,
  bookingRequests,
  masters,
  services,
  settings,
} from "@/lib/db/schema";
import { normalizeAzerbaijaniPhone } from "@/lib/phone";
import {
  isBookableDate,
  type BookingRequestDetailDto,
  type BookingRequestListItemDto,
} from "@/lib/validation/booking-requests";

import { call, createUser, origin, removeUsers, sessionCookie, testRun } from "./support/admin";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

const mailState = vi.hoisted(() => ({ fail: false }));

vi.mock("@/lib/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail")>();
  return {
    ...actual,
    sendMail: async (message: Parameters<typeof actual.sendMail>[0]) => {
      if (mailState.fail) throw new Error("SMTP is down");
      return actual.sendMail(message);
    },
  };
});

const mailpit = process.env.MAILPIT_URL ?? "http://localhost:8025";
const { run, domain, password } = testRun();
const notifyEmail = `notify-${run}@byismayilov.test`;

let owner = "";
let editor = "";
let serviceId = "";
let draftServiceId = "";
let trashedServiceId = "";
let masterId = "";
let hiddenMasterId = "";
let savedSettings: { email: string | null; updatedAt: Date } | undefined;

function bakuDay(offset: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function fakeIp(): string {
  return `198.18.${randomInt(0, 255)}.${randomInt(1, 255)}`;
}

function submit(body: unknown, ip = fakeIp()): Promise<Response> {
  return submitRoute(
    new NextRequest(new URL("/api/booking-requests", origin), {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.9, ${ip}` },
      body: JSON.stringify(body),
    }),
  );
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    name: `Test ${run}`,
    phone: "055 255 54 23",
    serviceIds: [],
    masterId: "",
    preferredDate: "",
    timeWindow: "any",
    locale: "az",
    website: "",
    ...overrides,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function createBooking(overrides: Record<string, unknown> = {}): Promise<string> {
  const response = await submit(payload(overrides));
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
  return (await json<{ id: string }>(response)).id;
}

type MailpitSummary = { ID: string; Subject: string };

async function findMail(query: string): Promise<MailpitSummary[]> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(query)}`);
    const found = (await response.json()) as { messages: MailpitSummary[] };
    if (found.messages.length) return found.messages;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return [];
}

async function unreadCount(): Promise<number> {
  const response = await call("/api/admin/booking-requests/unread-count", "GET", {
    cookie: owner,
  });
  return (await json<{ count: number }>(response)).count;
}

async function list(query: string) {
  const response = await call("/api/admin/booking-requests", "GET", {
    cookie: editor,
    path: `/api/admin/booking-requests?${query}`,
  });
  expect(response.status).toBe(200);
  return json<{ rows: BookingRequestListItemDto[]; rowCount: number }>(response);
}

beforeAll(async () => {
  const ownerUser = await createUser("owner", domain, password);
  const editorUser = await createUser("editor", domain, password);
  owner = await sessionCookie(ownerUser.email, password);
  editor = await sessionCookie(editorUser.email, password);

  const db = getDb();
  const [published, draft, trashed] = await db
    .insert(services)
    .values([
      {
        name: { az: `Saç kəsimi ${run}`, ru: `Стрижка ${run}` },
        slug: { az: `sac-kesimi-${run}` },
        status: "published",
      },
      { name: { az: `Qaralama ${run}` }, slug: { az: `qaralama-${run}` }, status: "draft" },
      {
        name: { az: `Silinmiş ${run}` },
        slug: { az: `silinmis-${run}` },
        status: "published",
        deletedAt: new Date(),
      },
    ])
    .returning({ id: services.id });
  serviceId = published?.id ?? "";
  draftServiceId = draft?.id ?? "";
  trashedServiceId = trashed?.id ?? "";

  const [active, hidden] = await db
    .insert(masters)
    .values([
      { name: { az: `Usta ${run}` }, role: { az: "[İxtisas]" } },
      { name: { az: `Gizli usta ${run}` }, role: { az: "[İxtisas]" }, isActive: false },
    ])
    .returning({ id: masters.id });
  masterId = active?.id ?? "";
  hiddenMasterId = hidden?.id ?? "";

  [savedSettings] = await db
    .select({ email: settings.bookingNotifyEmail, updatedAt: settings.updatedAt })
    .from(settings);
  if (!savedSettings) await db.insert(settings).values({ id: 1 });
});

afterAll(async () => {
  const db = getDb();
  await db.delete(bookingRequests).where(like(bookingRequests.name, `%${run}%`));
  await db
    .delete(services)
    .where(inArray(services.id, [serviceId, draftServiceId, trashedServiceId]));
  await db.delete(masters).where(inArray(masters.id, [masterId, hiddenMasterId]));
  if (savedSettings) {
    await db
      .update(settings)
      .set({ bookingNotifyEmail: savedSettings.email, updatedAt: savedSettings.updatedAt })
      .where(eq(settings.id, 1));
  } else {
    await db.delete(settings).where(eq(settings.id, 1));
  }
  await removeUsers(domain);
});

describe("Azerbaijani phone numbers", () => {
  it.each([
    ["+994 55 255 54 23", "+994552555423"],
    ["994552555423", "+994552555423"],
    ["055 255 54 23", "+994552555423"],
    ["(055) 255-54-23", "+994552555423"],
    ["50 123 45 67", "+994501234567"],
    ["(012) 526-54-23", "+994125265423"],
  ])("normalises %s", (input, expected) => {
    expect(normalizeAzerbaijaniPhone(input)).toBe(expected);
  });

  it.each(["+7 912 123 45 67", "055 255 54", "+994 33 123 45 67", "telefon", ""])(
    "rejects %s",
    (input) => {
      expect(normalizeAzerbaijaniPhone(input)).toBeNull();
    },
  );
});

describe("preferred visit date", () => {
  it("accepts today and later days within a year in Baku time", () => {
    expect(isBookableDate(bakuDay(0))).toBe(true);
    expect(isBookableDate(bakuDay(30))).toBe(true);
    expect(isBookableDate(bakuDay(-1))).toBe(false);
    expect(isBookableDate(bakuDay(400))).toBe(false);
    expect(isBookableDate("2026-02-30")).toBe(false);
    expect(isBookableDate("tomorrow")).toBe(false);
  });
});

describe("public booking submission", () => {
  it("saves the booking with its services and master and emails the salon", async () => {
    await getDb()
      .update(settings)
      .set({ bookingNotifyEmail: notifyEmail })
      .where(eq(settings.id, 1));
    const ip = fakeIp();
    const date = bakuDay(3);
    const response = await submit(
      payload({
        name: `Leyla ${run} Əliyeva`,
        phone: "+994 (50) 111-22-33",
        serviceIds: [serviceId, serviceId],
        masterId,
        preferredDate: date,
        timeWindow: "evening",
        message: "Salam.\n<b>Uzun saç</b>, boyama da istəyirəm.",
        locale: "ru",
      }),
      ip,
    );
    expect(response.status).toBe(201);
    const { id } = await json<{ id: string }>(response);

    const db = getDb();
    const [row] = await db.select().from(bookingRequests).where(eq(bookingRequests.id, id));
    expect(row).toMatchObject({
      phone: "+994501112233",
      masterId,
      masterName: `Usta ${run}`,
      preferredDate: date,
      timeWindow: "evening",
      locale: "ru",
      status: "new",
      seenAt: null,
      adminNote: null,
    });
    expect(row?.message).toBe("Salam.\n<b>Uzun saç</b>, boyama da istəyirəm.");
    expect(row?.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.ipHash).not.toContain(ip);
    const items = await db
      .select()
      .from(bookingRequestServices)
      .where(eq(bookingRequestServices.bookingRequestId, id));
    expect(items.map((item) => [item.serviceId, item.serviceName])).toEqual([
      [serviceId, `Saç kəsimi ${run}`],
    ]);

    const [mail] = await findMail(`subject:"Leyla ${run}"`);
    expect(mail?.Subject).toBe(`Yeni qeydiyyat: Leyla ${run} Əliyeva`);
    const message = (await (await fetch(`${mailpit}/api/v1/message/${mail?.ID}`)).json()) as {
      To: { Address: string }[];
      Text: string;
      HTML: string;
    };
    expect(message.To.map((to) => to.Address)).toEqual([notifyEmail]);
    expect(message.Text).toContain(`/admin/bookings/${id}`);
    expect(message.Text).toContain("+994 50 111 22 33");
    expect(message.Text).toContain(`- Saç kəsimi ${run}`);
    expect(message.Text).toContain(`Usta: Usta ${run}`);
    expect(message.Text).toContain("Vaxt: Axşam");
    expect(message.Text).toContain(date.split("-").reverse().join("."));
    expect(message.HTML).toContain("&lt;b&gt;Uzun saç&lt;/b&gt;");
    expect(message.HTML).not.toContain("<b>Uzun");
  });

  it("accepts a booking with only a name and a phone", async () => {
    const id = await createBooking({ name: `Minimal ${run}` });
    const [row] = await getDb().select().from(bookingRequests).where(eq(bookingRequests.id, id));
    expect(row).toMatchObject({
      masterId: null,
      preferredDate: null,
      timeWindow: "any",
      message: null,
    });
  });

  it("answers a filled honeypot like a success without saving", async () => {
    const response = await submit(payload({ name: `Bot ${run}`, website: "https://spam.test" }));
    expect(response.status).toBe(201);
    const { id } = await json<{ id: string }>(response);
    const rows = await getDb()
      .select({ id: bookingRequests.id })
      .from(bookingRequests)
      .where(like(bookingRequests.name, `Bot ${run}%`));
    expect(rows).toEqual([]);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await findMail(`subject:"Bot ${run}"`)).toEqual([]);
  });

  it("rejects invalid fields with messages", async () => {
    const response = await submit(
      payload({
        phone: "+7 912 123 45 67",
        name: "A",
        preferredDate: bakuDay(-2),
        timeWindow: "night",
        serviceIds: ["not-an-id"],
      }),
    );
    expect(response.status).toBe(400);
    const body = await json<{ fields: Record<string, string> }>(response);
    expect(Object.keys(body.fields).sort()).toEqual([
      "name",
      "phone",
      "preferredDate",
      "serviceIds.0",
      "timeWindow",
    ]);
    expect(body.fields.phone).toContain("+994");
  });

  it("rejects unknown, draft or trashed services and a hidden or unknown master", async () => {
    for (const ids of [[randomUUID()], [draftServiceId], [trashedServiceId]]) {
      const response = await submit(payload({ name: `Bad service ${run}`, serviceIds: ids }));
      expect(response.status).toBe(400);
      expect(Object.keys((await json<{ fields: object }>(response)).fields)).toEqual([
        "serviceIds",
      ]);
    }
    for (const id of [hiddenMasterId, randomUUID()]) {
      const response = await submit(payload({ name: `Bad master ${run}`, masterId: id }));
      expect(response.status).toBe(400);
      expect(Object.keys((await json<{ fields: object }>(response)).fields)).toEqual(["masterId"]);
    }
    const rows = await getDb()
      .select({ id: bookingRequests.id })
      .from(bookingRequests)
      .where(like(bookingRequests.name, `Bad % ${run}`));
    expect(rows).toEqual([]);
  });

  it("refuses the sixth booking from one address within an hour", async () => {
    const ip = fakeIp();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      statuses.push((await submit(payload({ name: `Limit ${run} ${attempt}` }), ip)).status);
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
    const other = await submit(payload({ name: `Limit ${run} other` }));
    expect(other.status).toBe(201);
  });

  it("keeps the limit when one address sends many bookings at once", async () => {
    const ip = fakeIp();
    const statuses = await Promise.all(
      Array.from({ length: 12 }, (_, attempt) =>
        submit(payload({ name: `Burst ${run} ${attempt}` }), ip).then(
          (response) => response.status,
        ),
      ),
    );
    expect(statuses.filter((status) => status === 201)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(7);
  });

  it("keeps the booking when the email fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mailState.fail = true;
    try {
      const id = await createBooking({ name: `Mail down ${run}` });
      const [row] = await getDb().select().from(bookingRequests).where(eq(bookingRequests.id, id));
      expect(row?.name).toBe(`Mail down ${run}`);
      expect(error).toHaveBeenCalled();
    } finally {
      mailState.fail = false;
      error.mockRestore();
    }
  });

  it("falls back to the server address when settings has none", async () => {
    await getDb().update(settings).set({ bookingNotifyEmail: null }).where(eq(settings.id, 1));
    await createBooking({ name: `Fallback ${run}` });
    const [mail] = await findMail(`subject:"Fallback ${run}"`);
    const message = (await (await fetch(`${mailpit}/api/v1/message/${mail?.ID}`)).json()) as {
      To: { Address: string }[];
    };
    expect(message.To.map((to) => to.Address)).toEqual([process.env.BOOKING_NOTIFY_EMAIL]);
  });
});

describe("booking inbox", () => {
  it("lists newest first and filters by search, status, unread and visit date", async () => {
    const digits = String(randomInt(1_000_000, 9_999_999));
    const early = bakuDay(200);
    const late = bakuDay(210);
    const first = await createBooking({
      name: `Inbox ${run} first`,
      phone: `+99470${digits}`,
      serviceIds: [serviceId],
      preferredDate: early,
    });
    const second = await createBooking({ name: `Inbox ${run} second`, preferredDate: late });

    const byRun = await list(`search=${encodeURIComponent(`Inbox ${run}`)}&pageSize=50`);
    expect(byRun.rows.map((row) => row.id)).toEqual([second, first]);
    expect(byRun.rows.find((row) => row.id === first)).toMatchObject({
      services: [`Saç kəsimi ${run}`],
      preferredDate: early,
      status: "new",
      unread: true,
    });

    const byPhone = await list(`search=${encodeURIComponent(`070 ${digits}`)}`);
    expect(byPhone.rows.map((row) => row.id)).toEqual([first]);

    const range = await list(
      `search=${encodeURIComponent(`Inbox ${run}`)}&from=${early}&to=${bakuDay(205)}`,
    );
    expect(range.rows.map((row) => row.id)).toEqual([first]);

    const fromOnly = await list(
      `search=${encodeURIComponent(`Inbox ${run}`)}&from=${bakuDay(201)}`,
    );
    expect(fromOnly.rows.map((row) => row.id)).toEqual([second]);

    await call("/api/admin/booking-requests/[id]", "GET", {
      cookie: editor,
      params: { id: second },
    });
    const unread = await list(`search=${encodeURIComponent(`Inbox ${run}`)}&status=unread`);
    expect(unread.rows.map((row) => row.id)).toEqual([first]);

    await call("/api/admin/booking-requests/[id]", "PATCH", {
      cookie: editor,
      body: { status: "confirmed" },
      params: { id: first },
    });
    const confirmed = await list(`search=${encodeURIComponent(`Inbox ${run}`)}&status=confirmed`);
    expect(confirmed.rows.map((row) => row.id)).toEqual([first]);
    const cancelled = await list(`search=${encodeURIComponent(`Inbox ${run}`)}&status=cancelled`);
    expect(cancelled.rowCount).toBe(0);

    for (const query of ["status=spam", "from=yesterday"]) {
      const invalid = await call("/api/admin/booking-requests", "GET", {
        cookie: editor,
        path: `/api/admin/booking-requests?${query}`,
      });
      expect(invalid.status).toBe(400);
    }
  });

  it("marks a booking as seen once and updates the unread count", async () => {
    const before = await unreadCount();
    const id = await createBooking({
      name: `Detail ${run}`,
      serviceIds: [serviceId],
      masterId,
      message: "Tam mesaj mətni burada.",
    });
    expect(await unreadCount()).toBe(before + 1);

    const open = async () => {
      const response = await call("/api/admin/booking-requests/[id]", "GET", {
        cookie: editor,
        params: { id },
      });
      expect(response.status).toBe(200);
      return json<BookingRequestDetailDto>(response);
    };

    const first = await open();
    expect(first).toMatchObject({
      status: "new",
      markedSeen: true,
      unread: false,
      locale: "az",
      masterId,
      masterName: `Usta ${run}`,
      message: "Tam mesaj mətni burada.",
    });
    expect(first.seenAt).not.toBeNull();
    expect(first.services).toEqual([
      expect.objectContaining({ serviceId, name: `Saç kəsimi ${run}`, inTrash: false }),
    ]);
    expect(await unreadCount()).toBe(before);

    const second = await open();
    expect(second).toMatchObject({ status: "new", markedSeen: false, seenAt: first.seenAt });

    const missing = await call("/api/admin/booking-requests/[id]", "GET", {
      cookie: editor,
      params: { id: randomUUID() },
    });
    expect(missing.status).toBe(404);
  });

  it("saves the admin note and status separately", async () => {
    const id = await createBooking({ name: `Patch ${run}` });
    const patch = (body: unknown) =>
      call("/api/admin/booking-requests/[id]", "PATCH", { cookie: editor, body, params: { id } });

    const before = await unreadCount();
    const noted = await patch({ adminNote: "  Zəng edildi, cümə 18:00.  " });
    expect(noted.status).toBe(200);
    expect(await json<BookingRequestDetailDto>(noted)).toMatchObject({
      adminNote: "Zəng edildi, cümə 18:00.",
      status: "new",
      unread: false,
    });
    expect(await unreadCount()).toBe(before - 1);

    for (const status of ["confirmed", "done", "cancelled", "new"] as const) {
      const changed = await patch({ status });
      expect(await json<BookingRequestDetailDto>(changed)).toMatchObject({
        adminNote: "Zəng edildi, cümə 18:00.",
        status,
      });
    }

    const cleared = await patch({ adminNote: "" });
    expect(await json<BookingRequestDetailDto>(cleared)).toMatchObject({ adminNote: null });

    expect((await patch({})).status).toBe(400);
    expect((await patch({ status: "spam" })).status).toBe(400);
  });

  it("lets only the owner delete a booking", async () => {
    const id = await createBooking({ name: `Spam ${run}` });
    const byEditor = await call("/api/admin/booking-requests/[id]", "DELETE", {
      cookie: editor,
      params: { id },
    });
    expect(byEditor.status).toBe(403);

    const byOwner = await call("/api/admin/booking-requests/[id]", "DELETE", {
      cookie: owner,
      params: { id },
    });
    expect(byOwner.status).toBe(204);
    const [row] = await getDb().select().from(bookingRequests).where(eq(bookingRequests.id, id));
    expect(row).toBeUndefined();
  });

  it("exports the filtered bookings as Excel-friendly CSV", async () => {
    const date = bakuDay(5);
    await createBooking({
      name: `=HYPERLINK("https://evil.test") Export ${run}`,
      message: 'Dedi: "iki xidmət"; sonra\nzəng edin',
      serviceIds: [serviceId],
      masterId,
      preferredDate: date,
      timeWindow: "morning",
    });

    const search = encodeURIComponent(`Export ${run}`);
    const response = await call("/api/admin/booking-requests/export", "GET", {
      cookie: editor,
      path: `/api/admin/booking-requests/export?search=${search}`,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="qeydiyyatlar-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = new TextDecoder().decode(bytes).split("\r\n");
    expect(lines[0]).toBe(
      '"Göndərilib";"Ad";"Telefon";"Xidmətlər";"Usta";"İstədiyi tarix";"Vaxt";"Mesaj";"Status";"Dil";"Admin qeydi"',
    );
    const body = lines.slice(1).join("\r\n");
    expect(body).toContain(`"'=HYPERLINK(""https://evil.test"") Export ${run}"`);
    expect(body).toContain(`"'+994552555423"`);
    expect(body).toContain(`"Saç kəsimi ${run}";"Usta ${run}";"${date}";"Səhər"`);
    expect(body).toContain('"Dedi: ""iki xidmət""; sonra\nzəng edin"');
    expect(body).toContain('"Yeni";"Azərbaycanca"');
    expect(lines.length).toBe(2);

    const none = await call("/api/admin/booking-requests/export", "GET", {
      cookie: owner,
      path: `/api/admin/booking-requests/export?search=${search}&status=done`,
    });
    const empty = new TextDecoder().decode(new Uint8Array(await none.arrayBuffer()));
    expect(empty.split("\r\n")).toHaveLength(1);
  });

  it("guards every formula start character", () => {
    const csv = toCsv([["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "plain", null, 5]]);
    expect(csv.slice(1)).toBe(`"'=1+1";"'+1";"'-1";"'@SUM(A1)";"'\tx";"plain";"";"5"`);
  });
});

describe("client IP for the rate limit", () => {
  it("trusts the proxy over what the client sends", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 198.51.100.8" }))).toBe(
      "198.51.100.8",
    );
    expect(clientIp(new Headers())).toBeNull();
  });
});
