import Link from "next/link";

import {
  ArrowRightIcon,
  CallIcon,
  ClockIcon,
  ExportSquareIcon,
  InstagramIcon,
  LocationIcon,
  WhatsappIcon,
} from "@/components/icons/iconsax";
import { button, buttonArrow } from "@/components/site/button";
import { mapEmbedUrl, mapHref } from "@/components/site/contact-details";
import { telHref, whatsappHref } from "@/lib/contact-links";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { pickLocale } from "@/lib/i18n/localized";
import { formatAzerbaijaniPhone } from "@/lib/phone";
import type { SiteSettings } from "@/lib/public/settings";

const row = "inline-flex min-h-11 items-center gap-3";

export function ContactBlock({
  id,
  title,
  body,
  settings,
  locale,
  dict,
  booking,
}: {
  id: string;
  title: string;
  body: string;
  settings: SiteSettings;
  locale: Locale;
  dict: Dictionary;
  booking: { label: string; href: string };
}) {
  const address = settings.address ? pickLocale(settings.address, locale) : null;
  const hours = settings.workingHours ? pickLocale(settings.workingHours, locale) : null;
  const instagram = settings.socials.find((social) => social.network === "instagram");
  const map = mapHref(settings);
  const embed = mapEmbedUrl(settings);
  return (
    <div data-contact-details="" className="gap-x-column grid gap-y-12 lg:grid-cols-12">
      <div className="flex flex-col gap-8 lg:col-span-5">
        <div>
          <h2 id={id} className="text-h2">
            {title}
          </h2>
          <p className="text-ink-muted mt-4 max-w-md">{body}</p>
        </div>
        {address ? <p className="font-display max-w-md text-h3">{address}</p> : null}
        <ul className="border-ink/10 flex flex-col border-t">
          {settings.phones.map((phone) => (
            <li key={phone.number} className="border-ink/10 border-b">
              <a href={telHref(phone.number)} className={`${row} tabular w-full py-2`}>
                <CallIcon size={20} className="text-caramel-ink shrink-0" />
                {formatAzerbaijaniPhone(phone.number)}
              </a>
            </li>
          ))}
          {settings.whatsappNumber ? (
            <li className="border-ink/10 border-b">
              <a
                href={whatsappHref(settings.whatsappNumber)}
                target="_blank"
                rel="noopener"
                className={`${row} w-full py-2`}
              >
                <WhatsappIcon size={20} className="text-caramel-ink shrink-0" />
                {dict.contact.whatsapp}
              </a>
            </li>
          ) : null}
          {instagram ? (
            <li className="border-ink/10 border-b">
              <a
                href={instagram.url}
                target="_blank"
                rel="noopener"
                className={`${row} w-full py-2`}
              >
                <InstagramIcon size={20} className="text-caramel-ink shrink-0" />
                {dict.masters.instagram}
              </a>
            </li>
          ) : null}
          {hours ? (
            <li className={`${row} border-ink/10 border-b py-2 whitespace-pre-line`}>
              <ClockIcon size={20} className="text-caramel-ink shrink-0" />
              {hours}
            </li>
          ) : null}
        </ul>
        <div>
          <Link href={booking.href} className={button()}>
            {booking.label}
            <ArrowRightIcon size={20} className={buttonArrow} />
          </Link>
        </div>
      </div>
      <div className="lg:col-span-6 lg:col-start-7">
        {embed ? (
          <iframe
            src={embed}
            title={dict.contact.map}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="rounded-card bg-soft aspect-[4/3] w-full border-0"
          />
        ) : (
          <div data-reveal="scale" className="map-card">
            <span aria-hidden="true" className="map-card-pin">
              <LocationIcon size={32} />
            </span>
            {map ? (
              <a
                href={map}
                target="_blank"
                rel="noopener"
                className={`${button({ variant: "light", size: "sm" })} relative`}
              >
                {dict.contact.openMap}
                <ExportSquareIcon size={16} />
              </a>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
