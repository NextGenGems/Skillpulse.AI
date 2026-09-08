import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import type { Course, Enrollment } from "@prisma/client";

export type EnrollmentWithCourse = Enrollment & { course: Course };

export type UnlockResult =
  | { ok: true; enrollment: EnrollmentWithCourse; alreadyPaid: boolean }
  | { ok: false; reason: "no_stripe" | "not_paid" | "not_found" | "stripe_error"; message: string };

function sessionLooksPaid(paymentStatus: string | null | undefined, status: string | null | undefined): boolean {
  return paymentStatus === "paid" || status === "complete";
}

function emailFromSession(session: {
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  metadata?: Record<string, string> | null;
}): string | undefined {
  const raw =
    session.customer_email ||
    session.customer_details?.email ||
    session.metadata?.email ||
    "";
  const email = String(raw).trim().toLowerCase();
  return email || undefined;
}

/**
 * Mark enrollment paid from a live Stripe Checkout Session.
 * Looks up by stripeSessionId first, then metadata.enrollmentId.
 * Safe to call when webhook is late/broken — success page + unlock API use this.
 */
export async function unlockEnrollmentFromCheckoutSession(sessionId: string): Promise<UnlockResult> {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, reason: "no_stripe", message: "Stripe is not configured." };
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    return {
      ok: false,
      reason: "stripe_error",
      message: err instanceof Error ? err.message : "Could not retrieve Stripe session.",
    };
  }

  if (!sessionLooksPaid(session.payment_status, session.status)) {
    return {
      ok: false,
      reason: "not_paid",
      message: `Stripe session is not paid yet (payment_status=${session.payment_status}, status=${session.status}).`,
    };
  }

  let enrollment = await prisma.enrollment.findFirst({
    where: { stripeSessionId: sessionId },
    include: { course: true },
  });

  if (!enrollment && session.metadata?.enrollmentId) {
    enrollment = await prisma.enrollment.findUnique({
      where: { id: session.metadata.enrollmentId },
      include: { course: true },
    });
  }

  if (!enrollment) {
    return {
      ok: false,
      reason: "not_found",
      message: "No enrollment found for this Stripe session.",
    };
  }

  const alreadyPaid = Boolean(enrollment.paidAt);
  const email = emailFromSession(session);

  enrollment = await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      paidAt: enrollment.paidAt ?? new Date(),
      stripeSessionId: session.id,
      ...(email ? { email } : {}),
    },
    include: { course: true },
  });

  await prisma.enrollmentProgress.upsert({
    where: { enrollmentId: enrollment.id },
    update: {},
    create: { enrollmentId: enrollment.id },
  });

  return { ok: true, enrollment, alreadyPaid };
}

/** Resolve public app URL for Stripe redirects — never localhost in production. */
export function getPublicAppUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL === "1";

  const looksLocal = (url: string) => /localhost|127\.0\.0\.1/i.test(url);

  if (raw && !(isProd && looksLocal(raw))) {
    return raw;
  }

  if (isProd) {
    const vercelHost = (process.env.VERCEL_URL || "").trim().replace(/^https?:\/\//, "");
    if (vercelHost && !looksLocal(vercelHost)) {
      return `https://${vercelHost}`;
    }
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be your production URL (e.g. https://skillpulse-ai-ten.vercel.app). Localhost redirects break mobile checkout.",
    );
  }

  return raw || "http://localhost:3000";
}
