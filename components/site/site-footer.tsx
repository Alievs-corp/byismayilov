import Link from "next/link";
import { connection } from "next/server";
import type { CSSProperties, ReactNode } from "react";

import {
  ArrowRightIcon,
  CallIcon,
  ClockIcon,
  LocationIcon,
  MailIcon,
  WhatsappIcon,
} from "@/components/icons/iconsax";
import { MaskOrnament } from "@/components/ornament/ornament";
import { socialIcons } from "@/components/site/contact-details";
import { mailtoHref, telHref, whatsappHref } from "@/lib/contact-links";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { pickLocale } from "@/lib/i18n/localized";
import { formatAzerbaijaniPhone } from "@/lib/phone";
import { hideBlogWithoutPosts } from "@/lib/public/blog-link";
import { getFooterMenus, getMenu } from "@/lib/public/menus";
import { getSiteSettings } from "@/lib/public/settings";
import { routes } from "@/lib/routes";
import { mainMenuKey } from "@/lib/validation/menus";
import { socialNetworkLabels } from "@/lib/validation/settings";

import { button, buttonArrow } from "./button";
import { BrandMark } from "./wordmark";

function Heading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-label text-on-dark-muted font-sans uppercase">
      {children}
    </h2>
  );
}

const rowLink =
  "inline-flex min-h-11 min-w-11 items-center gap-3 transition-colors duration-200 ease-standard hover:text-champagne";

const rowIcon = "shrink-0 text-honey";

export async function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  await connection();
  const [settings, columns, mainMenu] = await Promise.all([
    getSiteSettings(),
    getFooterMenus(locale),
    getMenu(mainMenuKey, locale),
  ]);
  const address = settings.address ? pickLocale(settings.address, locale) : null;
  const hours = settings.workingHours ? pickLocale(settings.workingHours, locale) : null;
  const name = settings.legalName || dict.meta.siteName;
  const wordmark = dict.meta.siteName;
  const whatsapp = settings.whatsappNumber;
  const navigation = await Promise.all(
    (columns.length
      ? columns
      : [{ key: "main", title: dict.footer.navigation, items: mainMenu }]
    ).map(async (column) => ({
      ...column,
      items: await hideBlogWithoutPosts(column.items, locale),
    })),
  );

  return (
    <footer
      data-site-footer=""
      style={{ viewTransitionName: "site-footer" } as CSSProperties}
      className="site-footer surface-dark"
    >
      <MaskOrnament
        name="eucalyptus"
        width={{ base: 190, md: 300, lg: 340 }}
        className="footer-ornament"
      />
      <div className="footer-grid gap-x-column relative container-page grid gap-y-12 pb-12 md:grid-cols-8 lg:grid-cols-12">
        <div className="flex max-w-sm flex-col items-start gap-6 md:col-span-8 lg:col-span-4">
          <p className="font-display text-h3 text-white">{dict.footer.tagline}</p>
          <Link
            href={localePath(locale, routes.booking())}
            className={button({ variant: "light", size: "sm" })}
          >
            {dict.common.bookOnline}
            <ArrowRightIcon size={16} className={buttonArrow} />
          </Link>
        </div>
        <section aria-labelledby="footer-contact" className="md:col-span-4 lg:col-span-3">
          <Heading id="footer-contact">{dict.footer.contacts}</Heading>
          <ul className="mt-4 flex flex-col text-small">
            {address ? (
              <li>
                {settings.mapUrl ? (
                  <a href={settings.mapUrl} target="_blank" rel="noopener" className={rowLink}>
                    <LocationIcon size={20} className={rowIcon} />
                    {address}
                  </a>
                ) : (
                  <span className="inline-flex min-h-11 min-w-11 items-center gap-3">
                    <LocationIcon size={20} className={rowIcon} />
                    {address}
                  </span>
                )}
              </li>
            ) : null}
            {settings.phones.map((phone) => (
              <li key={phone.number}>
                <a href={telHref(phone.number)} className={rowLink}>
                  <CallIcon size={20} className={rowIcon} />
                  <span className="tabular">{formatAzerbaijaniPhone(phone.number)}</span>
                </a>
              </li>
            ))}
            {settings.emails.map((email) => (
              <li key={email}>
                <a href={mailtoHref(email)} className={rowLink}>
                  <MailIcon size={20} className={rowIcon} />
                  {email}
                </a>
              </li>
            ))}
            {whatsapp ? (
              <li>
                <a href={whatsappHref(whatsapp)} target="_blank" rel="noopener" className={rowLink}>
                  <WhatsappIcon size={20} className={rowIcon} />
                  {dict.contact.whatsapp}
                </a>
              </li>
            ) : null}
            {hours ? (
              <li className="inline-flex min-h-11 min-w-11 items-center gap-3">
                <ClockIcon size={20} className={rowIcon} />
                {hours}
              </li>
            ) : null}
          </ul>
        </section>
        {navigation.map((column) =>
          column.items.length ? (
            <nav
              key={column.key}
              aria-labelledby={`footer-nav-${column.key}`}
              className="md:col-span-2 lg:col-span-2"
            >
              <Heading id={`footer-nav-${column.key}`}>{column.title}</Heading>
              <ul className="mt-4 flex flex-col text-small">
                {column.items.flatMap((item) =>
                  item.href ? (
                    <li key={item.id}>
                      <Link href={item.href} className={rowLink}>
                        {item.label}
                      </Link>
                    </li>
                  ) : (
                    []
                  ),
                )}
              </ul>
            </nav>
          ) : null,
        )}
        {settings.socials.length ? (
          <section aria-labelledby="footer-socials" className="md:col-span-2 lg:col-span-2">
            <Heading id="footer-socials">{dict.footer.followUs}</Heading>
            <ul className="mt-4 flex flex-wrap gap-2">
              {settings.socials.map((social) => {
                const Icon = socialIcons[social.network];
                return (
                  <li key={social.network}>
                    <a
                      href={social.url}
                      target="_blank"
                      rel="noopener"
                      aria-label={socialNetworkLabels[social.network]}
                      className="hover:border-champagne hover:text-champagne inline-flex size-12 items-center justify-center rounded-full border border-white/25 transition-colors duration-200"
                    >
                      <Icon size={20} />
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
      <div className="@container container-page" aria-hidden="true">
        <p data-wordmark="" className="footer-wordmark">
          <BrandMark className="footer-wordmark-mark" />
          {[...wordmark].map((letter, index) => (
            <span key={index} className="inline-block overflow-clip">
              <span className="wm-l" style={{ "--i": index } as CSSProperties}>
                {letter}
              </span>
            </span>
          ))}
        </p>
      </div>
      <div className="border-t border-white/10">
        <p className="text-on-dark-muted container-page py-5 text-small">
          {"©"} {new Date().getFullYear()} {name}. {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
