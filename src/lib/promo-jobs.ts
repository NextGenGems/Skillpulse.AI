import { prisma } from "./prisma";
import { getOwnerSettings } from "./settings";
import {
  buildBlueskyPromoText,
  isBlueskyConfigured,
  isSocialPostingEnabled,
  postBlueskyText,
} from "./bluesky";

export type PromoTickResult = {
  action: string;
  detail?: string;
  jobId?: string;
  courseId?: string;
};

export function hasSocialCredentials(): boolean {
  if (process.env.SOCIAL_POSTING_ENABLED?.trim() === "true") return true;
  if (isBlueskyConfigured()) return true;
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
}): { reddit: string; x: string; linkedin: string; bluesky: string; appUrl: string } {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://skillpulse-ai-ten.vercel.app";
  const url = `${base}/courses/${course.slug}`;
  const disclosure =
    "Disclosure: I'm Jake Sumner, owner of Skill Flex — sharing a course I publish. Not spam; feedback welcome.";

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
    `— Jake Sumner / Skill Flex (owner-disclosed)`,
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

  const bluesky = buildBlueskyPromoText(course);

  return { reddit, x, linkedin, bluesky, appUrl: url };
}

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  promise: string;
  category: string;
};

async function finishPromoWithDrafts(
  course: CourseRow,
  existingJobId?: string,
): Promise<PromoTickResult> {
  const drafts = buildDrafts(course);
  const socialReady = hasSocialCredentials();
  const blueskyReady =
    isBlueskyConfigured() && isSocialPostingEnabled();

  let blueskyPost: { uri: string; cid: string } | null = null;
  let blueskyError: string | null = null;

  if (blueskyReady) {
    try {
      blueskyPost = await postBlueskyText(drafts.bluesky);
    } catch (e) {
      blueskyError =
        e instanceof Error ? e.message.slice(0, 400) : "bluesky_post_failed";
    }
  }

  const autoPost = !!blueskyPost;
  const output = {
    stub: !autoPost && !blueskyReady,
    autoPost,
    draftsReady: true,
    drafts,
    bluesky: blueskyPost
      ? { posted: true, uri: blueskyPost.uri, cid: blueskyPost.cid }
      : blueskyReady
        ? { posted: false, error: blueskyError }
        : { posted: false, skipped: "no_bluesky_creds_or_disabled" },
    note: blueskyPost
      ? "Drafts stored; Bluesky auto-posted once (owner-disclosed)"
      : blueskyError
        ? `Drafts stored; Bluesky post failed: ${blueskyError}`
        : socialReady
          ? "Drafts stored; Bluesky not configured — Reddit/X/LinkedIn remain manual"
          : "no social API keys; promo stub $0 — drafts only",
  };

  // Bluesky failure marks job failed but does not throw (tick continues).
  const status = blueskyError ? "failed" : "succeeded";
  const error = blueskyError
    ? `bluesky_post_failed:${blueskyError}`
    : null;

  if (existingJobId) {
    await prisma.promoJob.update({
      where: { id: existingJobId },
      data: {
        courseId: course.id,
        channel: blueskyPost ? "bluesky" : "community",
        status,
        error,
        attempts: { increment: 1 },
        lastOutputJson: JSON.stringify(output),
      },
    });
    return {
      action: blueskyPost
        ? "bluesky_posted"
        : blueskyError
          ? "bluesky_failed_drafts_saved"
          : "drafts_ready",
      detail: blueskyPost
        ? `promo drafts + Bluesky post for ${course.slug}`
        : blueskyError
          ? `drafts for ${course.slug}; Bluesky failed: ${blueskyError}`
          : socialReady
            ? `promo drafts for ${course.slug}; Bluesky not configured`
            : `no social API keys; promo stub $0 — drafts for ${course.slug}`,
      jobId: existingJobId,
      courseId: course.id,
    };
  }

  const job = await prisma.promoJob.create({
    data: {
      courseId: course.id,
      channel: blueskyPost ? "bluesky" : "community",
      status,
      error,
      attempts: 1,
      lastOutputJson: JSON.stringify(output),
    },
  });

  return {
    action: blueskyPost
      ? "bluesky_posted"
      : blueskyError
        ? "bluesky_failed_drafts_saved"
        : "drafts_ready",
    detail: blueskyPost
      ? `promo drafts + Bluesky post for ${course.slug}`
      : blueskyError
        ? `drafts for ${course.slug}; Bluesky failed: ${blueskyError}`
        : socialReady
          ? `promo drafts for ${course.slug}; Bluesky not configured`
          : `no social API keys; promo stub $0 — drafts for ${course.slug}`,
    jobId: job.id,
    courseId: course.id,
  };
}

/**
 * Promo tick — stores Reddit/X/LinkedIn drafts; optionally posts once to Bluesky
 * when BLUESKY_HANDLE + BLUESKY_APP_PASSWORD are set and kill switch is off.
 * Max one Bluesky post per PromoJob/course. Failures mark job failed without crashing the tick.
 */
export async function tickPromoJobs(): Promise<PromoTickResult> {
  const settings = await getOwnerSettings();
  if (settings.killSwitchPaused) {
    return { action: "noop", detail: "killSwitchPaused" };
  }

  const published = await prisma.course.findMany({
    where: { status: "published" },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const existing = await prisma.promoJob.findMany({
    where: { courseId: { not: null } },
    select: { courseId: true },
  });
  const hasPromo = new Set(
    existing.map((p) => p.courseId).filter(Boolean) as string[],
  );

  const course = published.find((c) => !hasPromo.has(c.id));

  const queued = await prisma.promoJob.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });

  const socialReady = hasSocialCredentials();

  if (!course && !queued) {
    return {
      action: "noop",
      detail: socialReady
        ? "no courses needing promo; Bluesky ready when new course publishes"
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
          error: "promo_missing_course",
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
    return finishPromoWithDrafts(c, queued.id);
  }

  if (!course) {
    return {
      action: "noop",
      detail: "all published courses already have promo jobs",
    };
  }

  return finishPromoWithDrafts(course);
}
