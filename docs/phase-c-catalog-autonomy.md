# Phase C — Autonomous skill-gap catalog (post-Stripe)

**Goal (non-negotiable):** SkillPulse finds emerging skill gaps and optimally refreshes the course catalog — not a static seed course.

**Gates:** Jake’s Stripe keys live first (paid checkout). AI spend stays **$0** until sales can fund keys/credits. Kill switch pauses generation + sales + future promo jobs. Bounded automation for Jake; not sentient.

## When to start
1. Stripe live on https://skillpulse-ai-ten.vercel.app
2. At least one paid conversion OR Jake explicitly funds a free-tier AI key with a hard daily cap
3. `OwnerSettings.killSwitchPaused === false`

## Pipeline (reuse GenerationJob)
Stages: `research` → `outline` → `draft` → `qa` → `publish`

1. **Skill-gap finder (research)** — free/cheap signals only at first:
   - Public job/trend heuristics, search volume proxies, competitor course gaps
   - Score gaps; skip if a published course already covers the slug/topic
2. **Outline / draft / quizzes / capstone** — same v2 structure (3×3, exercises, cert gates) as Stage 1 brief
3. **QA gate** — reject snacks (<70 min, missing exercises, etc.)
4. **Publish** — catalog + sitemap pick up new courses
5. **Refresh** — unpublish/regen zero-enrollment or stale courses under `maxGenerationJobsPerDay` (default 1)

## Cost control
- No generation if `AI_API_KEY` unset
- Hard refuse if kill switch on
- `maxGenerationJobsPerDay` default 1; never on learner request path
- Prefer free-tier models/credits; stop when budget env says so

## Out of scope until funded
- Paid ads
- Unbounded crawling
- Rewriting OwnerSettings / Stripe destination

## MVP slice after Stripe
- Cron or Vercel cron hitting `/api/jobs/tick` (auth’d) that advances one GenerationJob
- Manual “enqueue gap” admin button for first controlled run
- Then unattended daily research when metrics look good
