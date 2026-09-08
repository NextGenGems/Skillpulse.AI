import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

/**
 * Live Stripe webhook endpoint (production):
 *   https://skillpulse-ai-ten.vercel.app/api/stripe/webhook
 *
 * Vercel env STRIPE_WEBHOOK_SECRET must be the signing secret for that endpoint
 * (Stripe Dashboard → Developers → Webhooks → endpoint → Signing secret).
 * Required event: checkout.session.completed
 *
 * Success page + /api/checkout/unlock also mark paidAt if this webhook is late/broken.
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    console.warn("[stripe/webhook] stub: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET unset");
    const payload = {
      ok: false,
      stub: true,
      message:
        "Webhook stub: Stripe keys/secret unset. Configure live endpoint + STRIPE_WEBHOOK_SECRET on Vercel.",
    };
    // Non-2xx in production so Stripe retries instead of treating stub as success.
    const isProd =
      process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    return NextResponse.json(payload, { status: isProd ? 503 : 200 });
  }
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "bad sig" },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const enrollmentId = session.metadata?.enrollmentId;
    const email =
      (session.customer_email ||
        session.customer_details?.email ||
        session.metadata?.email ||
        "")
        .toLowerCase() || undefined;

    let enrollment = enrollmentId
      ? await prisma.enrollment.findUnique({ where: { id: enrollmentId } })
      : null;

    if (!enrollment && session.id) {
      enrollment = await prisma.enrollment.findFirst({
        where: { stripeSessionId: session.id },
      });
    }

    if (enrollment) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: {
          paidAt: enrollment.paidAt ?? new Date(),
          stripeSessionId: session.id,
          ...(email ? { email } : {}),
        },
      });
      await prisma.enrollmentProgress.upsert({
        where: { enrollmentId: enrollment.id },
        update: {},
        create: { enrollmentId: enrollment.id },
      });
    } else {
      console.warn(
        "[stripe/webhook] checkout.session.completed with no enrollment",
        session.id,
        enrollmentId,
      );
    }
  }

  return NextResponse.json({ received: true });
}
