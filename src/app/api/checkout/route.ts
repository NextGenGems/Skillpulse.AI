import { NextRequest, NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/enrollment-pay";
import { prisma } from "@/lib/prisma";
import { getOwnerSettings } from "@/lib/settings";
import { getStripe, stripeProductName } from "@/lib/stripe";
import {
  isOwnerBuyerEmail,
  logOwnerPricingDecision,
  normalizeBuyerEmail,
  parseOwnerEmails,
} from "@/lib/owner-emails";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slug = String(body.slug || "");
    const email = normalizeBuyerEmail(String(body.email || ""));
    if (!slug) return NextResponse.json({ error: "Missing course slug" }, { status: 400 });
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    const settings = await getOwnerSettings();
    if (settings.killSwitchPaused) {
      return NextResponse.json({ error: "Sales are paused by the owner kill switch." }, { status: 403 });
    }
    const course = await prisma.course.findUnique({ where: { slug } });
    if (!course || course.status !== "published") {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    let appUrl: string;
    try {
      appUrl = getPublicAppUrl();
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "NEXT_PUBLIC_APP_URL misconfigured" },
        { status: 503 },
      );
    }

    const stripe = getStripe();

    // Production hard-fail: never create free demo enrollments without Stripe
    if (!stripe && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Checkout is not configured. Stripe keys required in production." },
        { status: 503 },
      );
    }

    const enrollment = await prisma.enrollment.create({
      data: { email, courseId: course.id, paidAt: stripe ? null : new Date() },
    });
    await prisma.enrollmentProgress.create({ data: { enrollmentId: enrollment.id } });
    if (!stripe) {
      // Local/dev only: demo enrollment without charging
      return NextResponse.json({
        devAccessUrl: appUrl + "/learn/" + slug + "?token=" + enrollment.accessToken + "&demo=1",
        warning: "STRIPE_SECRET_KEY unset - demo enrollment created without charging.",
      });
    }
    // Owner/admin emails pay $0.01; everyone else pays full course price.
    // Harden: trim/case/strip quotes/; separators so Vercel env paste cannot silently miss.
    const ownerEmails = parseOwnerEmails();
    const isOwnerBuyer = isOwnerBuyerEmail(email, ownerEmails);
    const unitAmount = isOwnerBuyer ? 1 : course.priceCents;
    logOwnerPricingDecision({
      matched: isOwnerBuyer,
      ownerListCount: ownerEmails.length,
      unitAmountCents: unitAmount,
      courseSlug: slug,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: unitAmount,
          product_data: {
            name: stripeProductName(course.title) + (isOwnerBuyer ? " (owner)" : ""),
            description: course.promise.slice(0, 200),
          },
        },
      }],
      // Always production app URL in prod — never localhost (breaks phone after Stripe redirect).
      success_url: appUrl + "/learn/" + slug + "/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: appUrl + "/courses/" + slug,
      metadata: {
        enrollmentId: enrollment.id,
        courseSlug: slug,
        email,
        owner: "Jake Sumner",
        ownerPennyCheckout: isOwnerBuyer ? "1" : "0",
      },
    });
    await prisma.enrollment.update({ where: { id: enrollment.id }, data: { stripeSessionId: session.id } });
    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout error" }, { status: 500 });
  }
}
