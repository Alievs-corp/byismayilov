import { expect, test, type Locator } from "@playwright/test";

async function drawState(ornament: Locator) {
  return ornament.evaluate((element) =>
    [...element.querySelectorAll("path")].map((path) => {
      const style = getComputedStyle(path);
      return path.hasAttribute("data-accent")
        ? Number(style.opacity) === 1
        : Number.parseFloat(style.strokeDashoffset) === 0;
    }),
  );
}

test("home services scissors draw once the section scrolls into view", async ({ page }) => {
  await page.goto("/");
  const ornament = page.locator('[data-ornament-name="scissors-lock"]').filter({ visible: true });
  await expect(ornament).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "");
  await expect(ornament).not.toHaveAttribute("data-revealed");
  await ornament.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect(ornament).toHaveAttribute("data-revealed", "");
  await expect.poll(async () => (await drawState(ornament)).every(Boolean)).toBe(true);
});

test("gallery mirror draws on load and is complete with reduced motion", async ({ page }) => {
  await page.goto("/islerimiz");
  const ornament = page.locator('[data-ornament-name="hand-mirror"]');
  await expect(ornament).toBeVisible();
  await expect.poll(async () => (await drawState(ornament)).every(Boolean)).toBe(true);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(ornament).toBeVisible();
  expect((await drawState(ornament)).every(Boolean)).toBe(true);
});
