# LinkrTap

LinkrTap is a webpage-based MVP for a local business digital presence service.

The first version is intentionally simple:

- Edit business details from a form
- Add a PNG/JPEG logo image or fallback initials
- Preview the mobile customer page
- Show customer action buttons
- Generate a QR preview for the business page URL
- Download the current QR as a PNG
- Publish the business to a real, persisted public page

Open `index.html` in a browser for editor-only, offline use (publishing requires the Vercel deployment below).

## Architecture

- `index.html` / `styles.css` / `app.js` — the editor + live preview, served as static files.
- `api/save.js` — `POST` endpoint that validates and saves a business record to Vercel KV, keyed by slug.
- `api/business/[slug].js` — `GET` endpoint returning a business record as JSON.
- `api/page/[slug].js` — server-rendered public business page. This is what the QR code actually points to once published.
- `vercel.json` — rewrites `/:slug` to `/api/page/:slug` so published pages get clean URLs.

## Deploying

1. `vercel link` (or `vercel` interactively) to create/connect the project.
2. In the Vercel dashboard: Storage → Marketplace Database Providers → **Upstash** → Create → choose Redis, and connect it to this project. This sets the `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` env vars automatically (see `.env.example`). (Vercel's own "KV" product was sunset in Dec 2024 — Upstash is the current standard replacement, same idea.)
3. For local dev: `vercel env pull .env.local`, then `vercel dev`.
4. `vercel --prod` to deploy.

Once deployed, hitting "Publish page" in the editor saves the business and points the QR code at the real `https://<your-domain>/<slug>` URL.

**Known gap:** logo image upload is currently local-preview only (a `blob:` URL) and isn't sent to the server. Real image hosting (e.g. Vercel Blob) is the next step — until then, published pages fall back to initials.

## Product Direction

LinkrTap should become an admin-managed web app where one QR code opens a premium business profile page with reviews, WhatsApp, Instagram, menu, website, directions, calling, analytics, and reports.
