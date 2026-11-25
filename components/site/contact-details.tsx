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

function handleOf(url: string): string {
  try {
    const [first] = new URL(url).pathname.split("/").filter(Boolean);
    return first ? `@${first.replace(/^@/, "")}` : url;
  } catch {
    return url;
  }
}

const rowShell = "border-line gap-x-column grid gap-y-2 border-b py-5 sm:grid-cols-[10rem_1fr]";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={rowShell}>
      <dt className="text-label text-ink-muted pt-1.5 uppercase">{label}</dt>
      <dd className="flex flex-col items-start">{children}</dd>
    </div>
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
  const instagram = settings.socials.find((social) => social.network === "instagram");
  const others = settings.socials.filter((social) => social.network !== "instagram");
  return (
    <dl data-contact-details="" className="border-t border-line">
      {address ? (
        <Row label={dict.contact.address}>
          <span className="font-display text-h3">{address}</span>
          {map ? (
            <a href={map} target="_blank" rel="noopener" className={`${row} text-small`}>
              <LocationIcon size={20} className="text-caramel-ink shrink-0" />
              {dict.contact.openMap}
              <ExportSquareIcon size={16} />
            </a>
          ) : null}
        </Row>
      ) : null}
      {settings.phones.length ? (
        <Row label={dict.contact.phone}>
          {settings.phones.map((phone) => (
            <a key={phone.number} href={telHref(phone.number)} className={row}>
              <CallIcon size={20} className="text-caramel-ink shrink-0" />
              <span className="tabular font-display text-h4">
                {formatAzerbaijaniPhone(phone.number)}
              </span>
            </a>
          ))}
        </Row>
      ) : null}
      {settings.whatsappNumber ? (
        <Row label={dict.contact.whatsappLabel}>
          <a
            href={whatsappHref(settings.whatsappNumber)}
            target="_blank"
            rel="noopener"
            className={row}
          >
            <WhatsappIcon size={20} className="text-caramel-ink shrink-0" />
            {dict.contact.whatsapp}
          </a>
        </Row>
      ) : null}
      {settings.emails.length ? (
        <Row label={dict.contact.email}>
          {settings.emails.map((email) => (
            <a key={email} href={mailtoHref(email)} className={`${row} break-all`}>
              <MailIcon size={20} className="text-caramel-ink shrink-0" />
              {email}
            </a>
          ))}
        </Row>
      ) : null}
      {hours ? (
        <Row label={dict.contact.hours}>
          <span className="inline-flex items-start gap-3 py-2 whitespace-pre-line">
            <ClockIcon size={20} className="text-caramel-ink mt-0.5 shrink-0" />
            {hours}
          </span>
        </Row>
      ) : null}
      {instagram || others.length ? (
        <Row label={dict.contact.socials}>
          {instagram ? (
            <a href={instagram.url} target="_blank" rel="noopener" className={row}>
              <InstagramIcon size={20} className="text-caramel-ink shrink-0" />
              {handleOf(instagram.url)}
            </a>
          ) : null}
          {others.map((social) => {
            const Icon = socialIcons[social.network];
            return (
              <a
                key={social.network}
                href={social.url}
                target="_blank"
                rel="noopener"
                className={row}
              >
                <Icon size={20} className="text-caramel-ink shrink-0" />
                {socialNetworkLabels[social.network]}
              </a>
            );
          })}
        </Row>
      ) : null}
    </dl>
  );
}
