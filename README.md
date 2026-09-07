# SkillPulse (rebuild MVP)

Next.js 15 + TypeScript + Tailwind + Prisma (SQLite locally; Turso/libSQL in production).
Owner: Jake Sumner. Purpose: skill_gap_courses_sales_only.
Base44 stays live until convert.

## Local setup

```bash
cp .env.example .env
npm install
# then: local DB setup script from package.json
npm run dev
```

Open http://localhost:3000

**Local:** DATABASE_URL=file:./dev.db then the local setup package script. Leave TURSO_AUTH_TOKEN empty.

Admin defaults for local only: `ADMIN_PASSWORD=changeme` (or unset -> `changeme`),
`ADMIN_SESSION_SECRET` may use the documented dev fallback. **Production refuses these.**


## Env

See `.env.example`:

- `DATABASE_URL` — local `file:./dev.db`; production Turso `libsql://...`
- `TURSO_AUTH_TOKEN` — required with Turso URL on Vercel
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` (strong, unique in production; secret >=32 chars)
- `AI_API_KEY` — optional; **unused** by free template course builder ($0 catalog growth)
- `CRON_SECRET` — Bearer / x-cron-secret for GET|POST /api/jobs/tick (required in production; same value as GitHub Actions secret)
- `NEXT_PUBLIC_APP_URL` — e.g. `https://skillpulse-ai-ten.vercel.app`
- Optional social placeholders: `REDDIT_CLIENT_ID`, `TWITTER_API_KEY`, `LINKEDIN_ACCESS_TOKEN`, `SOCIAL_POSTING_ENABLED` (empty = promo drafts only)

## Scripts

- npm run build
- Local SQLite: package.json scripts db_push / db_seed / db_setup (colon-separated names)
- Turso: package.json script db_turso -> scripts/turso-setup.ts
- Existing Turso + Phase C: package script db:turso:patch (ensures SkillGap table)

## Database: Local vs Turso

**Local:** DATABASE_URL=file:./dev.db then the local setup package script.

**Turso (one-shot, from a machine with Node):** set DATABASE_URL to your Turso libsql host and TURSO_AUTH_TOKEN, then run the Turso package script.

Do not use Prisma CLI push against a libsql URL — sqlite provider rejects it. Runtime on Vercel uses the libsql driver adapter.

Vercel env must include both DATABASE_URL and TURSO_AUTH_TOKEN.

## Vercel Hobby + Turso (free)

1. Create a Turso DB (CLI or dashboard).
2. Set DATABASE_URL=libsql://... and TURSO_AUTH_TOKEN in Vercel.
3. Set strong ADMIN_PASSWORD and ADMIN_SESSION_SECRET (>=32 chars).
4. Set Stripe keys and NEXT_PUBLIC_APP_URL.
5. From a machine with Node + those env vars: run the Turso package script (schema + seed). Do not use Prisma CLI push against Turso.
6. Point Stripe webhook at /api/stripe/webhook

**Production safety**

- No Stripe keys => checkout 503; no demo enroll in production.
- Weak ADMIN_PASSWORD / ADMIN_SESSION_SECRET hard-fail in production.
- Kill switch pauses enroll; future PromoJobs must no-op when paused.

## Live

https://skillpulse-ai-ten.vercel.app

## Kill switch & admin password ops

**Kill switch:** log in at `/admin` → toggle `OwnerSettings.killSwitchPaused`.
When paused: enroll/checkout blocked; research / generation / promo ticks no-op.
Catalog browsing stays up.

**Rotate admin secrets on Vercel:** Settings → Environment Variables → update
`ADMIN_PASSWORD` (strong) and `ADMIN_SESSION_SECRET` (≥32 chars) → **redeploy** Production →
re-login at `/admin/login`. Old sessions invalidate when the session secret changes.

**Local vs prod:** local may use `ADMIN_PASSWORD=changeme` (or unset → `changeme`) and a
dev session fallback. Production hard-fails weak/missing password or short/fallback session secret.

Full steps: [docs/admin-ops.md](docs/admin-ops.md).

## Seed course

Writing Prompts That Survive Contact With Users — 3x3 lessons, quizzes, capstone, final (~82 min).

## Phase C (free autonomy)

Desired loop every ~5h: **research → free template generate/publish → promo drafts**.

- Free template course builder (no AI_API_KEY, no paid APIs)
- Gates: kill switch + `maxGenerationJobsPerDay` (default 5)
- PromoJob stores Reddit/X/LinkedIn **drafts** in DB; auto-post gated until social tokens
- Admin Catalog autonomy panel shows SkillGaps + promo drafts
- Tick: `GET|POST /api/jobs/tick` via `runAutonomyTick()`

### Cron (Hobby-safe)

**Do not put `0 */5 * * *` in `vercel.json`.** Vercel Hobby only allows crons that run **once per day**; sub-daily schedules **fail the deploy**.

1. **Vercel native (free fallback):** `vercel.json` → `0 16 * * *` (daily UTC) → `/api/jobs/tick`
2. **Every 5 hours (recommended):** GitHub Actions `.github/workflows/autonomy-tick.yml` (`0 */5 * * *`) curls the tick URL with `Authorization: Bearer ${{ secrets.CRON_SECRET }}`
3. **Or** free external cron (cron-job.org): GET/POST `https://skillpulse-ai-ten.vercel.app/api/jobs/tick` with Bearer `CRON_SECRET`

Set `CRON_SECRET` in **Vercel env** and as **GitHub Actions secret** (same value).

### Blockers

| Blocker | Blocks |
|---------|--------|
| Social API keys / posting pipeline | Live Reddit/X/LinkedIn posts (drafts already work) |
| Stripe keys | Checkout (separate from catalog autonomy) |
| `CRON_SECRET` on Vercel + GitHub | Secured production ticks |

Existing Turso: run package script db:turso:patch once after deploy if needed.
See docs/phase-c-catalog-autonomy.md.

## Phase B (light)

SEO sitemap/robots + course OG meta ship with MVP. PromoJob is a schema stub only.
See docs/phase-b-promotions.md.

Push target (CoS): https://github.com/NextGenGems/Skillpulse.AI
Framing: automated course business owned by Jake Sumner (not sentient). Zero OpEx.
Learn UI is section-based under /learn/[slug]; nested paths redirect into sections.
