import Link from "next/link";
import { redirect } from "next/navigation";
import { UnlockAccessButton } from "@/components/UnlockAccessButton";
import { unlockEnrollmentFromCheckoutSession } from "@/lib/enrollment-pay";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string; retry?: string }>;
}) {
  const { slug } = await params;
  const { session_id } = await searchParams;

  if (!session_id) {
    redirect(`/courses/${slug}`);
  }

  // Primary path: retrieve Stripe session and unlock even if webhook is late/broken.
  // Looks up by stripeSessionId, then metadata.enrollmentId; sets email + paidAt.
  const unlocked = await unlockEnrollmentFromCheckoutSession(session_id);

  if (unlocked.ok) {
    redirect(
      `/learn/${unlocked.enrollment.course.slug}?token=${unlocked.enrollment.accessToken}&success=1`,
    );
  }

  // Fallback: webhook already marked paid — still redirect if we can find enrollment.
  const bySession = await prisma.enrollment.findFirst({
    where: { stripeSessionId: session_id, paidAt: { not: null } },
    include: { course: true },
  });
  if (bySession?.paidAt) {
    redirect(`/learn/${bySession.course.slug}?token=${bySession.accessToken}&success=1`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 py-8">
      <h1 className="text-2xl font-bold">Payment received — syncing access</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Stripe confirmed checkout, but course access is still catching up
        {!unlocked.ok ? ` (${unlocked.reason})` : ""}. This usually resolves in a few seconds.
      </p>
      <UnlockAccessButton slug={slug} sessionId={session_id} />
      <Link href={`/courses/${slug}`} className="inline-block text-sm text-violet-700 underline">
        Back to course
      </Link>
    </div>
  );
}
