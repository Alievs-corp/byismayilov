type Size = { width: number; height: number };

type InitMessage = { type: "init"; frames: string[]; decode: Size | null };

type InMessage =
  | InitMessage
  | {
      type: "want";
      frames: number[];
      position: number;
      direction: number;
      velocity: number;
      span: number;
      received: number;
    }
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
const maxDecodes = 4;
const denseLead = 6;
const denseFetchMs = 300;
const leadFactor = 3;

let config: InitMessage | null = null;
let blobs: (Blob | null)[] = [];
const fetching = new Set<number>();
const decoding = new Set<number>();
const inTransit = new Map<number, number>();
let posted = 0;
let wanted: number[] = [];
let position = 0;
let direction = 1;
let span = 0;
let velocity = 0;
let fetchMs = 400;
let generation = 0;
let paused = false;
let bytes = 0;
let loaded = 0;
let failed = false;
let decodedAny = false;
let failures = 0;

function leadOrder(): number[] {
  if (!config) return [];
  const count = config.frames.length;
  const reach = Math.max(span, 8) * leadFactor;
  const start = Math.min(Math.round((Math.abs(velocity) * fetchMs) / 1000), reach);
  const order: number[] = [];
  for (let step = start; step <= start + reach; step += 1) {
    const ahead = position + direction * step;
    if (ahead >= 0 && ahead < count) order.push(ahead);
  }
  for (let step = 0; step < start; step += 1) {
    const passing = position + direction * step;
    if (passing >= 0 && passing < count) order.push(passing);
  }
  for (let step = 1; step <= reach / 4; step += 1) {
    const behind = position - direction * step;
    if (behind >= 0 && behind < count) order.push(behind);
  }
  return order;
}

function needsFetch(index: number) {
  return !blobs[index] && !fetching.has(index);
}

function nextToFetch(): number | null {
  if (!config) return null;
  const lead = leadOrder();
  const dense = fetchMs < denseFetchMs ? denseLead : 0;
  for (const index of lead.slice(0, dense)) if (needsFetch(index)) return index;
  for (const stride of leadStrides) {
    for (const index of lead) if (index % stride === 0 && needsFetch(index)) return index;
  }
  const count = config.frames.length;
  for (const step of passes) {
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < count; index += step) {
      if (!needsFetch(index)) continue;
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
    const started = performance.now();
    void fetch(config.frames[index] ?? "", { priority: "low" } as RequestInit)
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        fetching.delete(index);
        if (!blob) return;
        blobs[index] = blob;
        bytes += blob.size;
        loaded += 1;
        fetchMs += (performance.now() - started - fetchMs) * 0.2;
        scope.postMessage({ type: "progress", index, loaded, bytes, total: blobs.length });
        schedule();
      })
      .catch(() => {
        fetching.delete(index);
      })
      .finally(pump);
  }
  schedule();
}

function nextToDecode(): number | null {
  for (const index of wanted) {
    if (blobs[index] && !decoding.has(index)) return index;
  }
  return null;
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
    const index = nextToDecode();
    if (index === null) return;
    const blob = blobs[index];
    if (!blob) return;
    decoding.add(index);
    const started = performance.now();
    const jobGeneration = generation;
    void createImageBitmap(blob, decodeOptions(config.decode))
      .then(upload)
      .then((bitmap) => {
        decoding.delete(index);
        decodedAny = true;
        if (jobGeneration !== generation) {
          bitmap.close();
          return;
        }
        inTransit.set(index, posted);
        posted += 1;
        wanted = wanted.filter((frame) => frame !== index);
        scope.postMessage(
          {
            type: "frame",
            index,
            generation: jobGeneration,
            decodeMs: performance.now() - started,
            bitmap,
          },
          [bitmap],
        );
      })
      .catch(() => {
        decoding.delete(index);
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
    case "want": {
      for (const [index, sequence] of inTransit) {
        if (sequence < message.received) inTransit.delete(index);
      }
      wanted = message.frames.filter((index) => !inTransit.has(index));
      position = message.position;
      direction = message.direction >= 0 ? 1 : -1;
      velocity = message.velocity;
      span = message.span;
      pump();
      break;
    }
    case "resize":
      if (!config) return;
      config = { ...config, decode: message.decode };
      generation = message.generation;
      inTransit.clear();
      schedule();
      break;
    case "visibility":
      paused = message.hidden;
      if (!paused) pump();
      break;
  }
};
