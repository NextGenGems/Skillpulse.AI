# Stripe webhook + paid unlock (Skill Flex)

## Incident (2026-09)

Jake paid live Stripe for a course; enrollment got `stripeSessionId` but `paidAt` stayed null because the webhook did not mark paid (misconfigured/missing signing secret or late delivery). Success redirect also used `localhost` when `NEXT_PUBLIC_APP_URL` was wrong — phones cannot open that.

## What buyers need

1. Stripe Checkout success → `/learn/[slug]/success?session_id=cs_…`
2. That page (and `/api/checkout/unlock`) retrieve the session and set `paidAt` + email even if the webhook is late.
3. Redirect to `/learn/[slug]?token=…`

Webhook remains the primary path; success/unlock are the safety net.

## Jake: verify in Stripe Dashboard → Webhooks

1. **Endpoint URL** (exact):
   `https://skillpulse-ai-ten.vercel.app/api/stripe/webhook`
2. **Events**: at least `checkout.session.completed`
3. **Signing secret**: copy `whsec_…` → Vercel env **`STRIPE_WEBHOOK_SECRET`** (Production) → **Redeploy**
4. Confirm **`STRIPE_SECRET_KEY`** is the **live** key (`sk_live_…`) matching the same Stripe account
5. Confirm **`NEXT_PUBLIC_APP_URL=https://skillpulse-ai-ten.vercel.app`** (no trailing slash, **never** localhost)

## Recovery without waiting for webhook

- Success page auto-refreshes and has **I’ve paid — unlock access**
- Or `POST /api/checkout/unlock` with JSON `{ "session_id": "cs_live_…", "slug": "…" }`

## $0 note

No paid email service — learn link is only via redirect/token URL (no Resend/SendGrid).

## Owner $0.01 pricing

Vercel Production must set `OWNER_EMAILS=mcdables@gmail.com` (add more with commas; **no quotes**). Matching is trim + case-insensitive. If unset or mistyped, checkout charges full `priceCents` (Jake’s $25 incident). After changing the env var, **redeploy**. Checkout metadata `ownerPennyCheckout=1` confirms a match; server logs `ownerPenny` + `ownerListCount` without emails.
