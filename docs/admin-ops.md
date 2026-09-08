# Admin ops: password rotation & kill switch

Live: https://skillpulse-ai-ten.vercel.app

## Change ADMIN_PASSWORD / ADMIN_SESSION_SECRET on Vercel

1. Open the Vercel project → **Settings** → **Environment Variables**.
2. Set or rotate:
   - `ADMIN_PASSWORD` — strong unique password (not `changeme`, `password`, `admin`, or empty).
   - `ADMIN_SESSION_SECRET` — unique random string **≥ 32 characters** (not the local dev fallback).
3. Apply to **Production** (and Preview if you use admin there).
4. **Redeploy** Production so new env vars are picked up (env changes alone do not always hot-reload on Hobby).
5. Sign out of `/admin` (or clear cookies), then log in at `/admin/login` with the new password.

After rotation, old admin session cookies signed with the previous `ADMIN_SESSION_SECRET` will fail validation — that is expected.

## Kill switch (`/admin`)

1. Log in at https://skillpulse-ai-ten.vercel.app/admin/login
2. On `/admin`, use the kill-switch control (`OwnerSettings.killSwitchPaused`).
3. When **PAUSED**:
   - Enroll / checkout is blocked (sales paused banner on catalog).
   - Free skill-gap research and generation ticks no-op.
   - Future PromoJob runners must no-op when paused (schema stub today).
4. When **LIVE**: enroll works (subject to Stripe keys); research can create open SkillGaps; generation stub still requires `AI_API_KEY` and will not call AI until the pipeline is wired.

Browsing the catalog remains available while paused.

## Local vs production password rules

| | Local / `NODE_ENV !== production` | Production |
|---|---|---|
| `ADMIN_PASSWORD` | Optional; defaults to `changeme` | Required; weak values hard-fail |
| `ADMIN_SESSION_SECRET` | Optional; uses documented dev fallback | Required; ≥32 chars; not the dev fallback |

Weak passwords rejected in production: empty, `changeme`, `skillpulse-admin-change-me`, `password`, `admin`.

See `src/lib/admin-password.ts` for the exact checks.

## Related endpoints

- Kill switch API: `POST /api/admin/kill-switch` (admin session).
- Free research: `POST /api/admin/skill-gaps/research` (no AI).
- Job tick: `POST /api/admin/jobs/tick` or cron `POST /api/jobs/tick` (+ `CRON_SECRET` in prod).

## Owner penny checkout

Set Vercel env `OWNER_EMAILS` to Jake's buyer email(s), comma/semicolon-separated (trim + case-insensitive; **no wrapping quotes**). Matching checkouts charge **$0.01**; all other buyers pay full course price. Example: `mcdables@gmail.com`. Redeploy after change. If Jake is charged full price, check Vercel env + deploy logs for `ownerListCount` / `ownerPenny=0`.
