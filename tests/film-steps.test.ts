import { describe, expect, it } from "vitest";

import { filmSettle } from "@/lib/motion/film-steps";

function run(settle: ReturnType<typeof filmSettle>, targets: number[], start = 0, interval = 16) {
  return targets.map((target, index) => settle.goal(target, start + index * interval));
}

describe("filmSettle", () => {
  it("follows the target while it moves", () => {
    const settle = filmSettle({ count: 300 });
    expect(run(settle, [10, 10.2, 10.4, 10.6])).toEqual([10, 10.2, 10.4, 10.6]);
  });

  it("comes to rest on the next whole frame in the direction of travel", () => {
    const settle = filmSettle({ count: 300 });
    run(settle, [10, 10.2, 10.4]);
    const held = run(
      settle,
      Array.from({ length: 12 }, () => 10.4),
      48,
    );
    expect(held.at(-1)).toBe(11);
    expect(settle.resting).toBe(11);
  });

  it("rests on the previous whole frame when scrolling backwards", () => {
    const settle = filmSettle({ count: 300 });
    run(settle, [12, 11.8, 11.6]);
    const held = run(
      settle,
      Array.from({ length: 12 }, () => 11.6),
      48,
    );
    expect(held.at(-1)).toBe(11);
  });

  it("snaps to the nearest frame when the target is almost on it", () => {
    const settle = filmSettle({ count: 300 });
    run(settle, [10, 10.05]);
    expect(
      run(
        settle,
        Array.from({ length: 12 }, () => 10.05),
        32,
      ).at(-1),
    ).toBe(10);
  });

  it("never steps back when scrolling resumes in the same direction", () => {
    const settle = filmSettle({ count: 300 });
    run(settle, [10, 10.2, 10.4]);
    run(
      settle,
      Array.from({ length: 12 }, () => 10.4),
      48,
    );
    const resumed = run(settle, [10.6, 10.8, 11.1, 11.3], 400);
    expect(resumed).toEqual([11, 11, 11.1, 11.3]);
  });

  it("releases the rest frame at once when the direction reverses", () => {
    const settle = filmSettle({ count: 300 });
    run(settle, [10, 10.2, 10.4]);
    run(
      settle,
      Array.from({ length: 12 }, () => 10.4),
      48,
    );
    expect(run(settle, [10.3], 400)).toEqual([10.3]);
  });
});
