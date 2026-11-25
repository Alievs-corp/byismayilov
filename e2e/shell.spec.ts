import { expect, test } from "@playwright/test";

test("the menu button shows only while the header links are collapsed", async ({ page }) => {
  const menu = page.locator("header button[aria-controls='site-menu']");
  const links = page.locator("header nav").first();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ustalar");
  await expect(links).toBeVisible();
  await expect(menu).toBeHidden();

  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(links).toBeHidden();
  await expect(menu).toBeVisible();
});

test("the language menu works on top of the open menu sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ustalar");
  await page.locator("header button[aria-controls='site-menu']").click();
  await expect(page.locator("#site-menu")).toBeVisible();

  await page.getByRole("button", { name: /^Dil:/ }).click();
  const russian = page.locator("#language-menu a[hreflang='ru']");
  await expect(russian).toBeVisible();
  const box = await russian.boundingBox();
  expect(box).not.toBeNull();
  const onTop = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x!, y!)?.closest("a")?.getAttribute("hreflang"),
    [box!.x + box!.width / 2, box!.y + box!.height / 2],
  );
  expect(onTop).toBe("ru");
  await russian.click();
  await page.waitForURL("**/ru/ustalar");
});

test("public pages carry breadcrumbs as structured data only", async ({ page }) => {
  await page.goto("/ustalar");
  await expect(page.locator("main nav[aria-label='Naviqasiya yolu']")).toHaveCount(0);
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(scripts.some((text) => text.includes('"BreadcrumbList"'))).toBe(true);
});

test("the admin sign in page links back to the public site", async ({ page }) => {
  await page.goto("/admin/login");
  const back = page.locator("[data-back-to-site]");
  await expect(back).toBeVisible();
  await back.click();
  await page.waitForURL((url) => url.pathname === "/");
});
