import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

const palette = Object.fromEntries(
  [...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map((match) => [
    match[1],
    match[2]!.toLowerCase(),
  ]),
) as Record<string, string>;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const text: [string, string][] = [
  ["ink", "white"],
  ["ink", "cream"],
  ["ink", "soft"],
  ["ink", "blush"],
  ["ink", "champagne"],
  ["ink", "honey"],
  ["ink-muted", "white"],
  ["ink-muted", "cream"],
  ["ink-muted", "soft"],
  ["ink-muted", "blush"],
  ["caramel-ink", "white"],
  ["caramel-ink", "cream"],
  ["caramel-ink", "soft"],
  ["accent-ink", "white"],
  ["danger", "white"],
  ["success", "white"],
  ["warning", "white"],
  ["white", "ink"],
  ["white", "espresso"],
  ["white", "dark-raised"],
  ["accent", "dark"],
  ["accent", "dark-deep"],
  ["accent", "espresso"],
  ["on-dark-muted", "dark"],
  ["on-dark-muted", "dark-deep"],
  ["on-dark-muted", "dark-raised"],
  ["on-dark-muted", "espresso"],
];

const large: [string, string][] = [
  ["white", "caramel"],
  ["caramel", "white"],
  ["grey", "white"],
];

const boundaries: [string, string][] = [
  ["line-strong", "white"],
  ["line-strong", "cream"],
  ["ink", "soft"],
];

describe("design tokens", () => {
  it("defines every colour the contrast checks use", () => {
    for (const [a, b] of [...text, ...large, ...boundaries]) {
      expect(palette[a], a).toMatch(/^#[0-9a-f]{6}$/);
      expect(palette[b], b).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each(text)("%s on %s passes WCAG AA for body text (4.5:1)", (fg, bg) => {
    expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(large)("%s on %s passes WCAG AA for large text (3:1)", (fg, bg) => {
    expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(3);
  });

  it.each(boundaries)("%s against %s passes WCAG AA for UI boundaries (3:1)", (fg, bg) => {
    expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(3);
  });

  it("keeps purple and indigo out of the palette", () => {
    for (const [name, hex] of Object.entries(palette)) {
      const n = Number.parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      expect(b > r + 24 && b > g + 24, `${name} ${hex}`).toBe(false);
    }
  });
});
