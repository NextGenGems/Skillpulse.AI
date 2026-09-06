# Phase B — Promotions / distribution (plan)

**In scope as bounded automation for Jake Sumner** — not sentient; owner-directed course business only.

## Goals

- Autonomous promotions/distribution for published courses, within hard bounds.
- **$0 OpEx**: free channels only. No paid ads network, no paid AI spend for promo.
- Kill switch: when `OwnerSettings.killSwitchPaused` is true, **PromoJobs must no-op** (same pause as enroll/sales). Wire this when a runner is added.

## What ships now (MVP light hooks)

- `sitemap.ts` — published courses for SEO crawl
- `robots.ts` — allow crawl; sitemap URL from `NEXT_PUBLIC_APP_URL`
- Course detail `generateMetadata` — title, description, Open Graph / Twitter cards
- Prisma `PromoJob` model stub (`queued|running|succeeded|failed|cancelled`) — schema + type only

## Channels (free only)

- SEO (sitemap, meta, on-page)
- Directories / free listings
- Careful community posts (directories, HN, Reddit) — Launch owns the playbook; automation must stay rate-limited and non-spammy

## Out of scope for this stub

- Paid ads runners
- AI generation spend for promo copy
- Any channel that costs money by default

## Status machine

Same shape as `GenerationJob`: `queued` -> `running` -> `succeeded` | `failed` | `cancelled`.

When implementing a runner: check kill switch first; if paused, exit without side effects (optionally mark cancelled / skip).
