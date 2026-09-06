# Phase C – Autonomous skill-gap catalog (scaffold shipped)

**Goal:** SkillPulse finds emerging skill gaps and refreshes the course catalog — not a static seed course.

**Gates:** Stripe live first. AI spend stays $0 until sales fund keys. Kill switch pauses generation + sales + promo jobs.

## Scaffold status (this ship)

- Prisma SkillGap + GenerationJob.skillGapId relation
- src/lib/generation-jobs.ts — canRunGeneration / tickGenerationJobs stub
  - No-ops without AI key, when kill switch on, or over maxGenerationJobsPerDay
  - Never calls external AI APIs (even if key is set)
  - When gates pass: marks oldest queued job failed with error=stub_no_ai_pipeline
- Routes: POST /api/jobs/tick (CRON_SECRET), POST /api/admin/jobs/tick, GET|POST /api/admin/skill-gaps
- Admin UI: Catalog autonomy (Phase C) panel

## Turso patch (existing DBs)

Fresh db:turso from-empty includes SkillGap. Existing Turso: run npm run db:turso:patch once.

## When to wire real AI

1. Stripe live on production
2. Paid conversion OR funded free-tier AI key with hard daily cap
3. OwnerSettings.killSwitchPaused === false

## Pipeline (reuse GenerationJob)

Stages: research -> outline -> draft -> qa -> publish

## Cost control

- No generation if AI key unset
- Hard refuse if kill switch on
- maxGenerationJobsPerDay default 1
- Prefer free-tier: stop when budget env says so 

## Out of scope until funded

- Paid ads, unbounded crawling, rewriting OwnerSettings / Stripe destination
