import { writeFile } from "node:fs/promises";

import { chromium, type Page } from "@playwright/test";

type Entry = {
  at: number;
  target: number;
  current: number;
  scroll: number;
  mode: "none" | "same" | "exact" | "blend" | "nearest";
  near: number | null;
  next: number | null;
  alpha: number;
};

type Pass = { name: string; run: (page: Page) => Promise<void> };

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
};
const baseUrl = option("url", "http://localhost:3031/");
const output = option("out", "");
const only = option("only", "");

const networks = {
  slow4g: { latency: 150, download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8 },
  fast4g: { latency: 60, download: (9 * 1024 * 1024) / 8, upload: (1.5 * 1024 * 1024) / 8 },
} as const;

const devicesUnderTest = {
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  },
} as const;

async function filmRange(page: Page) {
  return page.evaluate(() => {
    const section = document.querySelector<HTMLElement>("[data-hero-film]");
    if (!section) throw new Error("No hero film on the page");
    const top = section.getBoundingClientRect().top + scrollY;
    return { top, range: section.offsetHeight - innerHeight };
  });
}

async function wheelTo(page: Page, to: number, step: number, everyMs: number) {
  let planned = await page.evaluate(() => scrollY);
  for (let guard = 0; guard < 4000; guard += 1) {
    const left = to - planned;
    if (Math.abs(left) < 1) return;
    const delta = Math.sign(left) * Math.min(Math.abs(left), step);
    planned += delta;
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(everyMs);
  }
}

async function settle(page: Page) {
  let last = -1;
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(150);
    const y = await page.evaluate(() => scrollY);
    if (Math.abs(y - last) < 0.5) return;
    last = y;
  }
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))] ?? 0;
}

function shownIndex(entry: Entry, previous: number | null): number | null {
  if (entry.mode === "exact" || entry.mode === "nearest") return entry.near;
  if (entry.mode === "blend") return entry.alpha < 0.5 ? entry.near : entry.next;
  return previous;
}

function analyse(entries: Entry[], slow: boolean) {
  const deltas: number[] = [];
  let active = 0;
  let frozen = 0;
  let longestFrozenMs = 0;
  let frozenStart = -1;
  let missedAdvances = 0;
  let blanks = 0;
  let nearest = 0;
  let nearestFar = 0;
  const covered = new Set<number>();
  let lastMove = Number.NEGATIVE_INFINITY;
  let shown: number | null = null;
  for (let index = 1; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const previous = entries[index - 1]!;
    deltas.push(entry.at - previous.at);
    const before: number | null = shown;
    shown = shownIndex(entry, shown);
    if (entry.mode === "exact" || entry.mode === "nearest") {
      if (entry.near !== null) covered.add(entry.near);
    } else if (entry.mode === "blend") {
      if (entry.near !== null && entry.alpha < 0.999) covered.add(entry.near);
      if (entry.next !== null && entry.alpha > 0.001) covered.add(entry.next);
    }
    if (Math.abs(entry.target - previous.target) > 1e-3) lastMove = entry.at;
    if (entry.at - lastMove >= 120) {
      frozenStart = -1;
      continue;
    }
    active += 1;
    if (entry.mode === "none") blanks += 1;
    if (entry.mode === "nearest") {
      nearest += 1;
      if (entry.near !== null && Math.abs(entry.near - entry.current) > 1) nearestFar += 1;
    }
    const wanted = Math.round(entry.current);
    const unchanged =
      entry.mode === "none" ||
      entry.mode === "same" ||
      (entry.mode === previous.mode &&
        entry.near === previous.near &&
        entry.next === previous.next &&
        Math.abs(entry.alpha - previous.alpha) < 0.01);
    if (wanted !== Math.round(previous.current) && shown === before && shown !== wanted) {
      missedAdvances += 1;
    }
    if (unchanged && shown !== null && Math.abs(shown - entry.current) > 1) {
      frozen += 1;
      if (frozenStart < 0) frozenStart = previous.at;
      longestFrozenMs = Math.max(longestFrozenMs, entry.at - frozenStart);
    } else {
      frozenStart = -1;
    }
  }
  const firstSeen = new Map<number, number>();
  entries.forEach((entry, index) => {
    for (const frame of [entry.near, entry.next]) {
      if (frame !== null && !firstSeen.has(frame)) firstSeen.set(frame, index);
    }
  });
  const newFrameAt = new Set(firstSeen.values());
  const longFrames = entries
    .map((entry, index) => ({ index, ms: index ? entry.at - entries[index - 1]!.at : 0, entry }))
    .filter((item) => item.ms > 34)
    .map((item) => ({
      ms: Math.round(item.ms),
      mode: item.entry.mode,
      near: item.entry.near,
      next: item.entry.next,
      firstPaintOfFrame: newFrameAt.has(item.index),
    }));
  const positions = entries.map((entry) => entry.current);
  const from = Math.ceil(Math.min(...positions));
  const to = Math.floor(Math.max(...positions));
  const skipped: number[] = [];
  for (let index = from; index <= to; index += 1) if (!covered.has(index)) skipped.push(index);
  return {
    rafFrames: entries.length,
    activeFrames: active,
    maxFrameMs: Math.round(Math.max(0, ...deltas) * 10) / 10,
    p95FrameMs: Math.round(quantile(deltas, 0.95) * 10) / 10,
    p50FrameMs: Math.round(quantile(deltas, 0.5) * 10) / 10,
    framesOver34ms: deltas.filter((delta) => delta > 34).length,
    longFramesOnNewFrame: longFrames.filter((item) => item.firstPaintOfFrame).length,
    longFrameModes: [...new Set(longFrames.map((item) => item.mode))],
    missedAdvances,
    frozenFrames: frozen,
    longestFrozenMs: Math.round(longestFrozenMs),
    blankDraws: blanks,
    nearestFallbacks: nearest,
    nearestMoreThanOneFrameAway: nearestFar,
    indexRange: [from, to],
    skippedIndices: slow ? skipped.length : null,
    skippedSample: slow ? skipped.slice(0, 20) : null,
  };
}

async function runCase(
  deviceName: keyof typeof devicesUnderTest,
  networkName: keyof typeof networks,
) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=d3d11",
      "--enable-gpu",
      "--ignore-gpu-blocklist",
      "--enable-gpu-rasterization",
    ],
  });
  const context = await browser.newContext({ ...devicesUnderTest[deviceName] });
  const page = await context.newPage();
  await page.addInitScript(`window.__name = (value) => value;
    window.__loaf = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__loaf.push({
            at: Math.round(entry.startTime),
            duration: Math.round(entry.duration),
            work: Math.round(entry.renderStart ? entry.renderStart - entry.startTime : entry.duration),
            render: Math.round(entry.styleAndLayoutStart && entry.renderStart ? entry.styleAndLayoutStart - entry.renderStart : 0),
            layout: Math.round(entry.styleAndLayoutStart ? entry.startTime + entry.duration - entry.styleAndLayoutStart : 0),
            scripts: entry.scripts.map((script) => (script.invoker || "") + " " + Math.round(script.duration)).slice(0, 3),
          });
        }
      }).observe({ type: "long-animation-frame", buffered: true });
    } catch {}`);
  page.setDefaultTimeout(120_000);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: networks[networkName].latency,
    downloadThroughput: networks[networkName].download,
    uploadThroughput: networks[networkName].upload,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const started = Date.now();
  await page.goto(baseUrl, { waitUntil: "load" });
  const lcp = await page.evaluate(
    () =>
      new Promise<{ ms: number; element: string }>((resolve) => {
        new PerformanceObserver((list) => {
          const last = list.getEntries().at(-1) as PerformanceEntry & { element?: Element };
          resolve({
            ms: Math.round(last.startTime),
            element:
              last.element?.getAttribute("data-hero-poster") !== null
                ? "hero poster"
                : (last.element?.tagName ?? "?"),
          });
        }).observe({ type: "largest-contentful-paint", buffered: true });
      }),
  );
  await page.waitForFunction(
    () => Boolean((window as Window & { __heroFilm?: unknown }).__heroFilm),
    null,
    {
      timeout: 60_000,
    },
  );
  await page.waitForTimeout(3000);
  const { top, range } = await filmRange(page);
  await page.mouse.move(devicesUnderTest[deviceName].viewport.width / 2, 400);

  const tier = await page.evaluate(
    () => (window as Window & { __heroFilm?: { tier: string } }).__heroFilm?.tier,
  );
  const frameSpan = range / 334;
  const passes: Pass[] = [
    {
      name: "slow down (wheel, ~10 frames/s)",
      run: (p) => wheelTo(p, top + range, Math.max(8, Math.round(frameSpan * 2)), 200),
    },
    { name: "fast up (wheel)", run: (p) => wheelTo(p, top, 400, 40) },
    { name: "fast down (wheel)", run: (p) => wheelTo(p, top + range, 400, 40) },
  ];
  const results: Record<string, unknown> = {};
  for (const pass of passes) {
    await settle(page);
    await page.evaluate(() =>
      (window as Window & { __heroFilm?: { trace: (on: boolean) => unknown } }).__heroFilm?.trace(
        true,
      ),
    );
    await page.evaluate(() => {
      (window as Window & { __loaf?: unknown[] }).__loaf = [];
    });
    const passStart = Date.now();
    await pass.run(page);
    await settle(page);
    const entries = (await page.evaluate(() =>
      (window as Window & { __heroFilm?: { trace: (on: boolean) => unknown } }).__heroFilm?.trace(
        false,
      ),
    )) as Entry[];
    const loaf = (await page.evaluate(() => {
      const list = (window as Window & { __loaf?: { duration: number }[] }).__loaf ?? [];
      (window as Window & { __loaf?: unknown[] }).__loaf = [];
      return [...list].sort((a, b) => b.duration - a.duration).slice(0, 3);
    })) as unknown[];
    results[pass.name] = {
      longAnimationFrames: loaf,
      seconds: Math.round((Date.now() - passStart) / 100) / 10,
      ...analyse(entries, pass.name.startsWith("slow")),
    };
  }
  const loaded = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>("[data-hero-film]");
    const film = (
      window as Window & {
        __heroFilm?: {
          stats: { decodeMs: number[]; drawMs: number[] };
          smoothness: { rich: boolean; switches: number };
          frames: () => unknown;
        };
      }
    ).__heroFilm;
    const sorted = (values: number[]) => [...values].sort((a, b) => a - b);
    const decode = sorted(film?.stats.decodeMs ?? []);
    const draw = sorted(film?.stats.drawMs ?? []);
    const pick = (values: number[], q: number) =>
      Math.round((values[Math.floor((values.length - 1) * q)] ?? 0) * 10) / 10;
    return {
      frames: Number(section?.dataset.filmLoaded ?? 0),
      megabytes: Math.round(Number(section?.dataset.filmBytes ?? 0) / 1e4) / 100,
      decodeMs: { p50: pick(decode, 0.5), p95: pick(decode, 0.95) },
      drawMs: { p50: pick(draw, 0.5), p95: pick(draw, 0.95), max: pick(draw, 1) },
      blending: film?.smoothness.rich,
      blendSwitches: film?.smoothness.switches,
      window: film?.frames(),
    };
  });
  await browser.close();
  return {
    device: deviceName,
    network: networkName,
    cpu: "4x",
    tier,
    lcp,
    loaded,
    totalSeconds: Math.round((Date.now() - started) / 1000),
    passes: results,
  };
}

const report = [];
for (const device of ["desktop", "mobile"] as const) {
  for (const network of ["slow4g", "fast4g"] as const) {
    if (only && !`${device}-${network}`.includes(only)) continue;
    const result = await runCase(device, network);
    console.log(JSON.stringify(result, null, 2));
    report.push(result);
  }
}
if (output) await writeFile(output, JSON.stringify(report, null, 2));
