import { expect, test, type Locator } from "@playwright/test";

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

test("header links roll to the serif label without moving and keep one name", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ustalar");
  const nav = page.locator("header nav").first();
  const current = nav.getByRole("link", { name: "Ustalar", exact: true });
  const other = nav.getByRole("link", { name: "Xidmətlər", exact: true });
  await expect(current).toHaveAttribute("aria-current", "page");
  const links = nav.locator(".header-link");
  const boxes = () =>
    links.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().toJSON()));
  const spark = (link: Locator) =>
    link.locator(".header-link-spark").evaluate((node) => getComputedStyle(node).opacity);
  await expect.poll(() => spark(current)).toBe("1");
  await expect.poll(() => spark(other)).toBe("0");

  const before = await boxes();
  await other.hover();
  const serif = other.locator(".header-link-serif > span").last();
  await expect
    .poll(() => serif.evaluate((node) => getComputedStyle(node).transform))
    .toBe("matrix(1, 0, 0, 1, 0, 0)");
  await expect.poll(() => spark(other)).toBe("1");
  expect(await boxes()).toEqual(before);
});
