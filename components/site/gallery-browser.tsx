"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
  Maximize4Icon,
  PlayIcon,
} from "@/components/icons/iconsax";
import { cx } from "@/lib/cx";
import { fill } from "@/lib/i18n/format";
import type { PublicGalleryItem } from "@/lib/public/gallery";
import type { PublicImage } from "@/lib/public/images";

export type GalleryLabels = {
  before: string;
  after: string;
  open: string;
  close: string;
  previous: string;
  next: string;
  dialog: string;
  counter: string;
  video: string;
};

const ratios = ["aspect-[4/5]", "aspect-[3/4]", "aspect-square", "aspect-[4/5]", "aspect-[5/6]"];

const tileSizes = "(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 92vw";

function Cover({ image, sizes, eager }: { image: PublicImage; sizes: string; eager: boolean }) {
  return (
    <Image
      src={image.src}
      alt={image.alt}
      fill
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      placeholder={image.blurDataURL ? "blur" : "empty"}
      blurDataURL={image.blurDataURL ?? undefined}
      className="card-photo object-cover"
    />
  );
}

function columnTop(index: number, total: number) {
  return [2, 3].some((columns) =>
    Array.from({ length: columns }, (_, column) => Math.ceil((total * column) / columns)).includes(
      index,
    ),
  );
}

function Tile({
  item,
  index,
  total,
  labels,
  onOpen,
}: {
  item: PublicGalleryItem;
  index: number;
  total: number;
  labels: GalleryLabels;
  onOpen: (index: number) => void;
}) {
  const cover = item.image ?? item.video?.poster ?? null;
  const name = item.caption ?? cover?.alt ?? labels.open;
  const eager = columnTop(index, total);
  return (
    <li data-gallery-item="" className="group/card mb-3 break-inside-avoid sm:mb-4 lg:mb-5">
      <button
        type="button"
        onClick={() => onOpen(index)}
        aria-haspopup="dialog"
        aria-label={`${labels.open}: ${name}`}
        className="rounded-card bg-soft relative block w-full overflow-clip text-left"
      >
        <span className={cx("relative block", ratios[index % ratios.length])}>
          {item.before && item.image ? (
            <span className="absolute inset-0 grid grid-cols-2 gap-0.5">
              <span className="relative block overflow-clip">
                <Cover image={item.before} sizes={tileSizes} eager={eager} />
              </span>
              <span className="relative block overflow-clip">
                <Cover image={item.image} sizes={tileSizes} eager={eager} />
              </span>
              <span className="rounded-pill text-micro text-ink absolute bottom-3 left-3 bg-white/90 px-3 py-1.5">
                {labels.before}
              </span>
              <span className="rounded-pill text-micro text-ink absolute right-3 bottom-3 bg-white/90 px-3 py-1.5">
                {labels.after}
              </span>
            </span>
          ) : cover ? (
            <Cover image={cover} sizes={tileSizes} eager={eager} />
          ) : null}
          {item.video ? (
            <span className="text-ink absolute top-3 left-3 inline-flex size-11 items-center justify-center rounded-full bg-white/90">
              <PlayIcon size={20} />
              <span className="sr-only">{labels.video}</span>
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="text-ink absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-full bg-white/90 opacity-0 transition-opacity duration-200 group-focus-within/card:opacity-100 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <Maximize4Icon size={20} />
            </span>
          )}
        </span>
        {item.caption && !item.before ? (
          <span className="rounded-pill text-micro text-ink absolute right-3 bottom-3 left-3 truncate bg-white/90 px-3.5 py-2">
            {item.caption}
          </span>
        ) : null}
      </button>
    </li>
  );
}

const frame = "max-h-[calc(100dvh-9.5rem)] w-auto max-w-full object-contain";

function Stage({ item, labels }: { item: PublicGalleryItem; labels: GalleryLabels }) {
  if (item.video) {
    return (
      <video
        key={item.id}
        controls
        autoPlay
        muted
        playsInline
        poster={item.video.poster?.src}
        aria-label={item.caption ?? labels.video}
        className="max-h-[calc(100dvh-9.5rem)] max-w-full rounded-lg"
      >
        <source src={item.video.src} type={item.video.type} />
      </video>
    );
  }
  if (item.before && item.image) {
    return (
      <div className="flex max-h-[calc(100dvh-9.5rem)] max-w-full items-center justify-center gap-2">
        {[
          { image: item.before, label: labels.before },
          { image: item.image, label: labels.after },
        ].map(({ image, label }) => (
          <figure key={label} className="relative min-w-0">
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(min-width: 1024px) 45vw, 50vw"
              className={cx(frame, "rounded-lg")}
            />
            <figcaption className="rounded-pill text-micro text-ink absolute bottom-3 left-3 bg-white/90 px-3 py-1.5">
              {label}
            </figcaption>
          </figure>
        ))}
      </div>
    );
  }
  if (!item.image) return null;
  return (
    <Image
      src={item.image.src}
      alt={item.image.alt}
      width={item.image.width}
      height={item.image.height}
      sizes="(min-width: 1024px) 70vw, 100vw"
      className={cx(frame, "rounded-lg")}
    />
  );
}

const control =
  "inline-flex size-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-200 hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne";

export function GalleryBrowser({
  items,
  labels,
}: {
  items: PublicGalleryItem[];
  labels: GalleryLabels;
}) {
  const [current, setCurrent] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const close = useCallback(() => {
    dialog.current?.close();
  }, []);

  const step = useCallback(
    (direction: 1 | -1) => {
      setCurrent((value) =>
        value === null ? value : (value + direction + items.length) % items.length,
      );
    },
    [items.length],
  );

  useEffect(() => {
    const node = dialog.current;
    if (!node || current === null || node.open) return;
    node.showModal();
    document.documentElement.style.overflow = "hidden";
  }, [current]);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const onClose = () => {
      document.documentElement.style.overflow = "";
      setCurrent(null);
    };
    node.addEventListener("close", onClose);
    return () => {
      node.removeEventListener("close", onClose);
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (current === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, step]);

  const onPointerDown = (event: PointerEvent) => {
    start.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: PointerEvent) => {
    const origin = start.current;
    start.current = null;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
  };

  const item = current === null ? null : (items[current] ?? null);
  const backdropClose = (event: { target: unknown; currentTarget: unknown }) => {
    if (event.target === event.currentTarget) close();
  };

  return (
    <>
      <ul className="columns-2 gap-3 sm:gap-4 lg:columns-3 lg:gap-5">
        {items.map((entry, index) => (
          <Tile
            key={entry.id}
            item={entry}
            index={index}
            total={items.length}
            labels={labels}
            onOpen={setCurrent}
          />
        ))}
      </ul>
      <dialog
        ref={dialog}
        aria-label={labels.dialog}
        data-lenis-prevent=""
        onClick={backdropClose}
        className="backdrop:bg-dark m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-white"
      >
        {item ? (
          <div className="relative flex h-full flex-col" onClick={backdropClose}>
            <div className="flex items-center justify-between gap-4 p-4 sm:px-8">
              <p aria-live="polite" className="text-label tabular text-on-dark-muted uppercase">
                {fill(labels.counter, { n: (current ?? 0) + 1, total: items.length })}
              </p>
              <button type="button" onClick={close} aria-label={labels.close} className={control}>
                <CloseIcon size={24} />
              </button>
            </div>
            <div
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onClick={backdropClose}
              style={{ touchAction: "pan-y" }}
              className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-24"
            >
              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label={labels.previous}
                  className={cx(control, "absolute left-3 z-10 hidden sm:inline-flex")}
                >
                  <ArrowLeftIcon size={24} />
                </button>
              ) : null}
              <Stage item={item} labels={labels} />
              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label={labels.next}
                  className={cx(control, "absolute right-3 z-10 hidden sm:inline-flex")}
                >
                  <ArrowRightIcon size={24} />
                </button>
              ) : null}
            </div>
            <div className="flex min-h-20 items-center justify-between gap-4 p-4 sm:px-8">
              <p className="font-display max-w-2xl text-h4">{item.caption}</p>
              {items.length > 1 ? (
                <div className="flex gap-2 sm:hidden">
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label={labels.previous}
                    className={control}
                  >
                    <ArrowLeftIcon size={24} />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label={labels.next}
                    className={control}
                  >
                    <ArrowRightIcon size={24} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
