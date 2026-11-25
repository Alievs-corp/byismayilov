# byismayilov design system

The public site of a hair colouring and cutting salon. The look is warm,
luminous and calm: a white and cream base, black type and buttons, and one warm
accent family taken from the salon's own work (balayage in espresso, caramel,
honey and champagne blonde) with a soft blush. Every value below is a token in
`app/globals.css` (`@theme`); never write a raw colour, size, radius, shadow or
duration in a component.

Live reference: `/_kit` (development, or `DESIGN_KIT=1` in production) shows
every token, component and ornament.

## 1. Colour

| Token                            | Hex                               | Use                                                         |
| -------------------------------- | --------------------------------- | ----------------------------------------------------------- |
| `white`                          | `#ffffff`                         | Page background                                             |
| `cream`                          | `#fbf7f2`                         | Alternate sections, menu sheet, page heading, empty states  |
| `soft`                           | `#f4eee7`                         | Card fill, soft arrow control                               |
| `blush`                          | `#f4ddd5`                         | The one tinted accent card in a row                         |
| `champagne`                      | `#ecdcc3`                         | Accent on dark (footer wordmark, ornaments), photo backdrop |
| `honey`                          | `#dca35c`                         | Hero field light, icons on dark                             |
| `caramel`                        | `#b5733b`                         | Brand mark, hero field, large text only                     |
| `caramel-ink`                    | `#8a5226`                         | Accent text, eyebrows and icons on light                    |
| `espresso`                       | `#3b2920`                         | Depth in the hero field, footer and booking band gradients  |
| `ink`                            | `#16110e`                         | Text, primary buttons, menu button                          |
| `ink-muted`                      | `#6b5d53`                         | Secondary text                                              |
| `line`                           | `#e8dfd5`                         | Hairlines                                                   |
| `line-strong`                    | `#8e8075`                         | Form control borders (3:1 against white and cream)          |
| `dark`                           | `#16110e`                         | Footer, booking band                                        |
| `on-dark-muted`                  | `#c8b9ab`                         | Secondary text on dark                                      |
| `accent`                         | `#ecdcc3`                         | Alias of champagne for focus rings on dark                  |
| `accent-ink`                     | `#8a5226`                         | Alias of caramel-ink                                        |
| `danger` / `success` / `warning` | `#b3261e` / `#17703f` / `#8f5a00` | Status text                                                 |

Contrast is enforced by `tests/design-tokens.test.ts`: every text pair at 4.5:1,
large text and UI boundaries at 3:1, and no purple or indigo in the palette.
White text sits only on `ink`, `espresso`, `dark` or the dark lower part of the
hero field. Caramel is never body text.

The hero field (`.hero-field`) is a stack of radial gradients built only from
these tokens (cream top, blush and honey sides, caramel centre, espresso and
caramel-ink at the bottom) plus a faint noise layer, so it reads as
out-of-focus light rather than a flat CSS gradient.

## 2. Type

- **Display**: Noto Serif Display, variable weight 300 to 400, self-hosted in
  `assets/fonts/display-*.woff2`. High contrast with soft terminals. Used for
  `h1` to `h4`, the wordmark, prices in large callouts and quotes. Weight 400
  by default, 300 for the giant ghost wordmark and the footer wordmark.
- **Text**: Mulish, variable weight 300 to 700, `assets/fonts/sans-*.woff2`.
  Clean geometric sans for body, UI, nav and buttons.
- Both are subset to Latin plus Azerbaijani and to Cyrillic, loaded with
  `next/font/local` in `app/fonts.ts` (Latin preloaded, Cyrillic on demand by
  `unicode-range`). Metric-matched fallbacks (`Sans Fallback`, `Display
Fallback`) keep layout shift near zero.
- Coverage check, on the committed files:
  `python scripts/fonts.py check` (needs `fonttools` and `brotli` in a venv).
  Rebuild from the upstream variable fonts with
  `python scripts/fonts.py build <folder with NotoSerifDisplay[wdth,wght].ttf and Mulish[wght].ttf>`.

| Token          | Size (fluid)           | Line height | Use                                    |
| -------------- | ---------------------- | ----------- | -------------------------------------- |
| `text-display` | 4.5rem to 21rem        | 0.85        | Ghost wordmark, 404 numerals           |
| `text-hero`    | 2.5rem to 5.75rem      | 0.98        | Hero headline, uppercase serif         |
| `text-h1`      | 2.75rem to 6.25rem     | 1           | Page titles, master name               |
| `text-h2`      | 2.25rem to 4.5rem      | 1.02        | Section titles, two lines, mixed case  |
| `text-h3`      | 1.625rem to 2.5rem     | 1.1         | Block titles, menu links, address      |
| `text-h4`      | 1.25rem to 1.625rem    | 1.2         | Card titles, quotes                    |
| `text-lead`    | 1.0625rem to 1.25rem   | 1.55        | Intro paragraphs                       |
| `text-base`    | 1rem to 1.0625rem      | 1.65        | Body                                   |
| `text-small`   | 0.875rem to 0.9375rem  | 1.55        | Secondary text, section head paragraph |
| `text-label`   | 0.8125rem, 600, 0.1em  | 1.3         | Uppercase nav, eyebrows, footer heads  |
| `text-button`  | 0.8125rem, 600, 0.06em | 1.2         | Buttons and text links, uppercase      |
| `text-micro`   | 0.75rem, 600           | 1.3         | Price pills, chips                     |

`text-h*` set size only. Use them on `h1` to `h4` (which get the display font in
the base layer) or add `font-display`.

## 3. Space, radius, shadow

- Spacing tokens: `section` (vertical section padding), `gutter` (page side
  padding, 16px at 390), `column` (grid gap), `header` (header height).
  `container-page` is the page container (max 110rem).
- Radius: `xs` 2px, `sm` 6px, `md` 12px (inputs), `lg` 20px (menus), `card`
  20 to 28px fluid (cards, photos, bands), `pill` (buttons, chips). The hero
  photo uses an arch (fully round top), echoing the salon's arched windows and
  mirrors.
- Shadows: `island` (small floating elements), `float` (dropdowns), `stack`.
  Cards have no shadow; depth comes from fills.

## 4. Components

| Component                    | Where                                | Notes                                                                                                                                                                                                                                                                                          |
| ---------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `button()`                   | `components/site/button.ts`          | `filled` black pill (primary on light), `light` white pill with arrow (primary on dark or colour), `outline`, `ghost` (on dark); sizes `sm`, `md`, `lg`. Labels uppercase `text-button`. Primary buttons carry `ArrowRightIcon` with `buttonArrow`.                                            |
| `textLink()`                 | same                                 | Secondary action: uppercase underlined text, `ink` or `light` tone.                                                                                                                                                                                                                            |
| `arrowControl()`             | same                                 | Slider controls: `soft` pill (previous) and `ink` pill (next). `RailControls` wires them to a `.rail`.                                                                                                                                                                                         |
| `roundButton()`              | same                                 | 48px circle; the header menu button is `ink`.                                                                                                                                                                                                                                                  |
| `chip()`                     | same                                 | `white` (price pill on photos), `soft`, `ink`, `outline` (service links).                                                                                                                                                                                                                      |
| `.glass-chip`                | `app/site.css`                       | Frosted, tilted chip on the hero field only, max two, true claims only (the master's own tagline).                                                                                                                                                                                             |
| `card()`                     | same                                 | `soft` default, `blush` for exactly one card per row, `cream`, `white`.                                                                                                                                                                                                                        |
| `Wordmark`, `BrandMark`      | `components/site/wordmark.tsx`       | Name in the display serif with the eight ray sparkle. `SiteLogo` prefers an uploaded logo.                                                                                                                                                                                                     |
| `SectionHead`                | `components/site/section-head.tsx`   | Big serif title left (two lines), optional ornament, short paragraph in the middle, controls or link right.                                                                                                                                                                                    |
| `ServiceCard`, `ServiceRail` | `components/home/service-rail.tsx`   | Photo 4:5, white price pill top left, serif name, duration, round arrow.                                                                                                                                                                                                                       |
| `MasterFeature`              | `components/home/master-feature.tsx` | Photo left, label, name in `text-h1`, role in serif, bio, service chips, booking and Instagram.                                                                                                                                                                                                |
| `WorkMosaic`                 | `components/home/work-mosaic.tsx`    | Five tiles in an asymmetric grid; never a uniform grid.                                                                                                                                                                                                                                        |
| `ReviewRail`                 | `components/home/review-rail.tsx`    | Rendered only when real reviews exist.                                                                                                                                                                                                                                                         |
| `BookingBand`                | `components/home/booking-band.tsx`   | Dark rounded band, glow and hair-wave ornament.                                                                                                                                                                                                                                                |
| `ContactBlock`               | `components/home/contact-block.tsx`  | Address in serif, contact rows, map embed or a map card that opens Google Maps.                                                                                                                                                                                                                |
| `PageHeading`                | `components/site/page-heading.tsx`   | Cream head with breadcrumbs, fitted serif title, lead, optional `ornament` slot (desktop only).                                                                                                                                                                                                |
| Form controls                | `components/site/form-styles.ts`     | `fieldLabel`, `fieldControl`, `selectControl`, `textareaControl`, `choiceChip` + `choiceInput` (pill checkboxes). Focus ring is a honey halo.                                                                                                                                                  |
| `EmptyState`                 | `components/site/empty-state.tsx`    | Cream card with the blossom ornament, serif message, primary button and text links.                                                                                                                                                                                                            |
| `NotFoundView`               | `components/site/not-found-view.tsx` | Blossom, champagne 404 numerals, serif title.                                                                                                                                                                                                                                                  |
| Header and menu              | `components/site/header-bar.tsx`     | Wordmark left, centred uppercase nav (xl+), language, booking pill (lg+), black round menu button. Clear over the hero, solid cream with blur after 24px of scroll (or after the film). Menu: cream sheet with numbered serif links, contacts, language pills and a full width booking button. |
| Footer                       | `components/site/site-footer.tsx`    | Dark, espresso glow, tagline and booking pill, contacts, navigation, socials, eucalyptus edge, champagne wordmark.                                                                                                                                                                             |

## 5. Ornaments

Assets: `assets/ornaments/*.svg` (line art, source for
`components/ornament/paths.ts`, rebuilt with `pnpm ornaments:build`),
`public/ornaments/eucalyptus.svg` (filled, used as a CSS mask) and
`public/ornaments/glow-*.webp` (lossless, toned with the kit's `tone.py`:
`glow-wide-dark` = `#F6E6CC #DCA35C #B5733B`, `glow-orb-light` =
`#E2AE72 #EFC6B4 #F4DDD5` at 0.85 opacity).

- `<Ornament name width={{ base, md?, lg? }} reveal ink? />` renders inline SVG
  in `currentColor`. Stroke width is computed per breakpoint so the line is
  about 1.1px on screen at any size. Colour it with a text class
  (`text-caramel-ink` on light, `text-champagne` on dark).
- `<MaskOrnament name="eucalyptus" />` for the filled footer sprig.
- `<Glow name float? />` for the toned light blobs.

Placement (owner: "not exaggerated"), at most one per section and about five on
the whole site:

| Place                                              | Ornament                                                                     | Status     |
| -------------------------------------------------- | ---------------------------------------------------------------------------- | ---------- |
| Home services section head                         | `hair-strand`, caramel-ink, 96 to 140px                                      | Done       |
| Home booking band                                  | `hair-wave` champagne + `glow-wide-dark` (the one ambient float)             | Done       |
| Footer top edge, every page                        | `eucalyptus` mask, champagne at 38%                                          | Done       |
| Empty states and 404                               | `blossom-spray`, caramel-ink                                                 | Done       |
| `/qeydiyyat` side column, desktop only (>= 1024px) | `magnolia` + `glow-orb-light` behind the form card edge, never behind fields | Page agent |
| `/ustalar` page head                               | `peony` through the `PageHeading` `ornament` slot, 120 to 160px              | Page agent |

Never behind body text, prices or form fields, never in the admin, never
repeated inside card grids, never more than one per section. `sparkle` and
`asterisk` exist only as the brand mark echo.

## 6. Motion

- Reveal: one shared IntersectionObserver (`lib/motion/reveal.ts`) sets
  `data-revealed` once. `[data-reveal]` fades and rises, ornaments use
  `data-ornament`: `draw` (stroke dash, `--motion-ornament` 1.4s), `rise`
  (fade and 14px rise, 1.2s), `twinkle` (scale and rotate, 0.9s), `glow` (fade).
  Easing `--ease-out-soft`.
- Continuous motion: only the booking band glow floats (`--motion-ambient`
  22s, transform only) and it pauses off screen. Lenis smooth scroll and the
  hero film scrub stay as they are.
- `prefers-reduced-motion: reduce`, no script or a short viewport: everything
  renders in its final state, no float.
- Ornaments are absolutely positioned or sit in fixed size cells with an
  aspect ratio, so they never shift layout.

## 7. Performance notes

- The hero photo is the LCP element: `loading="eager"`, `fetchPriority="high"`,
  `quality={60}` (`images.qualities` allows 60 and 75). Do not use the
  deprecated `priority` prop.
- Home sections below the hero carry `defer-render` (`content-visibility:
auto`), so their images and paint wait until they approach the viewport.
- Inline ornaments cost HTML twice (markup and RSC payload). Prefer the small
  line ornaments on shared or heavy pages; large ones (peony, magnolia) only
  on the one page that shows them. Path coordinates are rounded by
  `pnpm ornaments:build`.
- The display font is subset to weights 300 to 400; use 400 for headings.

## 8. Do and don't

Do:

- Vary section rhythm: rail, split, mosaic, band, list. Alternate white and
  cream backgrounds.
- Use real photos cropped to 4:5 or the arch; never stretch.
- Keep one blush card per row and one ornament per section.
- Keep 390px designed: full bleed rails with the gutter as padding, stacked
  hero with the arch photo, 44px touch targets.
- Put facts only from the owner; unknown values stay `[placeholder]`.

Don't (banned looks):

- Purple or indigo, generic SaaS gradients, flat rainbow gradients.
- Glassmorphism beyond the two hero chips.
- Centred-everything sections, a uniform three card grid for every section.
- Spa stones, orchids, faces, lips or cosmetics bottles as decoration.
- Emoji anywhere, filler copy, invented prices, hours, reviews or numbers.
- Decorative animation that loops, carries no information or animates layout
  properties.

## 9. Local screenshots with real photos

`pnpm db:seed:local-media` (local only) uploads the photos in
`LOCAL_MEDIA_DIR` to the local bucket and fills the gallery, the master (only
facts from the salon's Instagram), covers for the placeholder services and the
public contacts. It hides the `[placeholder]` demo masters and reviews (pass
`--keep-placeholders` to keep them). The photos are client media and are never
committed.
