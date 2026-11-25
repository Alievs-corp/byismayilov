"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import { cx } from "@/lib/cx";

export const glows = {
  "wide-dark": { src: "/ornaments/glow-wide-dark.webp", width: 480, height: 320 },
  "orb-light": { src: "/ornaments/glow-orb-light.webp", width: 384, height: 384 },
} as const;

export type GlowName = keyof typeof glows;

export function Glow({
  name,
  float = false,
  className,
  style,
}: {
  name: GlowName;
  float?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const glow = glows[name];

  useEffect(() => {
    const image = ref.current;
    if (!float || !image) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      image.toggleAttribute("data-playing", Boolean(entry?.isIntersecting));
    });
    observer.observe(image);
    return () => observer.disconnect();
  }, [float]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={glow.src}
      width={glow.width}
      height={glow.height}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      data-ornament="glow"
      data-float={float ? "" : undefined}
      className={cx("glow", className)}
      style={style}
    />
  );
}
