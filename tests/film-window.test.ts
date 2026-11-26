import { describe, expect, it } from "vitest";

import { downloadedPlan, filmStride, filmWindow, nearestFrame } from "@/lib/motion/film-window";

describe("filmWindow", () => {
  it("holds every neighbouring frame on a slow scroll, most of them ahead", () => {
    const { order, stride } = filmWindow({
      position: 100.4,
      velocity: 10,
      direction: 1,
      count: 334,
      capacity: 20,
    });
    expect(stride).toBe(1);
    expect(order[0]).toBe(100);
    expect(order).toHaveLength(20);
    expect(new Set(order).size).toBe(20);
    for (let index = 96; index <= 110; index += 1) expect(order).toContain(index);
    expect(order.filter((index) => index > 100).length).toBeGreaterThan(
      order.filter((index) => index < 100).length * 2,
    );
  });

  it("puts the closest frames first in both directions", () => {
    const { order } = filmWindow({
      position: 50,
      velocity: -20,
      direction: -1,
      count: 334,
      capacity: 12,
    });
    expect(order.slice(0, 4)).toEqual([50, 49, 48, 51]);
  });

  it("aims a fast scroll ahead of the frame on screen, with a wider stride", () => {
    const { order, stride } = filmWindow({
      position: 40,
      velocity: 120,
      direction: 1,
      count: 334,
      capacity: 24,
    });
    expect(stride).toBe(2);
    expect(order[0]).toBe(40);
    expect(order[1]).toBe(50);
    expect(order[2]).toBe(52);
    expect(Math.max(...order)).toBeGreaterThan(40 + 24);
  });

  it("keeps the last frames in reach at the end of the film", () => {
    const { order } = filmWindow({
      position: 330,
      velocity: 300,
      direction: 1,
      count: 334,
      capacity: 24,
    });
    expect(order).toContain(333);
  });

  it("stays inside the film at both ends", () => {
    const start = filmWindow({
      position: 0,
      velocity: -30,
      direction: -1,
      count: 334,
      capacity: 16,
    });
    expect(Math.min(...start.order)).toBe(0);
    expect(start.order.length).toBeGreaterThan(1);
    const end = filmWindow({ position: 333, velocity: 30, direction: 1, count: 334, capacity: 16 });
    expect(Math.max(...end.order)).toBe(333);
    expect(end.order.every((index) => index >= 0 && index < 334)).toBe(true);
  });

  it("limits the stride", () => {
    expect(filmStride(0)).toBe(1);
    expect(filmStride(49)).toBe(1);
    expect(filmStride(-150)).toBe(3);
    expect(filmStride(5000)).toBe(4);
  });
});

describe("nearestFrame", () => {
  it("picks the frame closest to the position", () => {
    expect(nearestFrame([10, 14, 20], 13.4, null)).toBe(14);
  });

  it("breaks a tie towards the frame on screen", () => {
    expect(nearestFrame([10, 12], 11, 9)).toBe(10);
    expect(nearestFrame([10, 12], 11, 13)).toBe(12);
  });

  it("returns null when nothing is decoded", () => {
    expect(nearestFrame([], 5, null)).toBeNull();
  });
});

describe("downloadedPlan", () => {
  it("keeps downloaded frames in order", () => {
    expect(downloadedPlan([10, 11, 9, 12], () => true, 10)).toEqual([10, 11, 9, 12]);
  });

  it("stands in the nearest downloaded frame for one that has not arrived", () => {
    const has = (index: number) => index % 4 === 0;
    expect(downloadedPlan([10, 11, 9, 13], has, 10)).toEqual([12, 8]);
  });

  it("leaves out a frame with nothing downloaded nearby", () => {
    expect(downloadedPlan([50, 51], (index) => index === 0, 50)).toEqual([]);
  });
});
