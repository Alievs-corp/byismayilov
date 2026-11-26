import glob
import io
import json
import math
import os
import sys

import cv2
import numpy as np

TURN_SCROLL_RATIO = 3.5
EASE_FRAMES = 3.0
SHARP_SIZE = (960, 540)
FLOW_SIZE = (594, 334)

usage = "python scripts/hero-pace.py <film folder> [--report <file>] [--write --version <n>]"


def option(name):
    if name not in sys.argv:
        return None
    index = sys.argv.index(name)
    return sys.argv[index + 1] if index + 1 < len(sys.argv) else None


def measure(frames):
    sharpness, motion = [], []
    previous = None
    for path in frames:
        luma = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        sharp = cv2.resize(luma, SHARP_SIZE, interpolation=cv2.INTER_AREA)
        sharpness.append(float(cv2.Laplacian(sharp, cv2.CV_64F).var()))
        small = cv2.resize(luma, FLOW_SIZE, interpolation=cv2.INTER_AREA)
        if previous is not None:
            flow = cv2.calcOpticalFlowFarneback(previous, small, None, 0.5, 4, 21, 3, 5, 1.1, 0)
            motion.append(float(np.median(np.linalg.norm(flow, axis=2))))
        previous = small
    return np.array(sharpness), np.array(motion)


def gaussian(values, sigma):
    radius = int(math.ceil(sigma * 3))
    kernel = np.exp(-0.5 * (np.arange(-radius, radius + 1) / sigma) ** 2)
    kernel /= kernel.sum()
    padded = np.pad(values, radius, mode="edge")
    return np.convolve(padded, kernel, mode="valid")


def smoothstep(values):
    t = np.clip(values, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def turning(sharpness, motion):
    step_sharpness = gaussian((sharpness[:-1] + sharpness[1:]) / 2, EASE_FRAMES)
    step_motion = gaussian(motion, EASE_FRAMES)
    softer = np.log2(np.median(sharpness) / step_sharpness)
    faster = np.log2(step_motion / np.median(motion))
    return gaussian(smoothstep(np.minimum(softer, faster)), EASE_FRAMES)


def motion_pace(motion):
    smooth = gaussian(motion, 3.0)
    local = np.clip(motion / np.maximum(smooth, 1e-3), 0.6, 1.6)
    local = np.where(smooth < 0.3, 1.0, local)
    steps = np.maximum(smooth, 0.35) ** 0.5 * local
    cumulative = np.concatenate([[0.0], np.cumsum(steps)])
    return cumulative / cumulative[-1] * len(motion)


def spans(weight, threshold=0.5):
    found, start = [], None
    for index, value in enumerate(weight):
        if value >= threshold and start is None:
            start = index
        elif value < threshold and start is not None:
            found.append((start, index))
            start = None
    if start is not None:
        found.append((start, len(weight)))
    return found


def remap(old_pace, weight, inside):
    steps = np.diff(np.array(old_pace, dtype=float))
    total = steps.sum()

    def shaped(slowdown):
        scaled = steps * np.exp(-weight * math.log(slowdown))
        return scaled * total / scaled.sum()

    def ratio(slowdown):
        return steps[inside].sum() / shaped(slowdown)[inside].sum()

    low, high = 1.0, 100.0
    for _ in range(60):
        middle = math.sqrt(low * high)
        if ratio(middle) < TURN_SCROLL_RATIO:
            low = middle
        else:
            high = middle
    new_steps = shaped(high)
    return np.concatenate([[0.0], np.cumsum(new_steps)]) * (len(old_pace) - 1) / total


def main():
    if len(sys.argv) < 2 or sys.argv[1].startswith("--"):
        print(usage)
        sys.exit(1)
    folder = sys.argv[1]
    manifest_path = os.path.join(folder, "manifest.json")
    with io.open(manifest_path, encoding="utf-8") as file:
        manifest = json.load(file)
    tier = manifest["tiers"]["desktop"]
    frames = sorted(glob.glob(os.path.join(folder, os.path.dirname(tier["pattern"]), "*")))[: tier["count"]]
    if len(frames) != tier["count"]:
        sys.exit(f"expected {tier['count']} desktop frames, found {len(frames)}")
    count = tier["count"]
    sharpness, motion = measure(frames)
    old_pace = motion_pace(motion)
    weight = turning(sharpness, motion)
    found = spans(weight)
    inside = np.zeros(count - 1, dtype=bool)
    for start, end in found:
        inside[start:end] = True
    pace = remap(old_pace, weight, inside)
    rounded = [round(float(value), 3) for value in pace]
    report = {
        "turnScrollRatio": TURN_SCROLL_RATIO,
        "spans": [
            {
                "from": start,
                "to": end,
                "oldShare": round(float((old_pace[end] - old_pace[start]) / (count - 1)), 4),
                "newShare": round(float((pace[end] - pace[start]) / (count - 1)), 4),
            }
            for start, end in found
        ],
        "sharpness": [round(float(value), 1) for value in sharpness],
        "motion": [round(float(value), 3) for value in motion],
        "turning": [round(float(value), 3) for value in weight],
        "oldPace": [round(float(value), 3) for value in old_pace],
        "pace": rounded,
    }
    for span in report["spans"]:
        print(
            f"frames {span['from']}-{span['to']}: {span['oldShare'] * 100:.1f}% -> "
            f"{span['newShare'] * 100:.1f}% of the film scroll"
        )
    target = option("--report")
    if target:
        with io.open(target, "w", encoding="utf-8", newline="\n") as file:
            json.dump(report, file)
            file.write("\n")
    if "--write" in sys.argv:
        version = option("--version")
        if version:
            manifest["version"] = int(version)
        manifest["pace"] = rounded
        with io.open(manifest_path, "w", encoding="utf-8", newline="\n") as file:
            json.dump(manifest, file)


main()
