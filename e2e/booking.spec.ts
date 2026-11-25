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
  await form.locator('select[name="timeWindow"]').selectOption("evening");
  await form.locator('textarea[name="message"]').fill(message);
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
