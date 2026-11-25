import type { ReactNode } from "react";

import {
  CallIcon,
  ClockIcon,
  ExportSquareIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  LocationIcon,
  MailIcon,
  TiktokIcon,
  WhatsappIcon,
  YoutubeIcon,
  type IconProps,
} from "@/components/icons/iconsax";
import { mailtoHref, telHref, whatsappHref } from "@/lib/contact-links";
import type { SocialNetwork } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { pickLocale } from "@/lib/i18n/localized";
import { formatAzerbaijaniPhone } from "@/lib/phone";
import type { SiteSettings } from "@/lib/public/settings";
import { socialNetworkLabels } from "@/lib/validation/settings";

export const socialIcons: Record<SocialNetwork, (props: IconProps) => ReactNode> = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedinIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
};

const row = "inline-flex min-h-11 items-center gap-3 underline-offset-4 hover:underline";

export function mapHref(settings: SiteSettings): string | null {
  if (settings.mapUrl) return settings.mapUrl;
  if (!settings.address) return null;
  const query = settings.address.en || settings.address.az;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function mapEmbedUrl(settings: SiteSettings): string | null {
  const url = settings.mapUrl;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.pathname.startsWith("/maps/embed")
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export function hasContactDetails(settings: SiteSettings): boolean {
  return Boolean(
    settings.address ||
    settings.phones.length ||
    settings.emails.length ||
    settings.whatsappNumber ||
    settings.workingHours ||
    settings.socials.length,
  );
}

export function ContactDetails({
  settings,
  locale,
  dict,
}: {
  settings: SiteSettings;
  locale: Locale;
  dict: Dictionary;
}) {
  const address = settings.address ? pickLocale(settings.address, locale) : null;
  const hours = settings.workingHours ? pickLocale(settings.workingHours, locale) : null;
  const map = mapHref(settings);
  return (
    <dl data-contact-details="" className="grid gap-6 sm:grid-cols-2">
      {address ? (
        <div>
          <dt className="text-ink-muted text-small">{dict.contact.address}</dt>
          <dd className="mt-1">
            <span className="inline-flex items-start gap-3">
              <LocationIcon size={20} className="mt-0.5 shrink-0" />
              {address}
            </span>
            {map ? (
              <a href={map} target="_blank" rel="noopener" className={`${row} ml-8 text-small`}>
                {dict.contact.openMap}
                <ExportSquareIcon size={16} />
              </a>
            ) : null}
          </dd>
        </div>
      ) : null}
      {settings.phones.length || settings.whatsappNumber ? (
        <div>
          <dt className="text-ink-muted text-small">{dict.contact.phone}</dt>
          <dd className="mt-1 flex flex-col">
            {settings.phones.map((phone) => (
              <a key={phone.number} href={telHref(phone.number)} className={row}>
                <CallIcon size={20} className="shrink-0" />
                <span>
                  <span className="text-ink-muted">{pickLocale(phone.label, locale)}: </span>
                  <span className="tabular">{formatAzerbaijaniPhone(phone.number)}</span>
                </span>
              </a>
            ))}
            {settings.whatsappNumber ? (
              <a
                href={whatsappHref(settings.whatsappNumber)}
                target="_blank"
                rel="noopener"
                className={row}
              >
                <WhatsappIcon size={20} className="shrink-0" />
                {dict.contact.whatsapp}
              </a>
            ) : null}
          </dd>
        </div>
      ) : null}
      {settings.emails.length ? (
        <div>
          <dt className="text-ink-muted text-small">{dict.contact.email}</dt>
          <dd className="mt-1 flex flex-col">
            {settings.emails.map((email) => (
              <a key={email} href={mailtoHref(email)} className={`${row} break-all`}>
                <MailIcon size={20} className="shrink-0" />
                {email}
              </a>
            ))}
          </dd>
        </div>
      ) : null}
      {hours ? (
        <div>
          <dt className="text-ink-muted text-small">{dict.contact.hours}</dt>
          <dd className="mt-1 inline-flex items-start gap-3 whitespace-pre-line">
            <ClockIcon size={20} className="mt-0.5 shrink-0" />
            {hours}
          </dd>
        </div>
      ) : null}
      {settings.socials.length ? (
        <div>
          <dt className="text-ink-muted text-small">{dict.contact.socials}</dt>
          <dd className="mt-1 flex flex-wrap gap-2">
            {settings.socials.map((social) => {
              const Icon = socialIcons[social.network];
              return (
                <a
                  key={social.network}
                  href={social.url}
                  target="_blank"
                  rel="noopener"
                  aria-label={socialNetworkLabels[social.network]}
                  className="inline-flex size-11 items-center justify-center rounded-full border border-line-strong"
                >
                  <Icon size={20} />
                </a>
              );
            })}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
