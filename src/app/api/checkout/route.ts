import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerSettings } from "@/lib/settings";
import { getStripe, stripeProductName } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slug = String(body.slug || "");
    const email = String(body.email || "").trim().toLowerCase();
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const stripe = getStripe();
    const enrollment = await prisma.enrollment.create({
      data: { email, courseId: course.id, paidAt: stripe ? null : new Date() },
    });
    await prisma.enrollmentProgress.create({ data: { enrollmentId: enrollment.id } });
    if (!stripe) {
      return NextResponse.json({
        devAccessUrl: appUrl + "/learn/" + slug + "?token=" + enrollment.accessToken + "&demo=1",
        warning: "STRIPE_SECRET_KEY unset - demo enrollment created without charging.",
      });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: course.priceCents,
          product_data: { name: stripeProductName(course.title), description: course.promise.slice(0, 200) },
        },
      }],
      success_url: appUrl + "/learn/" + slug + "/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: appUrl + "/courses/" + slug,
      metadata: { enrollmentId: enrollment.id, courseSlug: slug, email, owner: "Jake Sumner" },
    });
    await prisma.enrollment.update({ where: { id: enrollment.id }, data: { stripeSessionId: session.id } });
    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout error" }, { status: 500 });
  }
}

