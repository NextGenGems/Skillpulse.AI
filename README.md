# SkillPulse (rebuild MVP)

Next.js 15 + TypeScript + Tailwind + Prisma (SQLite locally; Turso/libSQL in production).
Owner: Jake Sumner. Purpose: skill_gap_courses_sales_only.
Base44 stays live until convert.

## Local setup

```bash
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Open http://localhost:3000

Local DB uses file SQLite: `DATABASE_URL="file:./dev.db"`. Leave `TURSO_AUTH_TOKEN` empty.

Admin defaults for local only: `ADMIN_PASSWORD=changeme` (or unset -> `changeme`),
`ADMIN_SESSION_SECRET` may use the documented dev fallback. **Production refuses these.**


## Env

See `.env.example`:

- `DATABASE_URL` — local `file:./dev.db`; production Turso `libsql://...`
- `TURSO_AUTH_TOKEN` — required with Turso URL on Vercel
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` (strong, unique in production; secret >=32 chars)
- `AI_API_KEY` — empty for MVP ($0 OpEx)
- `NEXT_PUBLIC_APP_URL` — e.g. `https://your-app.vercel.app`

## Scripts

- npm run build
- npm run db:push / db:seed / db:setup

## Vercel Hobby + Turso (free)

1. Create a Turso DB (CLI or dashboard).
2. Set DATABASE_URL=libsql://... and TURSO_AUTH_TOKEN in Vercel.
3. Set strong ADMIN_PASSWORD and ADMIN_SESSION_SECRET (>=32 chars).
4. Set Stripe keys and NEXT_PUBLIC_APP_URL.
5. Apply schema to Turso, then seed once.
6. Point Stripe webhook at /api/stripe/webhook

**Production safety**

- No Stripe keys => checkout 503; no demo enroll in production.
- Weak ADMIN_PASSWORD / ADMIN_SESSION_SECRET hard-fail in production.
- Kill switch pauses enroll; future PromoJobs must no-op when paused.

## Kill switch

Admin toggles OwnerSettings.killSwitchPaused (hides/disables Enroll).
Future promo automation must respect the same flag.

## Seed course

Writing Prompts That Survive Contact With Users — 3x3 lessons, quizzes, capstone, final (~82 min).

## Phase B (light)

SEO sitemap/robots + course OG meta ship with MVP. PromoJob is a schema stub only.
See docs/phase-b-promotions.md.

Push target (CoS): https://github.com/NextGenGems/Skillpulse.AI
Framing: automated course business owned by Jake Sumner (not sentient). Zero OpEx.
Learn UI is section-based under /learn/[slug]; nested paths redirect into sections.
