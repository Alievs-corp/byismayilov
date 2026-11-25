import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { e2eOwner } from "./owner";

function bakuDate(daysAhead: number): string {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(date);
}

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("E-poçt", { exact: true }).fill(e2eOwner.email);
  await page.getByLabel("Şifrə", { exact: true }).fill(e2eOwner.password);
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await page.waitForURL((url) => url.pathname === "/admin");
}

test("a visitor books online and the salon sees it in the admin inbox", async ({ page }) => {
  const run = randomUUID().slice(0, 8);
  const name = `E2E Müştəri ${run}`;
  const message = `Zəhmət olmasa axşam saatı (${run})`;
  const date = bakuDate(7);

  await page.goto("/qeydiyyat");
  const form = page.locator("[data-booking-form]");
  await expect(form).toBeVisible();
  await form.locator('input[name="name"]').fill(name);
  await form.locator('input[name="phone"]').fill("050 123 45 67");
  await form.locator('input[name="serviceIds"]').first().check();
  const master = form.locator('select[name="masterId"]');
  const masterOption = master.locator("option").nth(1);
  const masterName = (await masterOption.textContent())?.trim() ?? "";
  await master.selectOption({ index: 1 });
  await form.locator('input[name="preferredDate"]').fill(date);
  await form.locator('input[name="timeWindow"][value="evening"]').check();
  await form.locator('textarea[name="message"]').fill(message);
  await form.locator('input[name="consent"]').check();
  await form.locator('button[type="submit"]').click();
  await expect(page.locator("[data-booking-success]")).toBeVisible();

  await signIn(page);
  const badge = page.locator('[data-sidebar="menu-badge"]');
  await expect(badge).toBeVisible();
  const unreadBefore = Number(await badge.textContent());
  expect(unreadBefore).toBeGreaterThan(0);

  await page.goto("/admin/bookings");
  const row = page.getByRole("link", { name: new RegExp(name) }).first();
  await expect(row).toBeVisible();
  await row.click();
  await page.waitForURL(/\/admin\/bookings\/[0-9a-f-]+$/);

  await expect(page.getByText(name).first()).toBeVisible();
  await expect(page.getByText(message)).toBeVisible();
  if (masterName) await expect(page.getByText(masterName).first()).toBeVisible();

  await page.getByLabel("Qeydiyyatın vəziyyəti").click();
  await page.getByRole("option", { name: "Təsdiqlənib" }).click();
  await expect(page.getByText("Status: Təsdiqlənib.")).toBeVisible();

  await page.getByLabel("Qeyd", { exact: true }).fill(`Zəng edildi ${run}`);
  await page.getByRole("button", { name: "Qeydi saxla" }).click();
  await expect(page.getByText("Qeyd saxlanıldı.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Qeyd", { exact: true })).toHaveValue(`Zəng edildi ${run}`);
  if (unreadBefore === 1) await expect(badge).toBeHidden();
  else await expect(badge).toHaveText(String(unreadBefore - 1));
});

test("the services page links a service to a preselected booking form", async ({ page }) => {
  await page.goto("/xidmetler");
  await expect(page.locator("[data-service-category]").first()).toBeVisible();
  await expect(page.locator("[data-category-bar] a").first()).toBeVisible();
  const book = page.locator("[data-service-row] [data-service-book]").first();
  await expect(book).toBeVisible();
  await book.click();
  await page.waitForURL(/\/qeydiyyat\?xidmet=[0-9a-f-]+$/);
  await expect(page.locator('input[name="serviceIds"]:checked')).toHaveCount(1);

  await page.goto("/xidmetler");
  await page.locator("[data-service-row] a.card-link").first().click();
  await page.waitForURL(/\/xidmetler\/[^/]+$/);
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator("[data-service-price]").first()).toBeVisible();
  await page.locator("[data-service-book]").first().click();
  await page.waitForURL(/\/qeydiyyat\?xidmet=/);
});

test("the booking form explains what is missing before sending", async ({ page }) => {
  await page.goto("/qeydiyyat");
  const form = page.locator("[data-booking-form]");
  await form.locator('button[type="submit"]').click();
  await expect(
    form.locator("#" + (await form.locator('input[name="name"]').getAttribute("id")) + "-error"),
  ).toBeVisible();
  await expect(form.getByText("Davam etmək üçün razılığınızı bildirin.")).toBeVisible();
  await expect(page.locator("[data-booking-success]")).toHaveCount(0);
});
