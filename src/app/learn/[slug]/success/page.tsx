import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id } = await searchParams;

  if (!session_id) {
    redirect(`/courses/${slug}`);
  }

  let enrollment = await prisma.enrollment.findFirst({
    where: { stripeSessionId: session_id },
    include: { course: true },
  });

  // If webhook hasn't fired yet, mark paid from success page (test/dev convenience)
  const stripe = getStripe();
  if (stripe && enrollment && !enrollment.paidAt) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status === "paid" || session.status === "complete") {
        enrollment = await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { paidAt: new Date() },
          include: { course: true },
        });
        await prisma.enrollmentProgress.upsert({
          where: { enrollmentId: enrollment.id },
          update: {},
          create: { enrollmentId: enrollment.id },
        });
      }
    } catch {
      // ignore — webhook may still complete
    }
  }

  if (!enrollment?.paidAt) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Payment received — syncing access</h1>
        <p className="text-sm text-zinc-600">
          If access does not appear in a few seconds, refresh or check that the Stripe webhook is configured.
        </p>
        <Link href={`/courses/${slug}`} className="text-violet-700 underline">
          Back to course
        </Link>
      </div>
    );
  }

  redirect(`/learn/${slug}?token=${enrollment.accessToken}&success=1`);
}
