# Contributing to byismayilov

byismayilov is a beauty salon in Azerbaijan (Instagram `byismayilov22`). This
repository is its website and admin panel: services with prices and durations
grouped by category, the masters, a gallery of work, a blog, contact details and
online booking requests that land in the admin inbox. There is no shop, no cart
and no slot engine; the salon confirms every booking itself.

It is a Next.js App Router application with a full admin panel for every
public page and section, and a scroll-scrubbed hero film on the home page.

Rules for anyone, human or agent, working in this repository. They are not
suggestions. A change that violates them is rejected in review even if the code
is otherwise correct.

---

## 1. Stack

| Layer        | Choice                                                                              |
| ------------ | ----------------------------------------------------------------------------------- |
| Framework    | Next.js (App Router, latest stable), TypeScript strict; Next.js is also the backend |
| Styling      | Tailwind CSS v4, tokens in `app/globals.css`, design rules in `docs/DESIGN.md`      |
| UI kit       | shadcn/ui (admin), Iconsax Linear (public site), lucide-react (admin)               |
| State / data | Redux Toolkit + RTK Query (admin panel, client-side forms)                          |
| Database     | PostgreSQL + Drizzle ORM, migrations in `drizzle/`                                  |
| Auth         | Better Auth (email + password, admin roles)                                         |
| Media        | S3-compatible object storage (Hetzner), served through `next/image` and `/media/*`  |
| i18n         | `az` (default, no prefix), `ru`, `en` on the public site and in the admin           |
| Validation   | zod, shared between route handlers and forms                                        |
| Tests        | Vitest (unit and integration against compose services), Playwright (end-to-end)     |
| Hosting      | Docker (`output: "standalone"`) on Coolify, Hetzner server                          |

Public pages are Server Components that read the database directly, so HTML
arrives complete for search engines and generative engines. RTK Query is for the
admin panel. The public booking form is the only client form on the public site;
it posts to `/api/booking-requests`. Do not fetch public page data through RTK
Query.

Content is entered per language; media is not. Every image, video and hero film
is uploaded once and referenced by every locale. Only alt texts and captions are
translated.

---

## 2. Git workflow

Repository: `Alievs-corp/byismayilov` on GitHub (public). Use it in every `gh`
command (`-R Alievs-corp/byismayilov`).

**Every task follows this sequence. No exceptions.**

```bash
# 1. Start from an up-to-date main, in your own worktree. Never commit to main.
git fetch origin
git worktree add /c/dev/byismayilov-wt/<name> -b <type>/<short-description> origin/main

# 2. Work, committing in logical units.

# 3. Push and open a pull request.
git push -u origin <branch>
gh pr create -R Alievs-corp/byismayilov --base main --title "..." --body-file <file>

# 4. Merge only when CI is green, then remove the worktree.
```

Do not use `git stash`: the stash is shared by every worktree of the repository.
Verify a push with `git ls-remote origin <branch>` against your local sha.

The repository is public. Never commit `.env`, a real secret, a customer's
personal data or a real booking. `.env.example` holds only obvious local
placeholders.

### Branch naming

`<type>/<kebab-case-description>`, under about fifty characters.

| Type        | Use for                                |
| ----------- | -------------------------------------- |
| `feat/`     | New capability                         |
| `fix/`      | Bug fix                                |
| `chore/`    | Tooling, config, dependencies          |
| `docs/`     | Documentation only                     |
| `refactor/` | Restructuring with no behaviour change |
| `perf/`     | Performance work                       |
| `test/`     | Test coverage                          |

Good: `feat/booking-reminders`, `fix/hero-film-scrub`
Bad: `new-stuff`, `ismet-branch`, `fix2`, `patch-1`

### Commits

Conventional Commits, in English:

```
<type>(<scope>): <subject in the imperative>

<body: what changed and why, wrapped at 72 columns>
```

- **English only** in commits, pull requests, code and documentation. User
  facing copy is Azerbaijani, plus `ru` and `en` translations
- Imperative subject: "add", not "added" or "adds"; no period at the end
- Explain **why** in the body. What changed is visible in the diff
- Never use `--no-verify`. If a hook fails, fix the cause
- Long commit or pull request bodies go into a file (`-F file`, `--body-file`),
  never a long heredoc
- No `Co-Authored-By` trailer for AI agents in commit or squash-merge messages;
  agent pull request bodies end with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

### Pull requests

Every pull request must:

1. Link its issue when there is one: `Closes #123`, or `Part of #123`
2. Pass CI
3. Describe what was verified, with the commands that were run, and
   screenshots at 390 px and 1440 px for any UI change

State what you did **not** do, and why. A pull request that hides a gap is
worse than one that names it.

### Merging

- Merge only when CI is green. A red pipeline is never merged, never bypassed
- Squash merge (`gh pr merge <n> --squash --delete-branch`), so `main` stays readable
- After the merge, watch the `main` workflow run of the merge commit until it is
  green, then remove the local worktree
- If CI fails, fix the cause. Do not disable the check or skip the test

`CI complete` is the only required check. It always runs, waits for the other
jobs and fails if any job that had work to do did not succeed. A job that should
block a merge goes into `ci-complete`'s `needs` **and** into the list its script
checks.

---

## 3. Design

- The visual system is documented in `docs/DESIGN.md` and the
  `byismayilov-design` skill (`.claude/skills/byismayilov-design`); `/_kit`
  renders every token, component and ornament on the dev server. Do not invent
  a look in a feature pull request
- Never invent a colour, font size, radius, shadow or duration; every value
  exists as a token in `app/globals.css` (`@theme`)
- Fonts are self-hosted from `assets/fonts/` with `next/font/local`. Never
  `next/font/google`, never a font CDN. Every font must cover Azerbaijani
  (ə Ə ğ Ğ ı İ ş Ş ç Ç ö Ö ü Ü) and Cyrillic; check the font files, not a
  specimen page
- **No emojis anywhere**: not in UI, copy, alt text, commits, seed data or
  docs. Icons are Iconsax Linear on the public site, as inline SVG components in
  `components/icons/`, and lucide-react in the admin
- **No AI slop**: no generic SaaS gradients, purple or indigo, glassmorphism
  everywhere, stock spa clichés, centred-everything template sections, uniform
  three-card grids for every section, filler copy, or decorative animation that
  carries no information
- **Never invent facts**: prices, durations, addresses, phone numbers, master
  names, reviews, ratings and numbers come from the owner. Unknown values are
  admin-editable fields or honest placeholders in square brackets
  (`[Xidmət adı]`)
- The home hero is a photoreal film scrubbed by scroll (`hero_films`, see
  section 5). Until the owner's film exists the hero renders a placeholder block
- Perfect at every width from 360 px to 1920 px: no horizontal scroll, touch
  targets at least 44 px, images never stretched; 390 px must feel designed,
  not shrunk

---

## 4. Code standards

- TypeScript strict, no `any`, no `@ts-ignore`
- No explanatory comments. Names carry the meaning; a comment is allowed only
  for a non-obvious constraint (a workaround, a legal requirement)
- Server Components by default; `"use client"` only where interaction needs it
- Every mutation validates input with zod on the server, whatever the client
  already checked. Admin routes check the session and role
- Every translatable field has `az` required, `ru` and `en` optional with `az`
  as fallback (`Localized<T>` and `pickLocale` in `lib/i18n/localized.ts`)
- Images go through `next/image` with explicit `sizes`; never ship an
  unoptimised original to the browser

### Performance and SEO budgets

Checked on every UI pull request, on a production build:

| Metric                             | Budget (mobile, Lighthouse) |
| ---------------------------------- | --------------------------- |
| Performance                        | 93 or more                  |
| SEO, Accessibility, Best Practices | 100                         |
| LCP                                | under 3.5 s                 |
| CLS                                | under 0.05                  |
| First-load JS on public pages      | under 160 KB gzip           |

The JS budget is the framework floor (React and the Next.js router ship about
133 KB gzip on every route before any app code) plus at most 25 KB of our own
code; the scroll-driven hero film is loaded on the home page only. The numbers
above are for a local production build; the live site is measured with
PageSpeed Insights after deploy, where the target is LCP under 2.5 s. Measure on
AC power with nothing else building; a Lighthouse `benchmarkIndex` far below
2300 means the run measured the machine, not the page.

Animations run on the compositor only (`transform`, `opacity`) and respect
`prefers-reduced-motion`.

Every public page has: unique title and description per locale, canonical,
`hreflang` alternates for all three locales plus `x-default`, Open Graph image
where one exists, JSON-LD where it applies (`BeautySalon`, `Service` with
`Offer`, `OfferCatalog`, `BreadcrumbList`, `BlogPosting`, `CollectionPage`), and
is listed in `sitemap.xml` and `llms.txt`. Changed URLs get a 301 through the
`redirects` table.

---

## 5. Commands

Node 24 and pnpm (version pinned in `package.json`). Local ports for this
project (chosen so other local projects can run alongside): dev server 3030, end-to-end server
3031, Postgres 5462, S3 9030 (console 9031), Mailpit 1055 (web UI 8055). The
docker compose project is named `byismayilov`. First run:

```bash
cp .env.example .env            # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
docker compose up -d            # Postgres 17, RustFS (S3) and Mailpit
pnpm install
pnpm db:migrate
pnpm db:seed                    # settings, main menu, draft about page
pnpm db:seed:demo               # optional, local only: [placeholder] categories, services, masters, reviews
pnpm auth:owner --email you@example.com --name "Your Name"   # prints a set-password link
pnpm dev                        # http://localhost:3030/admin
```

| Command                         | What it does                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm dev`                      | Development server (Turbopack) on port 3030                                               |
| `pnpm build`                    | Production build, `output: "standalone"`                                                  |
| `pnpm start`                    | Runs `.next/standalone/server.js` (set `PORT=3030`)                                       |
| `pnpm lint`                     | ESLint, zero warnings allowed                                                             |
| `pnpm typecheck`                | Generates route types, then `tsc --noEmit`                                                |
| `pnpm format` / `format:check`  | Prettier (with the Tailwind class sorter)                                                 |
| `pnpm test`                     | Vitest; needs the database, storage and Mailpit from compose                              |
| `pnpm test:e2e`                 | Playwright against the standalone build on port 3031 (`pnpm build` first)                 |
| `pnpm db:generate`              | Generates a SQL migration in `drizzle/` from `lib/db/schema`                              |
| `pnpm db:migrate`               | Applies pending migrations to `DATABASE_URL`                                              |
| `pnpm db:seed`                  | Idempotent base seed (`lib/db/seed.ts`), safe in production                               |
| `pnpm db:seed:demo`             | Adds `[placeholder]` demo content for local development; refuses to run in production     |
| `pnpm db:studio`                | Drizzle Studio                                                                            |
| `pnpm auth:owner`               | Creates or promotes an owner and prints a set-password link                               |
| `pnpm storage:cors [origin]`    | Lets the browser upload to the bucket from the app origin                                 |
| `pnpm hero:upload`              | Uploads a hero film frame sequence to the bucket and registers it                         |
| `pnpm db:seed:local-media`      | Local only: real salon photos from `LOCAL_MEDIA_DIR` into gallery, master and covers      |
| `pnpm ornaments:build`          | Regenerates `components/ornament/paths.ts` from `assets/ornaments/*.svg`                  |
| `python scripts/fonts.py check` | Verifies Azerbaijani and Cyrillic coverage of the committed font files (fontTools)        |
| `pnpm check:seo`                | `--base <url>`: crawls the built site; fails on SEO and GEO defects (see the launch list) |
| `docker build -t byismayilov .` | Production image; `GET /api/health` answers 200                                           |

Do not run `pnpm build` while your own `pnpm dev` runs in the same folder: both
use `.next`. Stop your dev server by its PID, never every `node.exe`. When the
build must not touch the database (as in CI), run `DATABASE_URL= pnpm build`.

Tests run on an empty, migrated database in CI. A test that needs a settings
row, a menu or another shared record creates it itself. Before pushing a new
test file, run it against a fresh database (`createdb byismayilov_ci`,
migrate, test, drop). The end-to-end suite seeds the base and the placeholder
demo content and creates its own owner account (`e2e/global-setup.ts`).

### Where things live

| Path                              | What                                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `app/[locale]`                    | Public site, one root layout per locale; `az` served without a prefix                                                                   |
| `app/[locale]/xidmetler`          | Services grouped by category with prices (`/xidmetler`) and the service page (`/xidmetler/<slug>`)                                      |
| `app/[locale]/ustalar`            | Masters                                                                                                                                 |
| `app/[locale]/islerimiz`          | Gallery of work                                                                                                                         |
| `app/[locale]/bloq`               | Blog list and posts                                                                                                                     |
| `app/[locale]/elaqe`              | Contact: address, map, phones, WhatsApp, hours                                                                                          |
| `app/[locale]/qeydiyyat`          | Online booking form                                                                                                                     |
| `app/[locale]/[slug]`             | CMS pages                                                                                                                               |
| `proxy.ts`                        | Locale routing, admin guard, redirects table, trailing slashes                                                                          |
| `app/admin`                       | Admin panel (own root layout, the only place the Redux store is mounted)                                                                |
| `app/api/admin/**`                | Admin route handlers, each wrapped in `adminRoute()`                                                                                    |
| `app/api/booking-requests`        | Public booking endpoint (honeypot, rate limit, emails the salon)                                                                        |
| `components/site`                 | Public components                                                                                                                       |
| `components/home`                 | Hero film (player, worker) and home sections                                                                                            |
| `components/admin`                | Admin building blocks (see below)                                                                                                       |
| `components/ui`                   | shadcn/ui primitives                                                                                                                    |
| `components/icons`                | Inline SVG icon components for the public site                                                                                          |
| `lib/public/*`                    | Cached public readers (`"use cache"` + `cacheTag`)                                                                                      |
| `lib/admin/*`                     | Server-side admin services (queries and mutations)                                                                                      |
| `lib/booking-requests`            | Booking submission and the salon notification email                                                                                     |
| `lib/validation/*`                | zod schemas and DTO types shared by forms and route handlers                                                                            |
| `lib/api/*`                       | RTK Query endpoints on `baseApi`; `lib/api/server.ts` has `adminRoute`                                                                  |
| `lib/i18n`                        | Locales, `localePath`, `pickLocale`, public dictionaries (`dictionaries/*.json`)                                                        |
| `lib/admin/i18n`                  | Admin interface translations: Azerbaijani text is the key, `ru`/`en` per module                                                         |
| `lib/db/schema`                   | Drizzle schema; `lib/db/seed.ts` the seed and the placeholder demo content                                                              |
| `lib/cache`                       | Cache tags (`tags.ts`) and `revalidatePublic()`                                                                                         |
| `lib/seo`                         | Metadata, JSON-LD, sitemap, robots, `llms` files, Markdown alternates, OG cards, fact blocks, IndexNow (`docs/seo-launch-checklist.md`) |
| `lib/env.ts`, `lib/env.server.ts` | Validated environment                                                                                                                   |
| `e2e`                             | Playwright end-to-end tests                                                                                                             |

Data model (one table per row): `service_categories` (nested, translatable name,
slug, description, image, SEO), `services` (translatable name, slug, short and
long rich text, `price_kind` `from` / `exact` / `on_request`, `price_amount` in
AZN, `duration_minutes`, featured flag, status, soft delete, SEO),
`service_category_links`, `service_images` (gallery, the first one is the
cover), `masters` (name, role, bio, photo, Instagram link) and
`master_services`, `gallery_items` (image or video, optional before image,
caption, category, master), `reviews` (author, text, optional rating and
photo), `booking_requests` (name, phone, preferred date, time window, master,
message, status `new` / `confirmed` / `done` / `cancelled`, admin note,
`seen_at` for the unread badge) and `booking_request_services`, `posts`,
`pages`, `menus`, `menu_items`, `hero_films`, `settings` (singleton: contacts,
socials, opening hours, price range, geo, booking notification inbox, SEO
defaults, the home `hero` and `home_sections`), `redirects`, `media`,
`site_visits` and the Better Auth tables.

Bookings: a visitor's request is stored with name snapshots of the chosen
services and master, then the salon gets an email
(`settings.booking_notify_email`, else `BOOKING_NOTIFY_EMAIL`); a mail failure
never loses the request. The admin inbox (`/admin/bookings`) lists the newest
first, filters by status, unread and preferred date, and the sidebar shows the
unread count. Opening a request marks it seen.

Hero films are frame sequences stored once in the bucket under
`hero_films.key_prefix`, named `0001.webp`, `0002.webp`, … (see
`heroFilmFrameKey` in `lib/validation/hero-films.ts`). The home hero record in
`settings.hero` points to one film by id; `getHero()` in `lib/public/home.ts`
returns the frame URL pattern, count, size and poster.

Admin: `lib/auth` is Better Auth (roles `owner` and `editor`, no public sign
up). `proxy.ts` turns away requests to `/admin/*` and `/api/admin/*` without a
session cookie; every admin page calls `requireAdminUser()` and every route
handler under `app/api/admin` is wrapped in `adminRoute()` (pass
`{ role: "owner" }` for owner-only work). `tests/admin-access.test.ts` imports
every `app/api/admin/**/route.ts` and fails if one answers an anonymous or
forged request with anything but 401. Shared admin building blocks live in
`components/admin` (data table, form fields, confirm dialog, image and media
pickers, media upload, locale tabs, rich text editor, sortable lists, SEO
fields); the sidebar entries are in `lib/admin/navigation.ts`. The admin
interface language is the language switch in the header; it is saved per user
(`users.admin_locale`) and also sets the default tab of the language tabs.
Settings, redirects, site texts and users are owner-only (routes, pages and
sidebar). Ready-made public texts (the dictionaries in `lib/i18n/dictionaries`)
are editable per language under Site texts (`settings.text_overrides`, merged in
`getDictionary`). Every Azerbaijani string in the admin must be a key in
`lib/admin/i18n/messages/*` with `ru` and `en` values;
`tests/admin-i18n-coverage.test.ts` enforces it.

Cache Components is on (`cacheComponents: true`). Public pages read the
database inside `"use cache"` functions, and every component that does starts
with `await connection()` so the build never touches the database. The public
layout (`app/[locale]/layout.tsx`) sets `export const instant = false`: public
pages render in one pass at request time, without a static shell or
`<Suspense>` around the page content, so the HTML arrives complete. Admin and
any other segment that keeps a static shell must put cookies, headers and
uncached reads inside `<Suspense>`.

Admin mutations call `revalidatePublic()` from `lib/cache/revalidate.ts`, which
expires the tags in `lib/cache/tags.ts` (`catalog` for services, categories and
media alt text; `content` for pages, posts, masters, gallery and reviews;
`menus`; `settings` for settings, home sections and hero films). Every cached
public read must call `cacheTag()` with the matching tag, or edits in the admin
will not reach the site. A command line script that writes public data
(`db:seed`, `hero:upload`) runs outside the server process, so it ends with
`requestPublicRevalidation()` from `lib/cache/remote-revalidate.ts`: a
`POST /api/revalidate` to `BETTER_AUTH_URL`, signed with a token derived from
`BETTER_AUTH_SECRET`, which expires every public tag and reloads the redirect
map. When the site is not reachable the script says so and nothing else
changes. Media uploads go straight from the browser to the bucket through a
presigned URL, so the bucket needs a CORS rule for the app origin
(`pnpm storage:cors`).

Changed URLs live in the `redirects` table (admin: `/admin/redirects`).
`proxy.ts` answers them with one hop from an in-memory map
(`lib/redirects/legacy.ts`, refreshed every 60 s and right after an admin
change), and it also removes trailing slashes.

---

## 6. Working with issues

- One issue, one branch, one pull request
- Leftover work found along the way is finished in the same pull request, not
  moved to a follow-up issue
- Issues labelled `status: needs-decision` wait for an answer from the salon
  owner. Do not implement around them

---

## 7. For agents

- Read `docs/DESIGN.md` (and the `byismayilov-design` skill when it exists)
  before any UI work
- Never commit to `main`; work in your own worktree under
  `C:\dev\byismayilov-wt\<name>` and never touch another agent's worktree
- Never claim something works without running it. "Build passes" means you ran
  the build and saw it pass; "responsive" means you looked at 390, 768, 1024 and
  1440 px screenshots
- Report what failed as plainly as what succeeded
- Real salon facts come from the owner (brief folder
  `C:\dev\byismayilov-brief\`); anything missing is listed for the owner, never
  guessed
- When a rule here conflicts with a habit, the rule wins

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
