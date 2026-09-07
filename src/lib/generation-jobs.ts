import { prisma } from "./prisma";
import { getOwnerSettings } from "./settings";
import { buildCourseFromSkillGap, slugifyCourse } from "./template-course-builder";

export type CanRunResult = { ok: boolean; reason?: string };
export type TickResult = {
  action: string;
  detail?: string;
  jobId?: string;
  courseId?: string;
  courseSlug?: string;
  enqueued?: number;
};

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Gate checks for free template generation. Never throws. No AI_API_KEY required. */
export async function canRunGeneration(): Promise<CanRunResult> {
  const settings = await getOwnerSettings();
  if (settings.killSwitchPaused) {
    return { ok: false, reason: "killSwitchPaused" };
  }
  const since = startOfUtcDay();
  const used = await prisma.generationJob.count({
    where: {
      createdAt: { gte: since },
      status: { in: ["running", "succeeded"] },
    },
  });
  if (used >= settings.maxGenerationJobsPerDay) {
    return {
      ok: false,
      reason: `daily cap reached (${used}/${settings.maxGenerationJobsPerDay})`,
    };
  }
  return { ok: true };
}

/** Enqueue GenerationJobs for best open SkillGaps not already queued/in progress/published. */
export async function enqueueGenerationFromOpenGaps(limit = 3): Promise<number> {
  const settings = await getOwnerSettings();
  if (settings.killSwitchPaused) return 0;

  const openGaps = await prisma.skillGap.findMany({
    where: { status: "open" },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    take: limit * 3,
    include: {
      generationJobs: {
        where: { status: { in: ["queued", "running", "succeeded"] } },
        take: 1,
      },
    },
  });

  let enqueued = 0;
  for (const gap of openGaps) {
    if (enqueued >= limit) break;
    if (gap.generationJobs.length > 0) continue;

    await prisma.$transaction([
      prisma.generationJob.create({
        data: {
          skillGapId: gap.id,
          stage: "research",
          status: "queued",
        },
      }),
      prisma.skillGap.update({
        where: { id: gap.id },
        data: { status: "queued" },
      }),
    ]);
    enqueued += 1;
  }
  return enqueued;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugifyCourse(base) || `course-${Date.now().toString(36)}`;
  let n = 0;
  while (await prisma.course.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${slugifyCourse(base).slice(0, 60)}-${n}`;
  }
  return slug;
}

/**
 * Persist a full publishable course from a free template spec.
 * No external AI / HTTP.
 */
async function persistTemplateCourse(
  jobId: string,
  gap: { id: string; title: string; description: string; category: string | null; slugHint: string | null },
): Promise<{ courseId: string; slug: string }> {
  const spec = buildCourseFromSkillGap(gap);
  const slug = await uniqueSlug(spec.slug);

  const course = await prisma.course.create({
    data: {
      slug,
      title: spec.title,
      audience: spec.audience,
      promise: spec.promise,
      category: spec.category,
      targetMinutes: spec.targetMinutes,
      estimatedMinutes: spec.estimatedMinutes,
      generationVersion: 2,
      status: "published",
      qaNotes: spec.qaNotes,
      exerciseCount: spec.modules.reduce((n, m) => n + m.lessons.length, 0),
      hasCapstone: true,
      coverLabel: spec.coverLabel,
      coverHue: spec.coverHue,
      priceCents: 2500,
      outlineJson: JSON.stringify({
        modules: spec.modules.map((m) => m.title),
        source: "template-heuristics",
        skillGapId: gap.id,
      }),
    },
  });

  for (const mod of spec.modules) {
    const created = await prisma.module.create({
      data: {
        courseId: course.id,
        order: mod.order,
        title: mod.title,
        purpose: mod.purpose,
        lessons: {
          create: mod.lessons.map((l) => ({
            order: l.order,
            title: l.title,
            estimatedMinutes: l.estimatedMinutes,
            teachMarkdown: l.teachMarkdown,
            exercisePrompt: l.exercisePrompt,
            exerciseType: l.exerciseType,
          })),
        },
      },
    });

    await prisma.quiz.create({
      data: {
        kind: "module",
        passThreshold: mod.quiz.passThreshold,
        moduleId: created.id,
        questions: {
          create: mod.quiz.questions.map((qq, i) => ({
            order: i + 1,
            prompt: qq.prompt,
            choicesJson: JSON.stringify(qq.choices),
            correctIndex: qq.correctIndex,
            explanation: qq.explanation,
          })),
        },
      },
    });
  }

  await prisma.capstone.create({
    data: {
      courseId: course.id,
      estimatedMinutes: spec.capstone.estimatedMinutes,
      briefMarkdown: spec.capstone.briefMarkdown,
      rubricChecklistJson: JSON.stringify(spec.capstone.rubricChecklist),
    },
  });

  await prisma.quiz.create({
    data: {
      kind: "final",
      passThreshold: spec.finalQuiz.passThreshold,
      courseId: course.id,
      questions: {
        create: spec.finalQuiz.questions.map((qq, i) => ({
          order: i + 1,
          prompt: qq.prompt,
          choicesJson: JSON.stringify(qq.choices),
          correctIndex: qq.correctIndex,
          explanation: qq.explanation,
        })),
      },
    },
  });

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      courseId: course.id,
      stage: "publish",
      status: "succeeded",
      attempts: { increment: 1 },
      error: null,
      lastOutputJson: JSON.stringify({
        stub: false,
        mode: "template-heuristics",
        message: "Published free template course (no external AI)",
        slug,
        estimatedMinutes: spec.estimatedMinutes,
      }),
    },
  });

  await prisma.skillGap.update({
    where: { id: gap.id },
    data: { status: "published" },
  });

  return { courseId: course.id, slug };
}

/**
 * Phase C free tick — enqueue from open gaps, then template-generate + publish.
 * IMPORTANT: never calls external AI APIs. AI_API_KEY is irrelevant.
 */
export async function tickGenerationJobs(): Promise<TickResult> {
  const enqueued = await enqueueGenerationFromOpenGaps(3);

  const gate = await canRunGeneration();
  if (!gate.ok) {
    return {
      action: "noop",
      detail: enqueued > 0 ? `${gate.reason}; enqueued ${enqueued}` : gate.reason,
      enqueued,
    };
  }

  const job = await prisma.generationJob.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    include: { skillGap: true },
  });
  if (!job) {
    return {
      action: "noop",
      detail: enqueued > 0 ? `enqueued ${enqueued}; no queued jobs left to run` : "no queued jobs",
      enqueued,
    };
  }

  await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: "running", stage: "draft", attempts: { increment: 1 } },
  });
  await prisma.skillGap.update({
    where: { id: job.skillGapId },
    data: { status: "in_progress" },
  });

  try {
    const { courseId, slug } = await persistTemplateCourse(job.id, job.skillGap);
    return {
      action: "published",
      detail: `free template course published: ${slug}`,
      jobId: job.id,
      courseId,
      courseSlug: slug,
      enqueued,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "template_build_failed";
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: message.slice(0, 500),
        lastOutputJson: JSON.stringify({
          mode: "template-heuristics",
          error: message,
        }),
      },
    });
    await prisma.skillGap.update({
      where: { id: job.skillGapId },
      data: { status: "queued" },
    });
    return {
      action: "failed",
      detail: message,
      jobId: job.id,
      enqueued,
    };
  }
}

/** @deprecated AI key no longer gates free template generation; kept for admin display. */
export function isAiApiKeyConfigured(): boolean {
  const key = process.env.AI_API_KEY?.trim() ?? "";
  return key.length > 0;
}
