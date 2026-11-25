import { expect, test } from "@playwright/test";

test("masters page lists each master with a booking link that carries the master", async ({
  page,
}) => {
  await page.goto("/ustalar");
  await expect(page.getByRole("heading", { level: 1, name: "Ustalar" })).toBeVisible();
  const cards = page.locator("[data-master-card]");
  await expect(cards.first()).toBeVisible();
  const href = await cards
    .first()
    .locator('a[href*="/qeydiyyat?usta="]')
    .first()
    .getAttribute("href");
  expect(href).toMatch(/\/qeydiyyat\?usta=[0-9a-f-]{36}$/);
  await expect(page.locator('[data-ornament-name="peony"]')).toHaveCount(1);
});

test("contact page shows only real details and links the booking page", async ({ page }) => {
  await page.goto("/elaqe");
  await expect(page.getByRole("heading", { level: 1, name: "Əlaqə" })).toBeVisible();
  await expect(page.locator('a[href*="/qeydiyyat"]').first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText("undefined");
});

test("blog page renders a designed list or empty state", async ({ page }) => {
  await page.goto("/bloq");
  await expect(page.getByRole("heading", { level: 1, name: "Bloq" })).toBeVisible();
  const content = page.locator("[data-empty-state], article");
  await expect(content.first()).toBeVisible();
});

test("gallery opens a keyboard accessible lightbox when there are items", async ({ page }) => {
  await page.goto("/islerimiz");
  await expect(page.getByRole("heading", { level: 1, name: "İşlərimiz" })).toBeVisible();
  const tiles = page.locator("[data-gallery-item] button");
  test.skip((await tiles.count()) === 0, "no gallery items in this database");
  await tiles.first().focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Bağla" })).toBeFocused();
  if ((await tiles.count()) > 1) {
    const counter = dialog.locator("p[aria-live]");
    await expect(counter).toContainText("1 /");
    await page.keyboard.press("ArrowRight");
    await expect(counter).toContainText("2 /");
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(tiles.first()).toBeFocused();
});
