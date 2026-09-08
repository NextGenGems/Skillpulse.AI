/**
 * One-shot: rebuild teachMarkdown (+ related lesson fields, quizzes, capstone, minutes)
 * for published courses from the meaty unique template builder.
 * Keeps course/module/lesson/enrollment IDs and slugs.
 *
 * Does NOT touch OwnerSettings.killSwitchPaused.
 *
 * Usage:
 *   set -a && source /workspace/skillpulse/deploy-secrets.env && set +a
 *   npx tsx scripts/regenerate-course-content.ts
 *   npx tsx scripts/regenerate-course-content.ts --slug ai-agent-workflow-design-for-solo-operators
 *   npx tsx scripts/regenerate-course-content.ts --dry-run
 */
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import {
  buildCourseFromSkillGap,
  type BuiltCourseSpec,
} from "../src/lib/template-course-builder";

function createDb(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const useTurso = url.startsWith("libsql:") || Boolean(authToken);
  if (useTurso) {
    const libsql = createClient({ url, authToken: authToken || undefined });
    return new PrismaClient({ adapter: new PrismaLibSQL(libsql) });
  }
  return new PrismaClient();
}

function parseArgs(argv: string[]) {
  let slug: string | null = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--slug") slug = argv[++i] ?? null;
    else if (argv[i] === "--dry-run") dryRun = true;
  }
  return { slug, dryRun };
}

async function rebuildCourse(
  prisma: PrismaClient,
  courseId: string,
  spec: BuiltCourseSpec,
  dryRun: boolean,
) {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" } },
          quiz: { include: { questions: { orderBy: { order: "asc" } } } },
        },
      },
      capstone: true,
      finalQuiz: { include: { questions: { orderBy: { order: "asc" } } } },
    },
  });

  const summary = {
    slug: course.slug,
    lessonsUpdated: 0,
    quizzesUpdated: 0,
    sampleLen: 0,
  };

  if (dryRun) {
    for (let mi = 0; mi < Math.min(course.modules.length, spec.modules.length); mi++) {
      for (
        let li = 0;
        li < Math.min(course.modules[mi]!.lessons.length, spec.modules[mi]!.lessons.length);
        li++
      ) {
        summary.lessonsUpdated += 1;
        if (mi === 0 && li === 0) {
          summary.sampleLen = spec.modules[mi]!.lessons[li]!.teachMarkdown.length;
        }
      }
    }
    return summary;
  }

  await prisma.course.update({
    where: { id: course.id },
    data: {
      audience: spec.audience,
      promise: spec.promise,
      targetMinutes: spec.targetMinutes,
      estimatedMinutes: spec.estimatedMinutes,
      qaNotes: `${spec.qaNotes} Regenerated ${new Date().toISOString()} (content meat pass; kill switch untouched).`,
      exerciseCount: spec.modules.reduce((n, m) => n + m.lessons.length, 0),
      coverLabel: spec.coverLabel,
      coverHue: spec.coverHue,
    },
  });

  for (let mi = 0; mi < course.modules.length; mi++) {
    const mod = course.modules[mi]!;
    const modSpec = spec.modules[mi];
    if (!modSpec) continue;

    await prisma.module.update({
      where: { id: mod.id },
      data: {
        title: modSpec.title,
        purpose: modSpec.purpose,
      },
    });

    for (let li = 0; li < mod.lessons.length; li++) {
      const lesson = mod.lessons[li]!;
      const lessonSpec = modSpec.lessons[li];
      if (!lessonSpec) continue;
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          title: lessonSpec.title,
          estimatedMinutes: lessonSpec.estimatedMinutes,
          teachMarkdown: lessonSpec.teachMarkdown,
          exercisePrompt: lessonSpec.exercisePrompt,
          exerciseType: lessonSpec.exerciseType,
        },
      });
      summary.lessonsUpdated += 1;
      if (mi === 0 && li === 0) summary.sampleLen = lessonSpec.teachMarkdown.length;
    }

    if (mod.quiz) {
      await prisma.quizQuestion.deleteMany({ where: { quizId: mod.quiz.id } });
      await prisma.quiz.update({
        where: { id: mod.quiz.id },
        data: { passThreshold: modSpec.quiz.passThreshold },
      });
      for (let qi = 0; qi < modSpec.quiz.questions.length; qi++) {
        const qq = modSpec.quiz.questions[qi]!;
        await prisma.quizQuestion.create({
          data: {
            quizId: mod.quiz.id,
            order: qi + 1,
            prompt: qq.prompt,
            choicesJson: JSON.stringify(qq.choices),
            correctIndex: qq.correctIndex,
            explanation: qq.explanation,
          },
        });
      }
      summary.quizzesUpdated += 1;
    }
  }

  if (course.capstone) {
    await prisma.capstone.update({
      where: { id: course.capstone.id },
      data: {
        briefMarkdown: spec.capstone.briefMarkdown,
        rubricChecklistJson: JSON.stringify(spec.capstone.rubricChecklist),
        estimatedMinutes: spec.capstone.estimatedMinutes,
      },
    });
  }

  if (course.finalQuiz) {
    await prisma.quizQuestion.deleteMany({ where: { quizId: course.finalQuiz.id } });
    await prisma.quiz.update({
      where: { id: course.finalQuiz.id },
      data: { passThreshold: spec.finalQuiz.passThreshold },
    });
    for (let qi = 0; qi < spec.finalQuiz.questions.length; qi++) {
      const qq = spec.finalQuiz.questions[qi]!;
      await prisma.quizQuestion.create({
        data: {
          quizId: course.finalQuiz.id,
          order: qi + 1,
          prompt: qq.prompt,
          choicesJson: JSON.stringify(qq.choices),
          correctIndex: qq.correctIndex,
          explanation: qq.explanation,
        },
      });
    }
    summary.quizzesUpdated += 1;
  }

  return summary;
}

async function main() {
  const { slug, dryRun } = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  console.log(
    `DB: ${url.startsWith("libsql:") || url.includes("turso") ? "Turso/libsql" : "local"} dryRun=${dryRun}`,
  );

  const prisma = createDb();
  try {
    const courses = await prisma.course.findMany({
      where: {
        status: "published",
        ...(slug ? { slug } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    if (courses.length === 0) {
      console.log("No published courses matched.");
      return;
    }

    const settings = await prisma.ownerSettings.findUnique({ where: { id: 1 } });
    console.log(
      `killSwitchPaused=${settings?.killSwitchPaused ?? "n/a"} (will NOT change)`,
    );

    for (const course of courses) {
      // Prefer linked SkillGap when present; fall back to course fields.
      let gapTitle = course.title;
      let gapDescription = course.promise || `Practical course on ${course.title}`;
      let gapCategory: string | null = course.category;
      const job = await prisma.generationJob.findFirst({
        where: { courseId: course.id, status: "succeeded" },
        orderBy: { updatedAt: "desc" },
      });
      if (job?.skillGapId) {
        const gap = await prisma.skillGap.findUnique({ where: { id: job.skillGapId } });
        if (gap) {
          gapTitle = gap.title;
          gapDescription = gap.description;
          gapCategory = gap.category;
        }
      }
      const spec = buildCourseFromSkillGap({
        title: gapTitle,
        description: gapDescription,
        category: gapCategory,
        slugHint: course.slug,
      });
      spec.slug = course.slug;

      const summary = await rebuildCourse(prisma, course.id, spec, dryRun);
      console.log(
        `${dryRun ? "[dry-run] " : ""}regenerated ${summary.slug}: lessons=${summary.lessonsUpdated} quizzes=${summary.quizzesUpdated} sampleTeachChars=${summary.sampleLen} courseMinutes=${spec.estimatedMinutes}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
