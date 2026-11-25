import { connection } from "next/server";

import { localePath, locales, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { pickLocale } from "@/lib/i18n/localized";
import { hideBlogWithoutPosts } from "@/lib/public/blog-link";
import { getMenu, type PublicMenuItem } from "@/lib/public/menus";
import { getSiteSettings } from "@/lib/public/settings";
import { routes } from "@/lib/routes";
import { mainMenuKey } from "@/lib/validation/menus";

import { HeaderBar, type HeaderLink } from "./header-bar";
import { SiteLogo } from "./site-logo";

function fallbackMenu(locale: Locale, dict: Dictionary): PublicMenuItem[] {
  const item = (id: string, label: string, path: string): PublicMenuItem => ({
    id,
    label,
    href: localePath(locale, path),
    children: [],
  });
  return [
    item("services", dict.services.title, routes.services()),
    item("masters", dict.masters.title, routes.masters()),
    item("gallery", dict.gallery.title, routes.gallery()),
    item("blog", dict.blog.title, routes.blog()),
    item("contact", dict.contact.title, routes.contact()),
  ];
}

export async function SiteHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  await connection();
  const [menu, settings] = await Promise.all([getMenu(mainMenuKey, locale), getSiteSettings()]);
  const visibleMenu = await hideBlogWithoutPosts(
    menu.length ? menu : fallbackMenu(locale, dict),
    locale,
  );
  const items = visibleMenu.flatMap((item): HeaderLink[] =>
    item.href ? [{ id: item.id, label: item.label, href: item.href }] : [],
  );
  const names = Object.fromEntries(locales.map((code) => [code, dict.locales[code]])) as Record<
    Locale,
    string
  >;

  return (
    <HeaderBar
      locale={locale}
      home={localePath(locale)}
      items={items}
      brand={<SiteLogo image={settings.logoLight} name={dict.meta.siteName} />}
      siteName={dict.meta.siteName}
      booking={{ href: localePath(locale, routes.booking()), label: dict.common.bookOnline }}
      names={names}
      labels={{
        navigation: dict.common.mainNavigation,
        language: dict.common.language,
        openMenu: dict.common.openMenu,
        closeMenu: dict.common.closeMenu,
        home: dict.common.home,
        contact: dict.common.contact,
        instagram: dict.masters.instagram,
      }}
      contact={{
        phones: settings.phones.map((phone) => phone.number),
        address: settings.address ? pickLocale(settings.address, locale) || null : null,
        instagram: settings.socials.find((social) => social.network === "instagram")?.url ?? null,
      }}
    />
  );
}
