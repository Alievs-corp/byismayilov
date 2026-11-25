---
name: byismayilov-design
description: Use for any public UI work in the byismayilov salon site (pages under app/[locale], components/site, components/home, ornaments, header, footer, forms, empty states). Gives the tokens, components, ornament placement and motion rules to follow, and the checks to run before a UI pull request.
---

# byismayilov design

Read `docs/DESIGN.md` first; it is the source of truth. Open `/_kit` on the dev
server (port 3030) to see every token and component rendered.

## Rules

1. **Tokens only.** Colours, sizes, radii, shadows, durations come from
   `app/globals.css`. If something is missing, add a token there and to
   `docs/DESIGN.md`, never a raw value in a component.
2. **Reuse before inventing.** Buttons and links: `button()`, `textLink()`,
   `arrowControl()`, `roundButton()`, `chip()`, `card()` from
   `components/site/button.ts`. Section heads: `SectionHead`. Page tops:
   `PageHeading` (it has an `ornament` slot). Rails: `.rail` + `RailControls`.
   Forms: `components/site/form-styles.ts`. Empty: `EmptyState`.
3. **Type.** Headings are the display serif (`h1` to `h4` or `font-display`),
   mixed case for titles, uppercase serif only in the hero. UI labels, nav,
   buttons are uppercase Mulish (`text-label`, `text-button`).
4. **Colour use.** White and cream backgrounds, ink text and primary buttons,
   caramel-ink for accent text and icons, one blush card per row, dark only for
   the footer and the booking band. White text only on ink, espresso, dark or
   the dark part of the hero field.
5. **Ornaments.** At most one per section, ten places on the whole site,
   never behind text, prices or fields, never in card grids, never in the
   admin. Placed: home services head (hair-strand), booking band (hair-wave +
   glow), footer (eucalyptus), empty states and 404 (blossom-spray),
   `/qeydiyyat` side (magnolia + glow), page heads of `/ustalar` (peony),
   `/xidmetler` (hair-wave), `/islerimiz` (hair-strand), `/elaqe`
   (eucalyptus-line), blog post end (blossom-spray). Do not add others without
   removing one.
6. **Motion.** One-shot reveals from the vocabulary in `docs/DESIGN.md`
   section 6: `data-reveal` (rise), `side` (rails), `scale` (bands, map
   cards), `clip` (photos), `rule` (list rows), `LineReveal` (section titles),
   stagger with `data-reveal-group`. Vary them by section; do not fade
   everything the same way. Transform, scale and opacity only, 0.5 to 1.2s,
   ease-out; no new loops; reduced motion shows the final state; nothing in
   the first viewport waits for JavaScript.
7. **Rhythm.** Not every section a grid of three. Mix rail, split, mosaic,
   list and band; alternate white and cream.
8. **Facts.** Never invent prices, hours, reviews, names or numbers. Missing
   data is a `[placeholder]` or an admin field. Public copy is Azerbaijani with
   `ru` and `en` in `lib/i18n/dictionaries`.
9. **Icons.** Iconsax Linear from `components/icons/iconsax.tsx` on the public
   site; no emoji.

## Before the pull request

```bash
pnpm lint && pnpm typecheck && pnpm test
DATABASE_URL= pnpm build
pnpm db:seed:local-media        # local only, real photos for screenshots
```

- Screenshots at 390 and 1440 (and 768, 1024 for layout changes) of every
  touched page, light theme. Look at them against `/_kit` and fix.
- No horizontal overflow at 390; touch targets 44px.
- New colour pairs added to `tests/design-tokens.test.ts`.
- New fonts or glyph needs: `python scripts/fonts.py check`.
- Lighthouse on the local production build within the `CLAUDE.md` budget.
