"use client";

import { useEffect, useState } from "react";

import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons/iconsax";

import { arrowControl } from "./button";

export function RailControls({
  target,
  previous,
  next,
}: {
  target: string;
  previous: string;
  next: string;
}) {
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const track = document.getElementById(target);
    if (!track) return;
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      setEdges({ start: track.scrollLeft <= 2, end: track.scrollLeft >= max - 2 });
    };
    update();
    track.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => {
      track.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [target]);

  const move = (direction: 1 | -1) => {
    const track = document.getElementById(target);
    if (!track) return;
    const item = track.querySelector<HTMLElement>("[data-rail-item]");
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = item ? item.offsetWidth + gap : track.clientWidth * 0.8;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * step, behavior: reduced ? "auto" : "smooth" });
  };

  if (edges.start && edges.end) return null;

  return (
    <div className="flex gap-3" data-rail-controls="">
      <button
        type="button"
        aria-controls={target}
        aria-label={previous}
        disabled={edges.start}
        onClick={() => move(-1)}
        className={arrowControl({ tone: "soft" })}
      >
        <ArrowLeftIcon size={20} />
      </button>
      <button
        type="button"
        aria-controls={target}
        aria-label={next}
        disabled={edges.end}
        onClick={() => move(1)}
        className={arrowControl({ tone: "ink" })}
      >
        <ArrowRightIcon size={20} />
      </button>
    </div>
  );
}
