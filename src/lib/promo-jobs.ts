import { prisma } from "./prisma";
import { getOwnerSettings } from "./settings";

export type PromoTickResult = {
  action: string;
  detail?: string;
  jobId?: string;
  courseId?: string;
};

function hasSocialCredentials(): boolean {
  if (process.env.SOCIAL_POSTING_ENABLED?.trim() === "true") return true;
  const keys = [
    process.env.REDDIT_CLIENT_ID,
    process.env.TWITTER_API_KEY,
    process.env.LINKEDIN_ACCESS_TOKEN,
  ];
  return keys.some((k) => (k?.trim() ?? "").length > 0);
}

function buildDrafts(course: {
  title: string;
  slug: string;
  promise: string;
  category: string;
}): { reddit: string; x: string; linkedin: string; appUrl: string } {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://skillpulse-ai-ten.vercel.app";
  const url = `${base}/courses/${course.slug}`;
  const disclosure =
    "Disclosure: I'm Jake Sumner, owner of SkillPulse — sharing a course I publish. Not spam; feedback welcome.";

  const reddit = [
    `Title: Practical course: ${course.title}`,
    ``,
    `I put together a focused ~80‑minute course on **${course.title}** (${course.category}).`,
    ``,
    course.promise,
    ``,
    `Link: ${url}`,
    ``,
    disclosure,
  ].join("\n");

  const x = [
    `${course.title} — short practical course (~80 min).`,
    course.promise.slice(0, 160),
    url,
    `— Jake Sumner / SkillPulse (owner-disclosed)`,
  ].join("\n");

  const linkedin = [
    `I published a practical course: ${course.title}`,
    ``,
    course.promise,
    ``,
    `Built for busy practitioners who want drills + a capstone, not fluff.`,
    `Course: ${url}`,
    ``,
    disclosure,
  ].join("\n");

  return { reddit, x, linkedin, appUrl: url };
}

/**
 * Promo tick — never posts to social networks in this stub.
 * Creates owner-disclosed draft copy in PromoJob.lastOutputJson for Reddit/X/LinkedIn.
 */
export async function tickPromoJobs(): Promise<PromoTickResult> {
  const settings = await getOwnerSettings();
  if (settings.killSwitchPaused) {
    return { action: "noop", detail: "killSwitchPaused" };
  }

  // Prefer a published course that has no PromoJob yet
  const published = await prisma.course.findMany({
    where: { status: "published" },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const existing = await prisma.promoJob.findMany({
    where: { courseId: { not: null } },
    select: { courseId: true },
  });
  const hasPromo = new Set(existing.map((p) => p.courseId).filter(Boolean) as string[]);

  const course = published.find((c) => !hasPromo.has(c.id));

  // Also advance any queued PromoJob missing drafts
  const queued = await prisma.promoJob.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });

  const socialReady = hasSocialCredentials();

  if (!course && !queued) {
    return {
      action: "noop",
      detail: socialReady
        ? "no courses needing promo drafts; auto-post still stubbed"
        : "no social API keys; promo stub $0 — no courses needing drafts",
    };
  }

  if (queued && !queued.lastOutputJson) {
    const c = queued.courseId
      ? await prisma.course.findUnique({ where: { id: queued.courseId } })
      : course;
    if (!c) {
      await prisma.promoJob.update({
        where: { id: queued.id },
        data: {
          status: "failed",
          error: "stub_no_promo_pipeline",
          attempts: { increment: 1 },
          lastOutputJson: JSON.stringify({
            stub: true,
            message: "Queued PromoJob had no course; no outbound social HTTP",
          }),
        },
      });
      return {
        action: "stub_failed",
        detail: "queued promo had no course",
        jobId: queued.id,
      };
    }
    const drafts = buildDrafts(c);
    await prisma.promoJob.update({
      where: { id: queued.id },
      data: {
        courseId: c.id,
        channel: "community",
        status: "succeeded",
        error: socialReady ? "stub_no_promo_pipeline" : null,
        attempts: { increment: 1 },
        lastOutputJson: JSON.stringify({
          stub: true,
          autoPost: false,
          draftsReady: true,
          drafts,
          note: socialReady
            ? "Drafts stored; outbound social HTTP not wired (stub_no_promo_pipeline)"
            : "no social API keys; promo stub $0 — drafts only",
        }),
      },
    });
    return {
      action: "drafts_ready",
      detail: socialReady
        ? "drafts stored; auto-post stubbed"
        : "no social API keys; promo stub $0 — drafts stored",
      jobId: queued.id,
      courseId: c.id,
    };
  }

  if (!course) {
    return {
      action: "noop",
      detail: "all published courses already have promo jobs",
    };
  }

  const drafts = buildDrafts(course);
  const job = await prisma.promoJob.create({
    data: {
      courseId: course.id,
      channel: "community",
      status: "succeeded",
      error: socialReady ? "stub_no_promo_pipeline" : null,
      attempts: 1,
      lastOutputJson: JSON.stringify({
        stub: true,
        autoPost: false,
        draftsReady: true,
        drafts,
        note: socialReady
          ? "Drafts stored; outbound social HTTP not wired (stub_no_promo_pipeline)"
          : "no social API keys; promo stub $0 — drafts only",
      }),
    },
  });

  return {
    action: "drafts_ready",
    detail: socialReady
      ? `promo drafts for ${course.slug}; auto-post stubbed`
      : `no social API keys; promo stub $0 — drafts for ${course.slug}`,
    jobId: job.id,
    courseId: course.id,
  };
}
