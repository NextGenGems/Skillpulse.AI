# Phase C – Autonomous skill-gap catalog (free template path)

**Goal:** Skill Flex finds emerging skill gaps and refreshes the course catalog — not a static seed course.

**$0 OpEx:** Free heuristics + template course builder; optional free Groq for richer JSON; optional Bluesky AT Protocol post. Kill switch pauses generation + sales + promo posts.

## Desired loop (every ~5 hours)

1. **Research** — free SkillGap heuristics (`tickSkillGapResearch`)
2. **Enqueue + generate** — best open gaps → `GenerationJob` → Groq (if keyed) else **template/heuristic** full v2 course publish (`tickGenerationJobs`)
3. **Promote** — `PromoJob` with Reddit/X/LinkedIn drafts; **one Bluesky post** when `BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD` set (`tickPromoJobs`).

Unified entry: `runAutonomyTick()` → `{ research, generation, promo }`.

## Cron / Hobby reality

| Mechanism | Schedule | Notes |
|-----------|----------|-------|
| **Vercel Hobby cron** (`vercel.json`) | `0 16 * * *` (once daily UTC) | Hobby **rejects** sub-daily crons (e.g. `*/5`) and **fails deploy**. Keep daily only. |
| **GitHub Actions** | `0 */5 * * *` + `workflow_dispatch` | Copy `docs/github-actions-autonomy-tick.yml` to `.github/workflows/` (needs workflow OAuth scope) |
| **External** (cron-job.org etc.) | every 5 hours | Same URL + Bearer `CRON_SECRET` |

**Tick URL:** `https://skillpulse-ai-ten.vercel.app/api/jobs/tick`  
Supports **GET** (Vercel Cron) and **POST** (Actions / external).  
Auth: `Authorization: Bearer $CRON_SECRET` or `x-cron-secret`. Prod requires `CRON_SECRET`.

### Secrets to set

1. **Vercel** → Environment Variables → `CRON_SECRET` (strong random) → redeploy
2. **GitHub** → repo Settings → Secrets and variables → Actions → `CRON_SECRET` (same value)

## Scaffold status

- Prisma SkillGap + GenerationJob + PromoJob
- `src/lib/template-course-builder.ts` — free 3×3 course + quizzes + capstone + final
- `src/lib/generation-jobs.ts` — Groq when keyed else templates; kill switch + `maxGenerationJobsPerDay` (default **5**)
- `src/lib/groq-course-builder.ts` — Groq chat completions → course JSON; fallback on failure
- `src/lib/promo-jobs.ts` — drafts + optional Bluesky createSession/createRecord
- `src/lib/bluesky.ts` — AT Protocol helper
- Research daily cap: `MAX_RESEARCH_GAPS_PER_DAY` env (default **10**)
- `src/lib/autonomy-tick.ts` — unified tick
- Routes: `GET|POST /api/jobs/tick`, `POST /api/admin/jobs/tick`
- Admin: SkillGaps + Promo drafts panel

## Blockers (remaining)

| Blocker | Needed for |
|---------|------------|
| Social API keys (`REDDIT_CLIENT_ID`, `TWITTER_API_KEY`, `LINKEDIN_ACCESS_TOKEN`) or `SOCIAL_POSTING_ENABLED=true` + real post pipeline | Actual Reddit/X/LinkedIn posting (drafts already work) |
| Stripe keys | Checkout / paid enroll (separate from catalog autonomy) |
| `CRON_SECRET` on Vercel + GitHub Actions | Secured cron ticks in production |
| Optional: bump `OwnerSettings.maxGenerationJobsPerDay` on existing DBs still at 1 | More than one publish/day on older Turso rows |

`AI_API_KEY` is **not** required for catalog growth (free templates).

## Cost control

- No external AI calls on the free path
- Hard refuse if kill switch on
- `maxGenerationJobsPerDay` default 5
- Promo never posts without explicit future wiring

## Out of scope until funded / tokens

- Paid ads, unbounded crawling, rewriting OwnerSettings / Stripe destination
- Live social posting pipeline
