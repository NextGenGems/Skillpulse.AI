import { NextRequest, NextResponse } from "next/server";
import { unlockEnrollmentFromCheckoutSession } from "@/lib/enrollment-pay";

export const dynamic = "force-dynamic";

/**
 * Recovery: buyer already paid in Stripe but paidAt is still null
 * (webhook late/broken). POST { session_id, slug? } → learn URL with token.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.session_id || body.sessionId || "").trim();
    const slug = String(body.slug || "").trim();

    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }
    if (!sessionId.startsWith("cs_")) {
      return NextResponse.json({ error: "Invalid Stripe session id" }, { status: 400 });
    }

    const result = await unlockEnrollmentFromCheckoutSession(sessionId);
    if (!result.ok) {
      const status =
        result.reason === "not_paid" ? 402 : result.reason === "not_found" ? 404 : 503;
      return NextResponse.json({ error: result.message, reason: result.reason }, { status });
    }

    const { enrollment } = result;
    if (slug && enrollment.course.slug !== slug) {
      return NextResponse.json(
        { error: "Session does not match this course." },
        { status: 400 },
      );
    }

    const courseSlug = enrollment.course.slug;
    const learnPath = `/learn/${courseSlug}?token=${enrollment.accessToken}&success=1`;

    return NextResponse.json({
      ok: true,
      alreadyPaid: result.alreadyPaid,
      enrollmentId: enrollment.id,
      accessToken: enrollment.accessToken,
      learnUrl: learnPath,
      redirectTo: learnPath,
    });
  } catch (e) {
    console.error("[checkout/unlock]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unlock failed" },
      { status: 500 },
    );
  }
}
