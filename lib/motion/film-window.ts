export type FilmWindowOptions = {
  position: number;
  velocity: number;
  direction: number;
  count: number;
  capacity: number;
  strideSpeed?: number;
  maxStride?: number;
  leadSeconds?: number;
};

export type FilmWindow = { order: number[]; stride: number };

export function filmStride(velocity: number, strideSpeed = 50, maxStride = 4) {
  return Math.min(Math.max(Math.floor(Math.abs(velocity) / strideSpeed), 1), maxStride);
}

export function filmWindow({
  position,
  velocity,
  direction,
  count,
  capacity,
  strideSpeed = 50,
  maxStride = 4,
  leadSeconds = 0.08,
}: FilmWindowOptions): FilmWindow {
  const stride = filmStride(velocity, strideSpeed, maxStride);
  const forward = direction >= 0 ? 1 : -1;
  const speed = Math.abs(velocity);
  const fast = speed >= strideSpeed;
  const base = Math.min(Math.max(Math.round(position), 0), count - 1);
  const room = forward > 0 ? count - 1 - base : base;
  const lead = fast ? Math.min(Math.max(1, Math.round(speed * leadSeconds)), Math.max(room, 1)) : 1;
  const behindShare = speed >= 1 ? 0.2 : 0.35;
  const behindCount = fast ? 2 : Math.max(2, Math.round(capacity * behindShare));
  const inside = (index: number) => index >= 0 && index < count;

  const ahead: number[] = [];
  for (
    let offset = lead;
    inside(base + forward * offset) && ahead.length < capacity;
    offset = offset === 1 ? Math.max(2, stride) : offset + stride
  ) {
    ahead.push(base + forward * offset);
  }
  const behind: number[] = [];
  for (let offset = 1; offset <= behindCount && inside(base - forward * offset); offset += 1) {
    behind.push(base - forward * offset);
  }

  const order = [base];
  let a = 0;
  let b = 0;
  while (order.length < capacity && (a < ahead.length || b < behind.length)) {
    const run = fast ? capacity : 2;
    for (let take = 0; take < run && a < ahead.length && order.length < capacity; take += 1) {
      order.push(ahead[a++]!);
    }
    if (b < behind.length && order.length < capacity) order.push(behind[b++]!);
  }
  return { order: [...new Set(order)], stride };
}

export function nearestFrame(
  available: Iterable<number>,
  position: number,
  drawn: number | null,
): number | null {
  const target = Math.round(position);
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const index of available) {
    const distance = Math.abs(index - target);
    const closerToDrawn =
      drawn !== null && best !== null && Math.abs(index - drawn) < Math.abs(best - drawn);
    if (distance < bestDistance || (distance === bestDistance && closerToDrawn)) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

export function downloadedPlan(
  order: number[],
  downloaded: (index: number) => boolean,
  position: number,
  reach = 8,
): number[] {
  const result: number[] = [];
  const seen = new Set<number>();
  const take = (index: number) => {
    if (seen.has(index)) return;
    seen.add(index);
    result.push(index);
  };
  for (const index of order) {
    if (downloaded(index)) {
      take(index);
      continue;
    }
    const toward = position < index ? -1 : 1;
    for (let distance = 1; distance <= reach; distance += 1) {
      if (downloaded(index + toward * distance)) {
        take(index + toward * distance);
        break;
      }
      if (downloaded(index - toward * distance)) {
        take(index - toward * distance);
        break;
      }
    }
  }
  return result;
}
