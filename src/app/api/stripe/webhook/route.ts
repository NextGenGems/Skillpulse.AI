import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ ok: true, stub: true, message: "Webhook stub: Stripe keys/secret unset." });
  }
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(body, sig, secret); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "bad sig" }, { status: 400 }); }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const enrollmentId = session.metadata?.enrollmentId;
    if (enrollmentId) {
      await prisma.enrollment.update({ where: { id: enrollmentId }, data: { paidAt: new Date(), stripeSessionId: session.id, email: (session.customer_email || session.metadata?.email || "").toLowerCase() || undefined } });
      await prisma.enrollmentProgress.upsert({ where: { enrollmentId }, update: {}, create: { enrollmentId } });
    }
  }
  return NextResponse.json({ received: true });
}
