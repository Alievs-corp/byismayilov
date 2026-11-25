import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { BookingBand } from "@/components/home/booking-band";
import { ReviewRail } from "@/components/home/review-rail";
import { ServiceCard } from "@/components/home/service-rail";
import { ArrowLeftIcon, ArrowRightIcon, CallIcon } from "@/components/icons/iconsax";
import { Glow } from "@/components/ornament/glow";
import { MaskOrnament, Ornament } from "@/components/ornament/ornament";
import type { OrnamentName } from "@/components/ornament/paths";
import {
  arrowControl,
  button,
  buttonArrow,
  card,
  chip,
  roundButton,
  textLink,
} from "@/components/site/button";
import { EmptyState } from "@/components/site/empty-state";
import {
  choiceChip,
  choiceInput,
  fieldControl,
  fieldLabel,
  selectControl,
  textareaControl,
} from "@/components/site/form-styles";
import { PageHeading } from "@/components/site/page-heading";
import { SectionHead } from "@/components/site/section-head";
import { BrandMark, Wordmark } from "@/components/site/wordmark";
import { defaultLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getFeaturedServices, type ServiceListItem } from "@/lib/public/services";

import { TokenValue } from "./token-value";

const colors = [
  ["white", "Page"],
  ["cream", "Alternate section, menu, page head"],
  ["soft", "Card fill, soft control"],
  ["blush", "One accent card per row"],
  ["champagne", "Accent on dark, image backdrop"],
  ["honey", "Field and glow light"],
  ["caramel", "Brand mark, field, large text only"],
  ["caramel-ink", "Accent text and icons on light"],
  ["espresso", "Field depth, dark gradients"],
  ["ink", "Text and primary buttons"],
  ["ink-muted", "Secondary text"],
  ["line", "Hairlines"],
  ["line-strong", "Form borders"],
  ["dark", "Footer, booking band"],
  ["on-dark-muted", "Secondary text on dark"],
] as const;

const type = [
  ["text-display", "byismayilov", "font-display font-light"],
  ["text-hero", "SAÇ RƏNGLƏMƏ", "font-display uppercase"],
  ["text-h1", "Elməddin İsmayılov", "font-display"],
  ["text-h2", "Xidmətlər və qiymətlər", "font-display"],
  ["text-h3", "Təbii rəng, Ğğ Iı İi Şş Çç Öö Üü Əə", "font-display"],
  ["text-h4", "Окрашивание и стрижки", "font-display"],
  ["text-lead", "Elməddin İsmayılovdan təbii görünüşlü rəng keçidləri.", ""],
  ["text-base", "Xidməti və sizə rahat vaxtı seçin, salon sizinlə əlaqə saxlasın.", ""],
  ["text-small", "Hər xidmətin qiyməti və müddəti. Цена и длительность.", ""],
  ["text-label", "Xidmətlər · Ustalar · Əlaqə", "uppercase"],
  ["text-button", "Onlayn qeydiyyat", "uppercase"],
  ["text-micro", "Razılaşma ilə", ""],
] as const;

const ornaments: { name: OrnamentName; width: number; place: string }[] = [
  { name: "hair-strand", width: 240, place: "Home services section head (done)" },
  { name: "hair-wave", width: 300, place: "Home booking band (done)" },
  { name: "blossom-spray", width: 150, place: "Empty states and 404 (done)" },
  { name: "magnolia", width: 150, place: "/qeydiyyat side column, desktop only (page agent)" },
  { name: "peony", width: 120, place: "/ustalar page head ornament slot (page agent)" },
  { name: "sparkle", width: 48, place: "Logo mark echo only" },
  { name: "asterisk", width: 48, place: "Spare; one list bullet at most" },
];

const fallbackService: ServiceListItem = {
  id: "kit",
  name: "[Xidmət adı]",
  summary: null,
  href: "/xidmetler",
  price: { kind: "on_request", amount: null },
  durationMinutes: 90,
  image: null,
};

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line py-16">
      <h2 id={id} className="mb-10 text-h3">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function KitPage() {
  await connection();
  if (process.env.NODE_ENV === "production" && process.env.DESIGN_KIT !== "1") notFound();
  const dict = await getDictionary(defaultLocale);
  const services = await getFeaturedServices(defaultLocale).catch(() => []);
  const sample = [services[0] ?? fallbackService, services[1] ?? fallbackService, fallbackService];

  return (
    <>
      <PageHeading
        title="Design kit"
        eyebrow="byismayilov"
        lead={<p>Tokens, type, components and ornaments of the public site. Dev only.</p>}
        breadcrumbs={[{ label: "Kit", href: "/_kit" }]}
        breadcrumbLabel={dict.common.breadcrumb}
        ornament={<Ornament name="hair-wave" width={{ base: 200, lg: 300 }} />}
      />
      <div className="container-page pb-section">
        <Block id="kit-colours" title="Colour">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {colors.map(([name, role]) => (
              <li key={name} className="flex flex-col gap-2 text-small">
                <span
                  className="block aspect-[4/3] rounded-lg border border-line"
                  style={{ background: `var(--color-${name})` }}
                />
                <span className="font-semibold">{name}</span>
                <span className="text-ink-muted">
                  <TokenValue name={`--color-${name}`} /> {role}
                </span>
              </li>
            ))}
          </ul>
          <div className="hero-field rounded-card mt-10 h-48 overflow-clip" />
        </Block>

        <Block id="kit-type" title="Type">
          <ul className="flex flex-col gap-6">
            {type.map(([token, sample, extra]) => (
              <li key={token} className="grid gap-2 md:grid-cols-[10rem_1fr] md:items-baseline">
                <span className="text-micro text-ink-muted">{token}</span>
                <span className={`${token} ${extra} text-safe`}>{sample}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block id="kit-brand" title="Wordmark and mark">
          <div className="flex flex-wrap items-center gap-10">
            <Wordmark name="byismayilov" />
            <span className="rounded-card bg-dark text-champagne px-6 py-4">
              <Wordmark name="byismayilov" />
            </span>
            <BrandMark className="text-caramel size-12" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={48} height={48} className="rounded-md" />
          </div>
        </Block>

        <Block id="kit-buttons" title="Buttons and links">
          <div className="flex flex-wrap items-center gap-4">
            <a href="#kit-buttons" className={button()}>
              Onlayn qeydiyyat
              <ArrowRightIcon size={20} className={buttonArrow} />
            </a>
            <a href="#kit-buttons" className={button({ variant: "outline" })}>
              Bütün xidmətlər
            </a>
            <a href="#kit-buttons" className={button({ size: "sm" })}>
              Kiçik
            </a>
            <a href="#kit-buttons" className={textLink()}>
              Xidmətlər
            </a>
            <button type="button" className={arrowControl({ tone: "soft" })} aria-label="Əvvəlki">
              <ArrowLeftIcon size={20} />
            </button>
            <button type="button" className={arrowControl({ tone: "ink" })} aria-label="Növbəti">
              <ArrowRightIcon size={20} />
            </button>
            <button type="button" className={roundButton({ tone: "outline" })} aria-label="Zəng">
              <CallIcon size={20} />
            </button>
          </div>
          <div className="rounded-card bg-dark mt-6 flex flex-wrap items-center gap-4 p-8">
            <a href="#kit-buttons" className={button({ variant: "light" })}>
              Onlayn qeydiyyat
              <ArrowRightIcon size={20} className={buttonArrow} />
            </a>
            <a href="#kit-buttons" className={button({ variant: "ghost" })}>
              Ghost
            </a>
            <a href="#kit-buttons" className={textLink({ tone: "light" })}>
              Xidmətlər
            </a>
            <button type="button" className={roundButton({ tone: "light" })} aria-label="Menyu">
              <ArrowRightIcon size={20} />
            </button>
          </div>
        </Block>

        <Block id="kit-chips" title="Chips">
          <div className="flex flex-wrap items-center gap-3">
            <span className={chip({ tone: "white" })}>Razılaşma ilə</span>
            <span className={chip({ tone: "soft" })}>90 dəq</span>
            <span className={chip({ tone: "ink" })}>Yeni</span>
            <span className={chip({ tone: "outline" })}>Saç kəsimi</span>
          </div>
          <div className="hero-field rounded-card relative mt-6 flex h-40 items-center gap-6 overflow-clip px-10">
            <span className="glass-chip" style={{ position: "relative", rotate: "-8deg" }}>
              Natural Looking Coloring
            </span>
            <span className="glass-chip" style={{ position: "relative", rotate: "6deg" }}>
              Fresh Hair Cutting
            </span>
          </div>
        </Block>

        <Block id="kit-cards" title="Cards">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sample.map((service, index) => (
              <li key={`${service.id}-${index}`}>
                <ServiceCard
                  service={service}
                  locale={defaultLocale}
                  dict={dict}
                  accent={index === 1}
                />
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <div className={`${card({ tone: "soft" })} p-6`}>card soft</div>
            <div className={`${card({ tone: "blush" })} p-6`}>card blush (one per row)</div>
            <div className={`${card({ tone: "white" })} p-6`}>card white</div>
          </div>
          <div className="mt-10">
            <ReviewRail
              id="kit-reviews"
              dict={dict}
              reviews={[
                {
                  id: "a",
                  authorName: "[Müştəri adı]",
                  body: "[Rəy mətni]",
                  rating: null,
                  photo: null,
                  sourceUrl: null,
                },
                {
                  id: "b",
                  authorName: "[Müştəri adı]",
                  body: "[Rəy mətni]",
                  rating: 5,
                  photo: null,
                  sourceUrl: null,
                },
              ]}
            />
          </div>
        </Block>

        <Block id="kit-section-head" title="Section head">
          <SectionHead
            id="kit-section-head-demo"
            title="Xidmətlər və qiymətlər"
            ornament={
              <Ornament
                name="hair-strand"
                width={{ base: 96, lg: 140 }}
                ink={1.2}
                className="text-caramel-ink"
              />
            }
            body={<p>{dict.home.servicesBody}</p>}
            aside={
              <div className="flex gap-3">
                <span className={arrowControl({ tone: "soft" })}>
                  <ArrowLeftIcon size={20} />
                </span>
                <span className={arrowControl({ tone: "ink" })}>
                  <ArrowRightIcon size={20} />
                </span>
              </div>
            }
          />
        </Block>

        <Block id="kit-forms" title="Form controls">
          <form className="grid max-w-3xl gap-6 sm:grid-cols-2" action="#kit-forms">
            <label className="flex flex-col">
              <span className={fieldLabel}>Ad, soyad *</span>
              <input className={fieldControl} placeholder="Ad, soyad" />
            </label>
            <label className="flex flex-col">
              <span className={fieldLabel}>Telefon *</span>
              <input className={fieldControl} aria-invalid defaultValue="050" />
              <span className="text-danger mt-2 text-small">{dict.booking.errorPhone}</span>
            </label>
            <label className="flex flex-col">
              <span className={fieldLabel}>Usta</span>
              <select className={selectControl} defaultValue="">
                <option value="">Fərq etməz</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className={fieldLabel}>Tarix</span>
              <input type="date" className={fieldControl} />
            </label>
            <fieldset className="sm:col-span-2">
              <legend className={fieldLabel}>Xidmətlər</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className={choiceChip}>
                  <input type="checkbox" className={choiceInput} defaultChecked />
                  [Xidmət adı 1]
                </label>
                <label className={choiceChip}>
                  <input type="checkbox" className={choiceInput} />
                  [Xidmət adı 2]
                </label>
              </div>
            </fieldset>
            <label className="flex flex-col sm:col-span-2">
              <span className={fieldLabel}>Mesaj</span>
              <textarea className={textareaControl} placeholder={dict.booking.messagePlaceholder} />
            </label>
            <div>
              <button type="button" className={button()}>
                {dict.booking.submit}
              </button>
            </div>
          </form>
        </Block>

        <Block id="kit-ornaments" title="Ornaments">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ornaments.map((item) => (
              <li key={item.name} className={`${card({ tone: "cream" })} flex flex-col gap-6 p-6`}>
                <div className="text-ink flex min-h-48 items-center justify-center">
                  <Ornament name={item.name} width={{ base: item.width }} reveal="draw" />
                </div>
                <p className="text-small">
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-ink-muted block">{item.place}</span>
                </p>
              </li>
            ))}
            <li className="rounded-card bg-dark text-on-dark-muted flex flex-col gap-6 overflow-clip p-6">
              <div className="relative flex min-h-48 items-center justify-end">
                <MaskOrnament
                  name="eucalyptus"
                  width={{ base: 260 }}
                  className="text-champagne opacity-40"
                />
              </div>
              <p className="text-small">
                <span className="font-semibold text-white">eucalyptus</span>
                <span className="block">Footer top edge (done), mask + fade and rise</span>
              </p>
            </li>
            <li className="rounded-card bg-dark text-on-dark-muted relative flex min-h-72 flex-col justify-end gap-6 overflow-clip p-6">
              <Glow name="wide-dark" className="-top-10 -right-20 w-[130%]" />
              <p className="relative text-small">
                <span className="font-semibold text-white">glow-wide-dark</span>
                <span className="block">Booking band (done), the only ambient float</span>
              </p>
            </li>
            <li className="rounded-card bg-cream relative flex min-h-72 flex-col justify-end gap-6 overflow-clip p-6">
              <Glow name="orb-light" className="-top-16 -right-10 w-[90%]" />
              <p className="relative text-small">
                <span className="font-semibold">glow-orb-light</span>
                <span className="text-ink-muted block">/qeydiyyat form card edge (page agent)</span>
              </p>
            </li>
          </ul>
        </Block>

        <Block id="kit-band" title="Booking band">
          <BookingBand
            id="kit-band-demo"
            title={dict.home.bookingTitle}
            body={dict.home.bookingBody}
            primary={{ label: dict.common.bookOnline, href: "/qeydiyyat" }}
          />
        </Block>

        <Block id="kit-empty" title="Empty state">
          <EmptyState
            title={dict.gallery.empty}
            actions={[
              { label: dict.common.allServices, href: "/xidmetler" },
              { label: dict.common.bookOnline, href: "/qeydiyyat" },
            ]}
          />
        </Block>
      </div>
    </>
  );
}
