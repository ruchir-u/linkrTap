# LinkrTap

LinkrTap gives each local business one QR code that opens a mobile-optimized
profile page (reviews, WhatsApp, Instagram, menu, website, directions,
calling), with scan/click analytics tracked behind the scenes. There's no
self-serve signup — you (the admin) create and manage every business through
a password-gated dashboard. Businesses just get a QR code and a link.

## Public surface (no login)

- `/<slug>` — a business's public page. Anyone can view it.
- `/api/scan/<slug>` — the canonical tracked entry point. The QR code, and
  any link you hand out (Instagram bio, WhatsApp, etc.), should always point
  here, not directly at `/<slug>`. It logs the visit, then redirects.
- `/api/click/<slug>/<action>` — every action button on the public page
  routes through here first, logs the click, then redirects to the real
  destination.

## Admin surface (password-gated)

- `/admin` — dashboard: every published business with quick stats.
- `/admin/editor` — create a business, or `/admin/editor?slug=<slug>` to
  edit an existing one. Shows a live preview, the QR code, the trackable
  share link, and that business's analytics.
- `/admin/login` — the only public page under `/admin`.

Auth is a single shared password (`ADMIN_PASSWORD`), checked in
`middleware.js`, which gates `/admin/*` and the admin-only API routes
(`/api/save`, `/api/analytics/*`, `/api/business/*`, `/api/admin/*`).
Visiting `/` redirects to `/admin`.

## Architecture

- `styles.css` — shared styling for both admin and public pages.
- `admin/` — static admin UI: `index.html` (dashboard) + `dashboard.js`,
  `editor.html` + `editor.js`, `login.html`, `dashboard.css`.
- `middleware.js` — the auth gate. Runs before routing; redirects
  unauthenticated page requests to `/admin/login` and returns 401 for
  unauthenticated admin API calls.
- `api/admin-login.js` / `api/admin-logout.js` — set/clear the auth cookie.
  These two stay public on purpose (the login page has to be reachable).
- `api/save.js` — `POST`, validates and saves a business record to Redis.
- `api/business/[slug].js` — `GET` a single business record as JSON.
- `api/admin/businesses.js` — `GET` all published businesses with quick
  stats, for the dashboard.
- `api/page/[slug].js` — server-rendered public business page.
- `api/scan/[slug].js` — canonical tracked entry point (see above).
- `api/click/[slug]/[action].js` — click-tracking redirect (see above).
- `api/analytics/[slug].js` — `GET` the full analytics summary for a
  business.
- `api/_lib/tracking.js` — shared helpers (IP hashing, referrer→source
  classification, device detection, rate limiting). Files starting with
  `_` aren't treated as routes by Vercel.
- `vercel.json` — redirects `/` to `/admin`; rewrites the admin static
  pages and `/:slug` → `/api/page/:slug` for clean public URLs.

## Analytics data model

All counters live in Redis, incremented atomically on each request:

- `stats:{slug}:visits:total` / `:daily:{date}` — total and daily visit
  counts (a "visit" is any hit to `/api/scan/<slug>`, whether it came from
  a QR scan or a shared link).
- `stats:{slug}:visits:bySource:{source}` — visits broken down by referrer:
  `direct` (QR scans and typed/bookmarked URLs have no referrer), or
  `instagram` / `whatsapp` / `facebook` / `google` / `twitter` / `other`
  when the visit came from clicking a link on one of those platforms.
- `stats:{slug}:devices:{device}` — visits by device type (`mobile` /
  `tablet` / `desktop` / `unknown` / `bot`).
- `stats:{slug}:uniques:{date}` — a Redis set of hashed IPs per day, used
  to compute unique visitor counts without storing raw IPs.
- `stats:{slug}:lastVisit` — ISO timestamp of the most recent visit.
- `stats:{slug}:clicks:{action}:total` / `:daily:{date}` — click counts per
  action button and per day.

**Integrity measures**, since this data gets sold to clients:
- Rate limiting: repeat hits from the same IP within a short cooldown
  (30s for visits, 10s for clicks on the same action) aren't double-counted.
- Bot filtering: requests with a bot-like User-Agent (curl, crawlers, etc.)
  aren't counted at all.
- Unique visitor counts are deduplicated by hashed IP per day, so
  refresh-spamming doesn't inflate the numbers as much as raw hit counts.

Hit `/api/analytics/<slug>` (while logged in) to see it all assembled into
one JSON response.

## QR operations

Each published business has a permanent QR ID (for example `qr-001`). The
printed QR points to `/api/scan/qr-001`, while the QR ID maps to the currently
assigned business. You can therefore rename a business without reprinting its
sticker, or reassign the QR ID to a new business; its former business is
archived automatically. The dashboard flags active QRs that have not been
scanned recently and lets you disable, reactivate, or archive a business.

Daily scan, unique-visitor, and click keys use `Asia/Kolkata` dates and expire
after 90 days. Lifetime totals remain available. When sharing a link digitally,
append `?src=whatsapp`, `?src=instagram`, `?src=google`, `?src=facebook`, or
`?src=twitter` to record its source explicitly; this takes precedence over the
browser referrer.

## Deploying

1. `vercel link` (or `vercel` interactively) to create/connect the project.
2. In the Vercel dashboard: Storage → Marketplace Database Providers →
   **Upstash** → Create → choose Redis, and connect it to this project.
   This sets `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
   automatically.
3. In Vercel → Settings → Environment Variables, add `ADMIN_PASSWORD`
   yourself (this one isn't auto-set by anything).
4. For local dev: `vercel env pull .env.local`, then `vercel dev`.
5. `vercel --prod` to deploy.

## Known gaps

- Logo image upload is local-preview only (a `blob:` URL) — it never
  reaches the server, so published pages fall back to initials. Needs real
  image hosting (e.g. Vercel Blob).
- No delete flow for businesses yet — `/api/admin/businesses` lists them,
  but there's no way to remove one.
- No client-facing report view — analytics are for you, viewed in
  `/admin/editor`. A shareable read-only report per business would be a
  separate, later feature if you ever want to hand a client their own
  numbers directly.

## Product Direction

LinkrTap is an admin-managed tool: businesses share their info with you (or
you pull it from their existing online presence), you publish their page,
and they get a QR code back. No client accounts, no billing, no self-serve
onboarding — all analytics stay with you to review or sell as reports.
