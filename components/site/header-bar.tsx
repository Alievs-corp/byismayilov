"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  ArrowRightIcon,
  CallIcon,
  CloseIcon,
  InstagramIcon,
  LocationIcon,
} from "@/components/icons/iconsax";
import { telHref } from "@/lib/contact-links";
import { cx } from "@/lib/cx";
import type { Locale } from "@/lib/i18n/config";
import { documentTop, measure, onScroll, readScroll } from "@/lib/motion/loop";
import { lockScroll, scrollToTop } from "@/lib/motion/smooth-scroll";
import { formatAzerbaijaniPhone } from "@/lib/phone";

import { button, buttonArrow, roundButton } from "./button";
import { LanguageList, LanguageMenu } from "./language-switch";
import { brandMarkPath } from "./wordmark";

export type HeaderLink = { id: string; label: string; href: string };

type HeaderState = "clear" | "solid";

type Labels = {
  navigation: string;
  language: string;
  openMenu: string;
  closeMenu: string;
  home: string;
  contact: string;
  instagram: string;
};

export type HeaderContact = {
  phones: string[];
  address: string | null;
  instagram: string | null;
};

const clearUntil = 24;

function isCurrent(pathname: string, href: string) {
  if (href === "/" || /^\/(ru|en)$/.test(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function focusable(root: HTMLElement) {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ];
}

function filmEnd(header: HTMLElement): number | null {
  const film = document.querySelector<HTMLElement>("[data-hero-film]");
  const stage = film?.querySelector<HTMLElement>(".hero-stage");
  if (!film || !stage) return null;
  if (getComputedStyle(stage).position !== "sticky") return 1;
  const unpinned = documentTop(film) + film.offsetHeight - window.innerHeight;
  const panel = film.querySelector<HTMLElement>(".panel-push");
  const covered = panel ? documentTop(panel) - header.offsetHeight : unpinned;
  return Math.min(unpinned, covered);
}

function useHeaderState(headerRef: React.RefObject<HTMLElement | null>, pathname: string) {
  const [state, setState] = useState<HeaderState>("clear");

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    let limit = filmEnd(header) ?? clearUntil;
    const update = (y: number) => setState(y < limit ? "clear" : "solid");
    const current = () => Math.max(readScroll().y, window.scrollY);
    const remeasure = () => {
      limit = filmEnd(header) ?? clearUntil;
      update(current());
    };
    const onNative = () => update(current());
    const stopMeasure = measure(document.body, remeasure);
    addEventListener("resize", remeasure, { passive: true });
    addEventListener("scroll", onNative, { passive: true });
    remeasure();
    const stopScroll = onScroll(update);
    return () => {
      stopMeasure();
      removeEventListener("resize", remeasure);
      removeEventListener("scroll", onNative);
      stopScroll();
    };
  }, [headerRef, pathname]);

  return state;
}

export function HeaderBar({
  locale,
  home,
  items,
  brand,
  siteName,
  booking,
  names,
  labels,
  contact,
}: {
  locale: Locale;
  home: string;
  items: HeaderLink[];
  brand: ReactNode;
  siteName: string;
  booking: { href: string; label: string };
  names: Record<Locale, string>;
  labels: Labels;
  contact: HeaderContact;
}) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const state = useHeaderState(headerRef, pathname);

  const close = useCallback(() => {
    setOpenPath(null);
    menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const wide = matchMedia("(min-width: 80rem)");
    const onChange = () => {
      if (wide.matches) setOpenPath(null);
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [open]);

  return (
    <header
      ref={headerRef}
      data-site-header=""
      data-state={open ? "solid" : state}
      data-menu={open ? "open" : undefined}
      style={{ viewTransitionName: "site-header" } as CSSProperties}
      className="site-header h-header fixed inset-x-0 top-0 z-50"
    >
      <div aria-hidden="true" className="site-header-scrim" />
      <div aria-hidden="true" className="site-header-bg" />
      <div
        data-header-row=""
        className="relative z-10 container-page grid h-full grid-cols-[1fr_auto] items-center gap-4 xl:grid-cols-[1fr_auto_1fr]"
      >
        <Link
          href={home}
          onClick={(event) => {
            const plain =
              event.button === 0 &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey;
            if (plain && pathname === home) {
              event.preventDefault();
              setOpenPath(null);
              scrollToTop();
            }
          }}
          aria-label={`${siteName}: ${labels.home}`}
          className="inline-flex min-h-11 items-center justify-self-start"
        >
          {brand}
        </Link>
        <nav aria-label={labels.navigation} className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => {
              const current = isCurrent(pathname, item.href);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className="header-link text-label inline-flex min-h-11 items-center px-3.5 uppercase"
                  >
                    <HeaderLinkLabel label={item.label} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex items-center gap-1.5 justify-self-end sm:gap-2">
          <LanguageMenu locale={locale} label={labels.language} names={names} />
          <Link
            href={booking.href}
            className={cx(button({ variant: "filled", size: "sm" }), "header-cta max-lg:hidden")}
          >
            {booking.label}
            <ArrowRightIcon size={16} className={buttonArrow} />
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? labels.closeMenu : labels.openMenu}
            onClick={() => setOpenPath(open ? null : pathname)}
            className={cx(roundButton({ tone: "ink" }), "header-menu-button xl:hidden")}
          >
            {open ? <CloseIcon size={20} /> : <MenuLines />}
          </button>
        </div>
      </div>
      {open ? (
        <SiteMenu
          locale={locale}
          items={items}
          pathname={pathname}
          booking={booking}
          names={names}
          labels={labels}
          contact={contact}
          onClose={close}
        />
      ) : null}
    </header>
  );
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function HeaderLinkLabel({ label }: { label: string }) {
  const glyphs = Array.from(graphemes.segment(label), (part) => part.segment);
  const row = (className: string) => (
    <span className={className}>
      {glyphs.map((glyph, index) => (
        <span key={index} style={{ "--i": index } as CSSProperties}>
          {glyph}
        </span>
      ))}
    </span>
  );
  return (
    <>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        fill="currentColor"
        className="header-link-spark"
      >
        <path d={brandMarkPath} />
      </svg>
      <span className="sr-only normal-case">{label}</span>
      <span aria-hidden="true" className="header-link-word">
        {row("header-link-sans")}
        {row("header-link-serif")}
      </span>
    </>
  );
}

function MenuLines() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 6.5h14M7 10h10M3 13.5h14" />
    </svg>
  );
}

function SiteMenu({
  locale,
  items,
  pathname,
  booking,
  names,
  labels,
  contact,
  onClose,
}: {
  locale: Locale;
  items: HeaderLink[];
  pathname: string;
  booking: { href: string; label: string };
  names: Record<Locale, string>;
  labels: Labels;
  contact: HeaderContact;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sheet = sheetRef.current;
    lockScroll(true);
    focusable(sheet ?? document.body)[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !sheet) return;
      const header = sheet.closest("header");
      const targets = header ? focusable(header) : [];
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      lockScroll(false);
    };
  }, [onClose]);

  return (
    <div
      ref={sheetRef}
      id="site-menu"
      data-lenis-prevent=""
      className="site-menu top-header fixed inset-x-0 bottom-0 overflow-y-auto overscroll-contain"
    >
      <div className="gap-x-column relative container-page grid min-h-full gap-y-10 pt-6 pb-8 lg:grid-cols-12 lg:pt-12 lg:pb-14">
        <nav aria-label={labels.navigation} className="lg:col-span-7">
          <ol className="flex flex-col">
            {items.map((item, index) => {
              const current = isCurrent(pathname, item.href);
              return (
                <li
                  key={item.id}
                  className="animate-rise border-ink/10 border-b"
                  style={{ animationDelay: `${Math.min(index, 5) * 70}ms` }}
                >
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    onClick={onClose}
                    className="site-menu-link group/menu flex min-h-16 items-center gap-4 py-3 sm:gap-6 lg:min-h-20"
                  >
                    <span className="tabular text-micro text-ink-muted w-7">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-h3">{item.label}</span>
                    <ArrowRightIcon
                      size={24}
                      className="ml-auto shrink-0 transition-transform duration-200 ease-standard group-hover/menu:translate-x-1"
                    />
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="flex flex-col gap-8 lg:col-span-4 lg:col-start-9 lg:justify-end">
          <div className="flex flex-col gap-1 text-small">
            <p className="text-label text-ink-muted uppercase">{labels.contact}</p>
            {contact.address ? (
              <p className="mt-2 inline-flex items-start gap-3">
                <LocationIcon size={20} className="text-caramel-ink mt-0.5 shrink-0" />
                {contact.address}
              </p>
            ) : null}
            {contact.phones.map((phone) => (
              <a
                key={phone}
                href={telHref(phone)}
                className="tabular inline-flex min-h-11 items-center gap-3"
              >
                <CallIcon size={20} className="text-caramel-ink shrink-0" />
                {formatAzerbaijaniPhone(phone)}
              </a>
            ))}
            {contact.instagram ? (
              <a
                href={contact.instagram}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-11 items-center gap-3"
              >
                <InstagramIcon size={20} className="text-caramel-ink shrink-0" />
                {labels.instagram}
              </a>
            ) : null}
          </div>
          <LanguageList locale={locale} names={names} label={labels.language} />
          <Link
            href={booking.href}
            onClick={onClose}
            className={cx(button({ variant: "filled", size: "lg" }), "w-full")}
          >
            {booking.label}
            <ArrowRightIcon size={20} className={buttonArrow} />
          </Link>
        </div>
      </div>
    </div>
  );
}
