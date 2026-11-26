import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";

type Entry = {
  at: number;
  target: number;
  current: number;
  scroll: number;
  mode: "none" | "same" | "exact" | "nearest" | "proxy" | "blend";
  near: number | null;
  next?: number | null;
  alpha?: number;
  proxy?: boolean;
  warped?: boolean;
};

type Pass = { name: string; slow: boolean; run: (page: Page) => Promise<void> };

type FilmHandle = {
  tier: string;
  trace: (on: boolean) => Entry[] | null;
  position: () => {
    current: number;
    drawn: number;
    frame?: number | null;
    resting: number | null;
  };
  stats: { decodeMs: number[]; drawMs: number[] };
  frames: () => Record<string, unknown>;
};

type FilmWindow = Window & {
  __heroFilm?: FilmHandle;
  __heroFrames?: string;
  __loaf?: { duration: number }[];
};

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
};
const baseUrl = option("url", "http://localhost:3031/");
const output = option("out", "");
const only = option("only", "");
const shotsDir = option("shots", "");
const shotFrames = option("shot-frames", "55,177")
  .split(",")
  .map((value) => Number(value))
  .filter((value) => Number.isFinite(value));
const caseTimeoutMs = Number(option("timeout", "600000"));

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

type DeviceName = keyof typeof devicesUnderTest;
type NetworkName = keyof typeof networks;

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
    if (Math.abs(y - last) < 0.5) break;
    last = y;
  }
  await page.waitForTimeout(500);
}

function filmPosition(page: Page) {
  return page.evaluate(() => (window as FilmWindow).__heroFilm?.position().current ?? 0);
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))] ?? 0;
}

function shownIndex(entry: Entry, previous: number | null): number | null {
  if (entry.mode === "exact" || entry.mode === "nearest" || entry.mode === "proxy") {
    return entry.near;
  }
  if (entry.mode === "blend") return (entry.alpha ?? 0) < 0.5 ? entry.near : (entry.next ?? null);
  return previous;
}

function isDissolve(entry: Entry) {
  const alpha = entry.alpha ?? 0;
  return entry.mode === "blend" && alpha >= 1 / 255 && alpha <= 1 - 1 / 255;
}

function analyse(entries: Entry[], slow: boolean) {
  const deltas: number[] = [];
  const lag: number[] = [];
  let active = 0;
  let paints = 0;
  let frozen = 0;
  let longestFrozenMs = 0;
  let frozenStart = -1;
  let missedAdvances = 0;
  let blanks = 0;
  let proxies = 0;
  let dissolves = 0;
  let bridges = 0;
  let warped = 0;
  let offTarget = 0;
  const covered = new Set<number>();
  let lastMove = Number.NEGATIVE_INFINITY;
  let shown: number | null = entries[0]?.near ?? null;
  if (shown !== null) covered.add(shown);
  for (let index = 1; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const previous = entries[index - 1]!;
    deltas.push(entry.at - previous.at);
    const before: number | null = shown;
    shown = shownIndex(entry, shown);
    if (entry.mode !== "same" && entry.mode !== "none") {
      paints += 1;
      if (entry.mode === "proxy" || entry.proxy) proxies += 1;
      if (isDissolve(entry)) {
        dissolves += 1;
        if (entry.next != null && entry.near !== null && entry.next - entry.near > 1) bridges += 1;
      }
      if (entry.warped) warped += 1;
    }
    if (
      entry.mode === "exact" ||
      entry.mode === "nearest" ||
      entry.mode === "proxy" ||
      (entry.mode === "same" && entry.next == null)
    ) {
      if (entry.near !== null) covered.add(entry.near);
    } else if (entry.mode === "blend") {
      if (entry.near !== null && (entry.alpha ?? 0) < 0.999) covered.add(entry.near);
      if (entry.next != null && (entry.alpha ?? 0) > 0.001) covered.add(entry.next);
    }
    if (Math.abs(entry.target - previous.target) > 1e-3) lastMove = entry.at;
    if (entry.at - lastMove >= 120) {
      frozenStart = -1;
      continue;
    }
    active += 1;
    if (entry.mode === "none") blanks += 1;
    if (shown !== null) {
      lag.push(Math.abs(shown - entry.current));
      if (Math.abs(shown - entry.current) > 1) offTarget += 1;
    }
    const wanted = Math.round(entry.current);
    const unchanged =
      entry.mode === "none" ||
      entry.mode === "same" ||
      (entry.mode === previous.mode &&
        entry.near === previous.near &&
        entry.next === previous.next &&
        Math.abs((entry.alpha ?? 0) - (previous.alpha ?? 0)) < 0.01);
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
  const positions = entries.map((entry) => entry.current);
  const from = Math.ceil(Math.min(...positions));
  const to = Math.floor(Math.max(...positions));
  const skipped: number[] = [];
  for (let index = from; index <= to; index += 1) if (!covered.has(index)) skipped.push(index);
  return {
    rafFrames: entries.length,
    activeFrames: active,
    paints,
    proxyPaints: proxies,
    dissolvePaints: dissolves,
    bridgePaints: bridges,
    warpedPaints: warped,
    moreThanOneFrameOff: offTarget,
    lagFrames: {
      p50: Math.round(quantile(lag, 0.5) * 100) / 100,
      p95: Math.round(quantile(lag, 0.95) * 100) / 100,
      max: Math.round(Math.max(0, ...lag) * 100) / 100,
    },
    maxFrameMs: Math.round(Math.max(0, ...deltas) * 10) / 10,
    p95FrameMs: Math.round(quantile(deltas, 0.95) * 10) / 10,
    p50FrameMs: Math.round(quantile(deltas, 0.5) * 10) / 10,
    framesOver34ms: deltas.filter((delta) => delta > 34).length,
    missedAdvances,
    frozenFrames: frozen,
    longestFrozenMs: Math.round(longestFrozenMs),
    blankDraws: blanks,
    indexRange: [from, to],
    skippedIndices: slow ? skipped.length : null,
    skippedSample: slow ? skipped.slice(0, 20) : null,
  };
}

async function sharpness(page: Page) {
  return page.evaluate(async () => {
    const film = (window as FilmWindow).__heroFilm;
    const canvas = document.querySelector<HTMLCanvasElement>("[data-hero-canvas] canvas");
    if (!canvas || !film) return null;
    const recorded = film.trace(true) ?? [];
    const paint = [...recorded].reverse().find((entry) => entry.mode !== "same") ?? null;
    const png = canvas.toDataURL("image/png");
    const laplacian = (source: CanvasImageSource, width: number, height: number) => {
      const probe = document.createElement("canvas");
      probe.width = width;
      probe.height = height;
      const context = probe.getContext("2d", { willReadFrequently: true });
      if (!context) return 0;
      context.drawImage(source, 0, 0, width, height);
      const x0 = Math.round(width * 0.1);
      const y0 = Math.round(height * 0.15);
      const w = Math.round(width * 0.8);
      const h = Math.round(height * 0.7);
      const data = context.getImageData(x0, y0, w, h).data;
      const gray = new Float32Array(w * h);
      for (let i = 0; i < w * h; i += 1) {
        gray[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
      }
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let y = 1; y < h - 1; y += 1) {
        for (let x = 1; x < w - 1; x += 1) {
          const i = y * w + x;
          const value = 4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - w]! - gray[i + w]!;
          sum += value;
          sumSq += value * value;
          n += 1;
        }
      }
      const mean = sum / n;
      return sumSq / n - mean * mean;
    };
    const canvasSharpness = laplacian(canvas, canvas.width, canvas.height);
    const drawnFrame = film.position().frame;
    const frame =
      drawnFrame !== undefined
        ? drawnFrame
        : paint
          ? paint.mode === "blend"
            ? (paint.alpha ?? 0) < 0.5
              ? paint.near
              : (paint.next ?? null)
            : paint.near
          : null;
    let stored: number | null = null;
    const pattern = (window as FilmWindow).__heroFrames;
    if (frame !== null && pattern) {
      const url = pattern.replace("{frame}", String(frame + 1).padStart(4, "0"));
      const bitmap = await createImageBitmap(await (await fetch(url)).blob());
      const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
      const width = bitmap.width * scale;
      const height = bitmap.height * scale;
      const cover = document.createElement("canvas");
      cover.width = canvas.width;
      cover.height = canvas.height;
      const context = cover.getContext("2d");
      if (context) {
        context.imageSmoothingQuality = "high";
        context.drawImage(
          bitmap,
          Math.round((canvas.width - width) / 2),
          Math.round((canvas.height - height) / 2),
          width,
          height,
        );
        stored = laplacian(cover, cover.width, cover.height);
      }
      bitmap.close();
    }
    return {
      sharpness: Math.round(canvasSharpness),
      stored: stored === null ? null : Math.round(stored),
      frame,
      paint,
      png,
    };
  });
}

async function savePng(file: string, dataUrl: string) {
  await writeFile(file, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
}

async function scrollForFrame(page: Page, frame: number, top: number, range: number) {
  let low = top;
  let high = top + range;
  for (let i = 0; i < 16 && high - low > 1; i += 1) {
    const middle = Math.round((low + high) / 2);
    await page.evaluate((y) => scrollTo(0, y), middle);
    await page.waitForTimeout(700);
    if ((await filmPosition(page)) < frame - 0.01) low = middle;
    else high = middle;
  }
  let y = high;
  for (let i = 0; i < 24; i += 1) {
    await page.evaluate((to) => scrollTo(0, to), y);
    await page.waitForTimeout(700);
    const shown = Math.round(await filmPosition(page));
    if (shown === frame) break;
    y += shown < frame ? 2 : -2;
  }
  return y;
}

async function captureShots(
  page: Page,
  deviceName: DeviceName,
  networkName: NetworkName,
  top: number,
  range: number,
) {
  if (!shotsDir) return null;
  await mkdir(shotsDir, { recursive: true });
  const width = devicesUnderTest[deviceName].viewport.width;
  const results: Record<string, unknown>[] = [];
  for (const [index, frame] of shotFrames.entries()) {
    const label = String.fromCharCode(97 + index);
    const prefix = path.join(shotsDir, `${width}-${networkName}`);
    const frameY = await scrollForFrame(page, frame, top, range);
    await page.evaluate((y) => scrollTo(0, y), Math.max(top, frameY - range * (20 / 334)));
    await settle(page);
    await page.evaluate(() => (window as FilmWindow).__heroFilm?.trace(true));
    let moving: Awaited<ReturnType<typeof sharpness>> = null;
    for (let guard = 0; guard < 400; guard += 1) {
      await page.mouse.wheel(0, 90);
      await page.waitForTimeout(16);
      if ((await filmPosition(page)) >= frame - 0.5) {
        moving = await sharpness(page);
        await page.screenshot({ path: `${prefix}-moving-${label}.png` });
        break;
      }
    }
    await settle(page);
    if (!moving || moving.frame === null) {
      results.push({ label, requestedFrame: frame, error: "no mid-scroll capture" });
      continue;
    }
    await scrollForFrame(page, moving.frame, top, range);
    await settle(page);
    const still = await sharpness(page);
    await page.screenshot({ path: `${prefix}-settled-${label}.png` });
    await savePng(`${prefix}-moving-${label}-canvas.png`, moving.png);
    if (still) await savePng(`${prefix}-settled-${label}-canvas.png`, still.png);
    results.push({
      label,
      requestedFrame: frame,
      moving: {
        frame: moving.frame,
        sharpness: moving.sharpness,
        stored: moving.stored,
        paint: moving.paint,
      },
      settled: still
        ? {
            frame: still.frame,
            sharpness: still.sharpness,
            stored: still.stored,
            paint: still.paint,
          }
        : null,
      movingOverSettled:
        still && still.sharpness
          ? Math.round((moving.sharpness / still.sharpness) * 1000) / 1000
          : null,
    });
  }
  await page.evaluate(() => (window as FilmWindow).__heroFilm?.trace(false));
  return results;
}

async function measureCase(browser: Browser, deviceName: DeviceName, networkName: NetworkName) {
  const context = await browser.newContext({ ...devicesUnderTest[deviceName] });
  const page = await context.newPage();
  await page.addInitScript(`window.__name = (value) => value;
    window.__loaf = [];
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(message, transfer) {
        if (message && message.type === "init" && Array.isArray(message.frames)) {
          window.__heroFrames = message.frames[0].replace("0001", "{frame}");
        }
        return super.postMessage(message, transfer);
      }
    };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__loaf.push({ duration: entry.duration });
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
  await page.waitForFunction(() => Boolean((window as FilmWindow).__heroFilm), null, {
    timeout: 60_000,
  });
  await page.waitForTimeout(3000);
  const { top, range } = await filmRange(page);
  await page.mouse.move(devicesUnderTest[deviceName].viewport.width / 2, 400);

  const tier = await page.evaluate(() => (window as FilmWindow).__heroFilm?.tier);
  const slowStep = Math.max(8, Math.round((range / 334) * 2));
  const passes: Pass[] = [
    {
      name: "slow down (wheel, ~10 frames/s)",
      slow: true,
      run: (p) => wheelTo(p, top + range, slowStep, 200),
    },
    {
      name: "slow up (wheel, ~10 frames/s)",
      slow: true,
      run: (p) => wheelTo(p, top, slowStep, 200),
    },
    { name: "fast down (wheel)", slow: false, run: (p) => wheelTo(p, top + range, 400, 40) },
    { name: "fast up (wheel)", slow: false, run: (p) => wheelTo(p, top, 400, 40) },
  ];
  const results: Record<string, unknown> = {};
  for (const pass of passes) {
    await settle(page);
    await page.evaluate(() => {
      (window as FilmWindow).__heroFilm?.trace(true);
      (window as FilmWindow).__loaf = [];
    });
    const passStart = Date.now();
    await pass.run(page);
    await settle(page);
    const entries = (await page.evaluate(() =>
      (window as FilmWindow).__heroFilm?.trace(false),
    )) as Entry[];
    const loaf = await page.evaluate(() => {
      const list = (window as FilmWindow).__loaf ?? [];
      (window as FilmWindow).__loaf = [];
      return { count: list.length, maxMs: Math.round(Math.max(0, ...list.map((e) => e.duration))) };
    });
    results[pass.name] = {
      longAnimationFrames: loaf,
      seconds: Math.round((Date.now() - passStart) / 100) / 10,
      ...analyse(entries, pass.slow),
    };
  }
  const shots = await captureShots(page, deviceName, networkName, top, range);
  const loaded = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>("[data-hero-film]");
    const film = (window as FilmWindow).__heroFilm;
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
      window: film?.frames(),
    };
  });
  return {
    device: deviceName,
    network: networkName,
    cpu: "4x",
    tier,
    loaded,
    totalSeconds: Math.round((Date.now() - started) / 1000),
    passes: results,
    shots,
  };
}

async function runCase(deviceName: DeviceName, networkName: NetworkName) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=d3d11",
      "--enable-gpu",
      "--ignore-gpu-blocklist",
      "--enable-gpu-rasterization",
    ],
  });
  const watchdog = setTimeout(() => void browser.close(), caseTimeoutMs);
  try {
    return await measureCase(browser, deviceName, networkName);
  } finally {
    clearTimeout(watchdog);
    await browser.close().catch(() => undefined);
  }
}

const report = [];
for (const device of ["desktop", "mobile"] as const) {
  for (const network of ["slow4g", "fast4g"] as const) {
    const name = `${device}-${network}`;
    if (only && !only.split(",").some((part) => name.includes(part))) continue;
    const result = await runCase(device, network);
    console.log(JSON.stringify({ ...result, shots: result.shots }, null, 2));
    report.push(result);
  }
}
if (output) await writeFile(output, JSON.stringify(report, null, 2));
