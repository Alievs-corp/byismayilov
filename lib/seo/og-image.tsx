import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { readMediaObject } from "@/lib/media";

import { ogImageSize, siteName } from "./config";
import type { OgCard } from "./og-card";

const colors = {
  dark: "#16110e",
  accent: "#ecdcc3",
  honey: "#dca35c",
  soft: "#f4eee7",
  white: "#ffffff",
} as const;

const fontFiles = [
  { name: "Display", file: "display-latin-400.ttf", weight: 400 },
  { name: "DisplayCyrillic", file: "display-cyrillic-400.ttf", weight: 400 },
  { name: "Sans", file: "sans-latin-700.ttf", weight: 700 },
  { name: "SansCyrillic", file: "sans-cyrillic-700.ttf", weight: 700 },
  { name: "Sans", file: "sans-latin-500.ttf", weight: 500 },
  { name: "SansCyrillic", file: "sans-cyrillic-500.ttf", weight: 500 },
] as const;

type Font = { name: string; data: Buffer; weight: 400 | 500 | 700; style: "normal" };

let fonts: Promise<Font[]> | undefined;

function loadFonts(): Promise<Font[]> {
  fonts ??= Promise.all(
    fontFiles.map(async ({ name, file, weight }) => ({
      name,
      data: await readFile(join(process.cwd(), "assets", "fonts", "og", file)),
      weight,
      style: "normal" as const,
    })),
  );
  return fonts;
}

const photoBox = { width: 480, height: 630 } as const;

const photoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const photoMaxBytes = 4 * 1024 * 1024;

async function loadPhoto(key: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    const object = await readMediaObject(key, null);
    if (object.status !== "found") return null;
    if (!photoTypes.has(object.type) || (object.length ?? 0) > photoMaxBytes) return null;
    const bytes = Buffer.from(await new Response(object.body).arrayBuffer());
    return `data:${object.type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export function titleSize(title: string): number {
  if (title.length <= 28) return 76;
  if (title.length <= 48) return 64;
  if (title.length <= 72) return 54;
  return 46;
}

export async function renderOgImage(card: OgCard, host: string): Promise<ImageResponse> {
  const [loaded, photo] = await Promise.all([loadFonts(), loadPhoto(card.imageKey)]);
  const textWidth = photo ? 720 : 1200;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: ogImageSize.width,
        height: ogImageSize.height,
        background: colors.dark,
        fontFamily: "Sans, SansCyrillic",
        color: colors.white,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: textWidth,
          height: ogImageSize.height,
          padding: 64,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Display, DisplayCyrillic",
              fontSize: 44,
              fontWeight: 400,
              letterSpacing: -0.5,
            }}
          >
            {siteName}
          </div>
          <div
            style={{
              display: "flex",
              width: 64,
              height: 2,
              marginTop: 18,
              background: colors.honey,
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {card.eyebrow ? (
            <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: colors.accent }}>
              {card.eyebrow}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontFamily: "Display, DisplayCyrillic",
              fontSize: titleSize(card.title),
              fontWeight: 400,
              lineHeight: 1.08,
              letterSpacing: -1,
            }}
          >
            {card.title}
          </div>
          {card.subtitle ? (
            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontSize: 26,
                fontWeight: 500,
                lineHeight: 1.35,
                color: "rgba(255,255,255,0.78)",
              }}
            >
              {card.subtitle}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 500,
            color: "rgba(255,255,255,0.78)",
          }}
        >
          {host}
        </div>
      </div>
      {photo ? (
        <div
          style={{
            display: "flex",
            width: photoBox.width,
            height: photoBox.height,
            background: colors.soft,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            width={photoBox.width}
            height={photoBox.height}
            alt=""
            style={{ objectFit: "contain" }}
          />
        </div>
      ) : null}
    </div>,
    {
      ...ogImageSize,
      fonts: loaded,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    },
  );
}
