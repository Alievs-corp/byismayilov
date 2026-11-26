"use client";

import { useEffect } from "react";

import { filmSettle } from "@/lib/motion/film-steps";
import { downloadedPlan, filmWindow, nearestFrame } from "@/lib/motion/film-window";
import {
  clamp,
  documentTop,
  measure,
  readScroll,
  reducedMotion,
  subscribe,
  whenNear,
} from "@/lib/motion/loop";
import { smoothScroller } from "@/lib/motion/smooth-scroll";
import type { HeroFilmTierFrames } from "@/lib/public/home";

export type HeroChapter = {
  key: string;
  label: string;
  text: string;
  from: number;
  to: number;
  placement: "top" | "bottom";
};

type Size = { width: number; height: number };

type Frame = { bitmap: ImageBitmap; generation: number };

type FrameMessage =
  | {
      type: "frame";
      index: number;
      generation: number;
      decodeMs: number;
      bitmap: ImageBitmap;
    }
  | { type: "progress"; index: number; loaded: number; bytes: number; total: number }
  | { type: "unsupported" };

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

type Paint = { mode: "none" | "same" | "exact" | "nearest"; near: number | null };

type TraceEntry = Paint & { at: number; target: number; current: number; scroll: number };

const memoryBudget = { wide: 192e6, desktop: 192e6, mobile: 96e6, lowMemory: 64e6 };
const minFrames = 12;
const maxFrames = 48;

const headlineFade = 0.18;
const ctaFade = 0.12;
const underPanel = 0.35;
const maxPixelRatio = 2;
const wideThreshold = 1.08;
const nativeDecode = 0.5;
const settled = 0.002;
const velocityTau = 120;

function constrained() {
  const nav = navigator as Navigator & { connection?: NetworkInformation; deviceMemory?: number };
  const connection = nav.connection;
  if (connection?.saveData) return true;
  if (connection?.effectiveType && ["slow-2g", "2g", "3g"].includes(connection.effectiveType)) {
    return true;
  }
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return true;
  return typeof Worker === "undefined" || typeof createImageBitmap === "undefined";
}

function frameUrls(tier: HeroFilmTierFrames) {
  return Array.from({ length: tier.count }, (_, index) =>
    tier.frames.replace("{frame}", String(index + 1).padStart(4, "0")),
  );
}

function afterLoad(start: () => void) {
  let idle = 0;
  let timer = 0;
  const run = () => {
    if (typeof window.requestIdleCallback === "function") {
      idle = window.requestIdleCallback(start, { timeout: 2000 });
    } else {
      timer = window.setTimeout(start, 200);
    }
  };
  if (document.readyState === "complete") run();
  else addEventListener("load", run, { once: true });
  return () => {
    removeEventListener("load", run);
    if (idle) window.cancelIdleCallback(idle);
    window.clearTimeout(timer);
  };
}

async function loadPace(url: string, count: number): Promise<number[] | null> {
  const response = await fetch(url, { priority: "low" } as RequestInit);
  if (!response.ok) return null;
  const data = (await response.json()) as { pace?: unknown };
  const pace = data.pace;
  const valid =
    Array.isArray(pace) &&
    pace.length === count &&
    pace.every(
      (value, index, list) =>
        typeof value === "number" && (index === 0 || value >= (list[index - 1] as number)),
    );
  return valid ? (pace as number[]) : null;
}

function sameSize(first: Size | null, second: Size | null) {
  if (!first || !second) return first === second;
  return first.width === second.width && first.height === second.height;
}

function runFilm(
  section: HTMLElement,
  tiers: {
    desktop: HeroFilmTierFrames;
    mobile: HeroFilmTierFrames | null;
    wide: HeroFilmTierFrames | null;
  },
  motionUrl: string | null,
) {
  const stage = section.querySelector<HTMLElement>(".hero-stage");
  const spacer = section.querySelector<HTMLElement>(".hero-spacer");
  const slot = section.querySelector<HTMLElement>("[data-hero-canvas]");
  const poster = section.querySelector<HTMLElement>("[data-hero-poster]");
  const groupA = section.querySelector<HTMLElement>("[data-hero-a]");
  const groupB = section.querySelector<HTMLElement>("[data-hero-b]");
  const cta = section.querySelector<HTMLElement>("[data-hero-cta]");
  const scrimTop = section.querySelector<HTMLElement>(".hero-scrim-top");
  const scrimBottom = section.querySelector<HTMLElement>(".hero-scrim-bottom");
  const chapters = [...section.querySelectorAll<HTMLElement>("[data-chapter]")].map((element) => ({
    element,
    from: Number(element.dataset.from),
    to: Number(element.dataset.to),
    top: element.classList.contains("is-top"),
    active: null as boolean | null,
  }));
  if (!stage || !spacer || !slot) return () => undefined;

  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowMemory = nav.deviceMemory !== undefined && nav.deviceMemory <= 4;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
  const coverWidth = (frames: HeroFilmTierFrames) =>
    Math.max(slot.clientWidth, (slot.clientHeight * frames.width) / frames.height);
  const tier = (() => {
    if (window.innerWidth < 1024 || lowMemory) return tiers.mobile ?? tiers.desktop;
    const wide = tiers.wide;
    if (wide && coverWidth(tiers.desktop) * pixelRatio > tiers.desktop.width * wideThreshold) {
      return wide;
    }
    return tiers.desktop;
  })();
  const tierName = tier === tiers.wide ? "wide" : tier === tiers.mobile ? "mobile" : "desktop";
  const budgetBytes = lowMemory ? memoryBudget.lowMemory : memoryBudget[tierName];
  const count = tier.count;

  const box = { top: 0, height: 0, filmEnd: 1, shift: 0 };
  let canvas: HTMLCanvasElement | null = null;
  let context: CanvasRenderingContext2D | null = null;
  let canvasSize: Size = { width: 0, height: 0 };
  let decodeSize: Size | null = null;
  let capacity = minFrames;
  let generation = 0;
  const frames = new Map<number, Frame>();
  let worker: Worker | null = null;
  let pace: number[] | null = null;
  let current = 0;
  let drawnAt = Number.NaN;
  let drawnFrame: number | null = null;
  let dirty = true;
  let direction = 1;
  let velocity = 0;
  let lastLinear = Number.NaN;
  let planKey = "";
  let plan: number[] = [];
  let stride = 1;
  let received = 0;
  const downloaded = new Uint8Array(count);
  let downloadedVersion = 0;
  let planSpan = { from: 0, to: 0 };
  let posterHidden = false;
  let pinActive = false;
  const written = { a: Number.NaN, cta: Number.NaN, top: Number.NaN, bottom: Number.NaN };
  const stats = { drawMs: [] as number[], decodeMs: [] as number[] };
  const settle = filmSettle({ count });
  let trace: TraceEntry[] | null = null;
  let painted: Paint = { mode: "none", near: null };

  const tau = smoothScroller() ? 60 : 100;

  function measureBox() {
    box.top = documentTop(section);
    box.height = section.offsetHeight;
    const viewport = window.innerHeight;
    const range = Math.max(box.height - viewport, 1);
    const spacerHeight = spacer?.offsetHeight ?? 0;
    box.filmEnd = clamp((spacerHeight + underPanel * viewport) / range, 0.05, 1);
    box.shift = window.innerWidth * 0.08;
  }

  function sizes() {
    const ratio = Math.min(pixelRatio, tier.width / coverWidth(tier));
    const width = Math.round(slot!.clientWidth * ratio);
    const height = Math.round(slot!.clientHeight * ratio);
    const scale = Math.min(Math.max(width / tier.width, height / tier.height), 1);
    const decode =
      scale >= nativeDecode
        ? null
        : {
            width: Math.max(width, Math.round(tier.width * scale)),
            height: Math.max(height, Math.round(tier.height * scale)),
          };
    const bitmap = decode ?? { width: tier.width, height: tier.height };
    const frames = Math.floor(budgetBytes / (bitmap.width * bitmap.height * 4));
    return {
      canvas: { width, height },
      decode,
      capacity: clamp(frames, minFrames, maxFrames),
    };
  }

  function frameAt(film: number) {
    const linear = film * (count - 1);
    if (!pace) return linear;
    let low = 0;
    let high = pace.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if ((pace[middle] as number) <= linear) low = middle;
      else high = middle;
    }
    const from = pace[low] as number;
    const to = pace[high] as number;
    return low + (to > from ? clamp((linear - from) / (to - from)) : 0);
  }

  function evict() {
    if (frames.size <= capacity) return;
    const keep = new Set(plan);
    const cost = (index: number) => {
      const offset = (index - current) * direction;
      return offset < 0 ? -offset * 3 : offset;
    };
    const spare = [...frames.keys()]
      .filter((index) => !keep.has(index) && index !== drawnFrame)
      .sort((a, b) => cost(b) - cost(a));
    for (const index of spare) {
      if (frames.size <= capacity) break;
      frames.get(index)?.bitmap.close();
      frames.delete(index);
    }
  }

  function request(force: boolean) {
    if (!worker) return;
    const next = filmWindow({ position: current, velocity, direction, count, capacity });
    const key = `${next.order[0]}:${next.stride}:${direction}:${generation}:${downloadedVersion}`;
    if (!force && key === planKey) return;
    planKey = key;
    planSpan = { from: Math.min(...next.order) - 8, to: Math.max(...next.order) + 8 };
    plan = downloadedPlan(next.order, (index) => downloaded[index] === 1, current);
    stride = next.stride;
    evict();
    const missing = plan.filter((index) => frames.get(index)?.generation !== generation);
    worker.postMessage({
      type: "want",
      frames: missing,
      position: next.order[0] ?? Math.round(current),
      direction,
      velocity,
      span: next.order.length * stride,
      received,
    });
  }

  function draw(bitmap: ImageBitmap) {
    if (!context) return;
    let scale = Math.max(canvasSize.width / bitmap.width, canvasSize.height / bitmap.height);
    if (Math.abs(scale - 1) < 0.01) scale = 1;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    context.drawImage(
      bitmap,
      Math.round((canvasSize.width - width) / 2),
      Math.round((canvasSize.height - height) / 2),
      width,
      height,
    );
  }

  function render(position: number) {
    if (!context || !canvas) return;
    const index = nearestFrame(frames.keys(), position, drawnFrame);
    if (index === null) {
      painted = { mode: "none", near: null };
      return;
    }
    const mode = index === Math.round(position) ? "exact" : "nearest";
    if (!dirty && index === drawnFrame) {
      painted = { mode: "same", near: index };
      drawnAt = position;
      return;
    }
    const frame = frames.get(index);
    if (!frame) return;
    const started = performance.now();
    draw(frame.bitmap);
    stats.drawMs.push(performance.now() - started);
    if (stats.drawMs.length > 2000) stats.drawMs.splice(0, 1000);
    painted = { mode, near: index };
    drawnFrame = index;
    drawnAt = position;
    dirty = false;
    if (!posterHidden) {
      posterHidden = true;
      poster?.setAttribute("data-hidden", "");
    }
  }

  function writeOpacity(element: HTMLElement | null, key: "top" | "bottom", value: number) {
    if (!element || value === written[key]) return;
    written[key] = value;
    element.style.opacity = String(value);
  }

  function choreograph(film: number) {
    const fade = Math.round(clamp(film / headlineFade) * 1000) / 1000;
    if (fade !== written.a) {
      written.a = fade;
      if (groupA) {
        groupA.style.transform = `translate3d(${-box.shift * fade}px, 0, 0)`;
        groupA.style.opacity = String(1 - fade);
      }
      if (groupB) {
        groupB.style.transform = `translate3d(${box.shift * fade}px, 0, 0)`;
        groupB.style.opacity = String(1 - fade);
      }
    }
    const ctaOpacity = Math.round((1 - clamp(film / ctaFade)) * 1000) / 1000;
    if (ctaOpacity !== written.cta && cta) {
      written.cta = ctaOpacity;
      cta.style.opacity = String(ctaOpacity);
      cta.style.visibility = ctaOpacity < 0.02 ? "hidden" : "";
    }
    let topText = false;
    let bottomText = false;
    for (const chapter of chapters) {
      const active = film >= chapter.from && film < chapter.to;
      if (active) {
        if (chapter.top) topText = true;
        else bottomText = true;
      }
      if (active === chapter.active) continue;
      chapter.active = active;
      chapter.element.toggleAttribute("data-active", active);
    }
    writeOpacity(scrimTop, "top", topText ? 1 : 1 - fade);
    writeOpacity(scrimBottom, "bottom", bottomText ? 1 : 1 - fade);
  }

  function track(linear: number, dt: number) {
    if (Number.isNaN(lastLinear)) lastLinear = linear;
    const moved = linear - lastLinear;
    lastLinear = linear;
    const instant = dt > 0 ? (moved / dt) * 1000 : 0;
    velocity += (instant - velocity) * (1 - Math.exp(-dt / velocityTau));
    if (Math.abs(velocity) < 0.5) velocity = 0;
    if (Math.abs(moved) > 1e-4) direction = moved > 0 ? 1 : -1;
  }

  function tick(_time: number, dt: number) {
    const { y, viewportHeight } = readScroll();
    const progress = clamp((y - box.top) / Math.max(box.height - viewportHeight, 1));
    const film = clamp(progress / box.filmEnd);
    const pinned = progress > 0 && progress < 1;
    if (pinned !== pinActive) {
      pinActive = pinned;
      document.documentElement.toggleAttribute("data-pin-active", pinned);
    }
    choreograph(film);
    const linear = frameAt(film);
    track(linear, dt);
    const target = settle.goal(linear, performance.now());
    current += (target - current) * (1 - Math.exp(-dt / tau));
    if (Math.abs(target - current) < settled) current = target;
    request(false);
    render(current);
    trace?.push({ ...painted, at: performance.now(), target: linear, current, scroll: y });
  }

  function prepareContext() {
    if (!context) return;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
  }

  function createCanvas() {
    const next = sizes();
    canvasSize = next.canvas;
    decodeSize = next.decode;
    capacity = next.capacity;
    canvas = document.createElement("canvas");
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    canvas.setAttribute("aria-hidden", "true");
    context = canvas.getContext("2d", { alpha: false });
    prepareContext();
    slot!.append(canvas);
  }

  function startWorker() {
    createCanvas();
    if (motionUrl) {
      void loadPace(motionUrl, count)
        .then((loaded) => {
          if (!loaded) return;
          pace = loaded;
          dirty = true;
        })
        .catch(() => undefined);
    }
    worker = new Worker(new URL("./hero-film.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<FrameMessage>) => {
      const message = event.data;
      if (message.type === "progress") {
        downloaded[message.index] = 1;
        if (message.index >= planSpan.from && message.index <= planSpan.to) downloadedVersion += 1;
        section.dataset.filmLoaded = String(message.loaded);
        section.dataset.filmBytes = String(message.bytes);
        section.dataset.filmTotal = String(message.total);
        return;
      }
      if (message.type === "unsupported") {
        stop();
        section.setAttribute("data-hero-static", "");
        return;
      }
      received += 1;
      if (message.generation !== generation) {
        message.bitmap.close();
        return;
      }
      stats.decodeMs.push(message.decodeMs);
      if (stats.decodeMs.length > 2000) stats.decodeMs.splice(0, 1000);
      frames.get(message.index)?.bitmap.close();
      frames.set(message.index, { bitmap: message.bitmap, generation });
      evict();
      if (!frames.has(message.index)) return;
      const shown = drawnFrame === null ? Number.POSITIVE_INFINITY : Math.abs(drawnFrame - current);
      if (message.index === drawnFrame || Math.abs(message.index - current) < shown) {
        dirty = true;
        render(current);
      }
    };
    worker.postMessage({ type: "init", frames: frameUrls(tier), decode: decodeSize });
    request(true);
  }

  let resizeTimer = 0;
  function onResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!canvas || !worker) return;
      const next = sizes();
      if (next.canvas.width === canvasSize.width && next.canvas.height === canvasSize.height)
        return;
      canvasSize = next.canvas;
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
      prepareContext();
      dirty = true;
      if (!sameSize(next.decode, decodeSize)) {
        decodeSize = next.decode;
        capacity = next.capacity;
        generation += 1;
        worker.postMessage({ type: "resize", decode: decodeSize, generation });
        request(true);
      }
      render(current);
    }, 200);
  }

  const onVisibility = () => worker?.postMessage({ type: "visibility", hidden: document.hidden });

  const stopMeasure = measure(section, measureBox);
  measureBox();
  let stopTick: (() => void) | null = null;
  const stopNear = whenNear(section, (near) => {
    stopTick?.();
    stopTick = near ? subscribe(tick) : null;
  });
  let stopLoad: (() => void) | null = null;
  const stopVisible = whenNear(stage, (near) => {
    if (!near || worker || stopLoad) return;
    stopLoad = afterLoad(startWorker);
  });
  addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  (window as Window & { __heroFilm?: unknown }).__heroFilm = {
    stats,
    tier: tierName,
    position: () => ({ current, drawn: drawnAt, frame: drawnFrame, resting: settle.resting }),
    trace: (on: boolean) => {
      const recorded = trace;
      trace = on ? [] : null;
      return recorded;
    },
    frames: () => {
      let bytes = 0;
      for (const frame of frames.values()) bytes += frame.bitmap.width * frame.bitmap.height * 4;
      return {
        window: frames.size,
        capacity,
        stride,
        velocity: Math.round(velocity),
        megabytes: Math.round(bytes / 1e5) / 10,
        budgetMegabytes: budgetBytes / 1e6,
        decode: decodeSize,
        canvas: canvasSize,
        pace: Boolean(pace),
      };
    },
  };

  function stop() {
    stopMeasure();
    stopNear();
    stopVisible();
    stopLoad?.();
    stopTick?.();
    removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    worker?.terminate();
    worker = null;
    for (const frame of frames.values()) frame.bitmap.close();
    frames.clear();
    canvas?.remove();
    poster?.removeAttribute("data-hidden");
    scrimTop?.style.removeProperty("opacity");
    scrimBottom?.style.removeProperty("opacity");
    for (const chapter of chapters) chapter.element.removeAttribute("data-active");
    for (const group of [groupA, groupB]) {
      group?.style.removeProperty("transform");
      group?.style.removeProperty("opacity");
    }
    cta?.style.removeProperty("opacity");
    cta?.style.removeProperty("visibility");
    document.documentElement.removeAttribute("data-pin-active");
  }

  return stop;
}

export function HeroFilmPlayer({
  desktop,
  mobile,
  wide,
  motion,
}: {
  desktop: HeroFilmTierFrames;
  mobile: HeroFilmTierFrames | null;
  wide: HeroFilmTierFrames | null;
  motion: string | null;
}) {
  useEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-hero-film]");
    if (!section || reducedMotion()) return;
    if (constrained() || window.innerHeight < 500) {
      section.setAttribute("data-hero-static", "");
      return () => section.removeAttribute("data-hero-static");
    }
    return runFilm(section, { desktop, mobile, wide }, motion);
  }, [desktop, mobile, wide, motion]);

  return null;
}
