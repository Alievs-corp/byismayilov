type Size = { width: number; height: number };

type InitMessage = {
  type: "init";
  frames: string[];
  decode: Size | null;
  key: { step: number; size: Size };
  ahead: number;
  behind: number;
};

type InMessage =
  | InitMessage
  | { type: "seek"; position: number; direction: number }
  | { type: "resize"; decode: Size | null; generation: number }
  | { type: "visibility"; hidden: boolean };

type Scope = {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<InMessage>) => void) | null;
};

const scope = globalThis as unknown as Scope;

const passes = [8, 4, 2, 1];
const leadStrides = [4, 2, 1];
const maxFetches = 4;
const maxDecodes = 3;
const leadFactor = 3;

let config: InitMessage | null = null;
let blobs: (Blob | null)[] = [];
const fetching = new Set<number>();
const decoding = new Set<string>();
const sent = new Set<number>();
const keysSent = new Set<number>();
let position = 0;
let direction = 1;
let generation = 0;
let paused = false;
let bytes = 0;
let loaded = 0;
let failed = false;
let decodedAny = false;
let failures = 0;

function reach() {
  const ahead = config?.ahead ?? 0;
  const behind = config?.behind ?? 0;
  return direction >= 0
    ? { before: behind, after: ahead + 1 }
    : { before: ahead, after: behind + 1 };
}

function inWindow(index: number) {
  const { before, after } = reach();
  const base = Math.floor(position);
  return index >= base - before && index <= base + after;
}

function windowOrder(span: number): number[] {
  if (!config) return [];
  const count = config.frames.length;
  const base = Math.floor(position);
  const { before, after } = reach();
  const forward = direction >= 0 ? after * span : before * span;
  const backward = direction >= 0 ? before * span : after * span;
  const order: number[] = [];
  for (let step = 0; step <= Math.max(forward, backward); step += 1) {
    const ahead = direction >= 0 ? base + step : base + 1 - step;
    const behind = direction >= 0 ? base - step : base + 1 + step;
    if (step <= forward && ahead >= 0 && ahead < count) order.push(ahead);
    if (step > 0 && step <= backward && behind >= 0 && behind < count) order.push(behind);
  }
  return order;
}

function nextToFetch(): number | null {
  if (!config) return null;
  const lead = windowOrder(leadFactor);
  for (const stride of leadStrides) {
    for (const index of lead) {
      if (index % stride === 0 && !blobs[index] && !fetching.has(index)) return index;
    }
  }
  const count = config.frames.length;
  for (const step of passes) {
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < count; index += step) {
      if (blobs[index] || fetching.has(index)) continue;
      const distance = Math.abs(index - position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    if (best !== null) return best;
  }
  return null;
}

function pump() {
  if (!config || paused || failed) return;
  while (fetching.size < maxFetches) {
    const index = nextToFetch();
    if (index === null) break;
    fetching.add(index);
    void fetch(config.frames[index] ?? "", { priority: "low" } as RequestInit)
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        fetching.delete(index);
        if (!blob) return;
        blobs[index] = blob;
        bytes += blob.size;
        loaded += 1;
        scope.postMessage({ type: "progress", loaded, bytes, total: blobs.length });
        schedule();
      })
      .catch(() => {
        fetching.delete(index);
      })
      .finally(pump);
  }
  schedule();
}

function wanted(): number | null {
  for (const index of windowOrder(1)) {
    if (!inWindow(index)) continue;
    if (blobs[index] && !sent.has(index) && !decoding.has(`f${index}`)) return index;
  }
  return null;
}

function wantedKey(): number | null {
  if (!config) return null;
  const step = config.key.step;
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < blobs.length; index += step) {
    if (!blobs[index] || keysSent.has(index)) continue;
    const distance = Math.abs(index - position);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

function upload(bitmap: ImageBitmap): ImageBitmap {
  if (typeof OffscreenCanvas === "undefined") return bitmap;
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return bitmap;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.transferToImageBitmap();
}

function decodeOptions(size: Size | null): ImageBitmapOptions | undefined {
  return size
    ? { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: "medium" }
    : undefined;
}

function schedule() {
  if (!config || paused || failed) return;
  while (decoding.size < maxDecodes) {
    let index = wanted();
    let key = false;
    if (index === null) {
      index = wantedKey();
      key = true;
    }
    if (index === null) return;
    const blob = blobs[index];
    if (!blob) return;
    const job = `${key ? "k" : "f"}${index}`;
    decoding.add(job);
    if (key) keysSent.add(index);
    else sent.add(index);
    const started = performance.now();
    const jobGeneration = generation;
    const frameIndex = index;
    void createImageBitmap(blob, decodeOptions(key ? config.key.size : config.decode))
      .then(upload)
      .then((bitmap) => {
        decoding.delete(job);
        decodedAny = true;
        if (!key && jobGeneration !== generation) {
          bitmap.close();
          return;
        }
        scope.postMessage(
          {
            type: key ? "key" : "frame",
            index: frameIndex,
            generation: jobGeneration,
            decodeMs: performance.now() - started,
            bitmap,
          },
          [bitmap],
        );
      })
      .catch(() => {
        decoding.delete(job);
        if (key) keysSent.delete(frameIndex);
        else sent.delete(frameIndex);
        failures += 1;
        if (!decodedAny && failures >= 2) {
          failed = true;
          scope.postMessage({ type: "unsupported" });
        }
      })
      .finally(schedule);
  }
}

scope.onmessage = (event) => {
  const message = event.data;
  switch (message.type) {
    case "init":
      config = message;
      blobs = message.frames.map(() => null);
      pump();
      break;
    case "seek":
      position = message.position;
      direction = message.direction;
      for (const index of [...sent]) if (!inWindow(index)) sent.delete(index);
      pump();
      break;
    case "resize":
      if (!config) return;
      config = { ...config, decode: message.decode };
      generation = message.generation;
      sent.clear();
      schedule();
      break;
    case "visibility":
      paused = message.hidden;
      if (!paused) pump();
      break;
  }
};
