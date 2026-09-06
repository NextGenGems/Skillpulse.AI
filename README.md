# SkillPulse (rebuild MVP)

Next.js 15 + TypeScript + Tailwind + Prisma (SQLite).
Owner: Jake Sumner. Purpose: skill_gap_courses_sales_only.
Base44 stays live until convert.

## Local setup

cp .env.example .env
npm install
npm run db:setup
npm run dev

Open http://localhost:3000

## Env

DATABASE_URL=file:./dev.db (later Turso or Neon)
STRIPE_SECRET_KEY (Jake only; unset = local test enrollment)
STRIPE_WEBHOOK_SECRET
ADMIN_PASSWORD / ADMIN_SESSION_SECRET
AI_API_KEY empty for MVP

## Scripts

npm run build (prisma generate + next build)
npm run db:setup / db:seed

## Vercel Hobby

Set env from .env.example; Turso/Neon DB; Stripe webhook /api/stripe/webhook; seed once.

## Kill switch

Admin toggles OwnerSettings.killSwitchPaused (hides/disables Enroll).

## Seed course

Writing Prompts That Survive Contact With Users - 3x3 lessons, quizzes, capstone, final (~82 min).

Push target (CoS): https://github.com/NextGenGems/Skillpulse.AI
Framing: automated course business owned by Jake Sumner (not sentient). Zero OpEx; no paid AI required.
Learn UI is section-based under /learn/[slug]; nested paths redirect into sections.
