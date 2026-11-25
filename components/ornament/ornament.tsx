import type { CSSProperties } from "react";

import { cx } from "@/lib/cx";

import { ornamentShapes, type OrnamentName } from "./paths";

export type OrnamentReveal = "draw" | "rise" | "twinkle" | "none";

export type OrnamentWidth = { base: number; md?: number; lg?: number };

export const ornamentInk = 1.1;

export function ornamentStroke(name: OrnamentName, renderedWidth: number, ink = ornamentInk) {
  return Number(((ink * ornamentShapes[name].width) / renderedWidth).toFixed(3));
}

function sizeVars(name: OrnamentName, width: OrnamentWidth, ink: number) {
  const vars: Record<string, string | number> = {
    "--o-w": `${width.base}px`,
    "--o-sw": ornamentStroke(name, width.base, ink),
  };
  for (const key of ["md", "lg"] as const) {
    const value = width[key];
    if (value === undefined) continue;
    vars[`--o-w-${key}`] = `${value}px`;
    vars[`--o-sw-${key}`] = ornamentStroke(name, value, ink);
  }
  return vars;
}

export function Ornament({
  name,
  width,
  reveal = "draw",
  ink = ornamentInk,
  duration,
  className,
  style,
}: {
  name: OrnamentName;
  width: OrnamentWidth;
  reveal?: OrnamentReveal;
  ink?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const shape = ornamentShapes[name];
  const stroke = shape.mode === "stroke";
  return (
    <span
      aria-hidden="true"
      data-ornament={reveal === "none" ? undefined : reveal}
      data-ornament-name={name}
      className={cx("ornament", className)}
      style={
        {
          ...sizeVars(name, width, ink),
          ...(duration ? { "--o-dur": `${duration}ms` } : {}),
          aspectRatio: `${shape.width} / ${shape.height}`,
          ...style,
        } as CSSProperties
      }
    >
      <svg
        viewBox={`0 0 ${shape.width} ${shape.height}`}
        focusable="false"
        fill={stroke ? "none" : "currentColor"}
        stroke={stroke ? "currentColor" : undefined}
        strokeLinecap={stroke ? "round" : undefined}
        strokeLinejoin={stroke ? "round" : undefined}
      >
        {shape.paths.map((d, index) =>
          stroke ? (
            <path key={index} d={d} pathLength={1} />
          ) : (
            <path key={index} d={d} fillRule="evenodd" />
          ),
        )}
      </svg>
    </span>
  );
}

export const maskOrnaments = {
  eucalyptus: { src: "/ornaments/eucalyptus.svg", width: 800, height: 531.1 },
} as const;

export function MaskOrnament({
  name,
  width,
  reveal = "rise",
  className,
  style,
}: {
  name: keyof typeof maskOrnaments;
  width: OrnamentWidth;
  reveal?: Exclude<OrnamentReveal, "draw">;
  className?: string;
  style?: CSSProperties;
}) {
  const shape = maskOrnaments[name];
  return (
    <span
      aria-hidden="true"
      data-ornament={reveal === "none" ? undefined : reveal}
      data-ornament-name={name}
      className={cx("ornament ornament-mask", className)}
      style={
        {
          "--o-w": `${width.base}px`,
          ...(width.md ? { "--o-w-md": `${width.md}px` } : {}),
          ...(width.lg ? { "--o-w-lg": `${width.lg}px` } : {}),
          "--o-mask": `url(${shape.src})`,
          aspectRatio: `${shape.width} / ${shape.height}`,
          ...style,
        } as CSSProperties
      }
    />
  );
}
