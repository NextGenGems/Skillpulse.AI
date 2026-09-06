import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

type Q = {
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

type Lesson = {
  order: number;
  title: string;
  estimatedMinutes: number;
  teachMarkdown: string;
  exercisePrompt: string;
  exerciseType: string;
};

type Mod = {
  order: number;
  title: string;
  purpose: string;
  lessons: Lesson[];
  quiz: { passThreshold: number; questions: Q[] };
};

type SeedCourse = {
  slug: string;
  title: string;
  audience: string;
  promise: string;
  category: string;
  targetMinutes: number;
  estimatedMinutes: number;
  coverLabel: string;
  coverHue: number;
  modules: Mod[];
  capstone: {
    estimatedMinutes: number;
    briefMarkdown: string;
    rubricChecklist: string[];
  };
  finalQuiz: { passThreshold: number; questions: Q[] };
};

async function main() {
  await prisma.ownerSettings.upsert({
    where: { id: 1 },
    update: {
      ownerName: "Jake Sumner",
      allowedPurpose: "skill_gap_courses_sales_only",
      maxGenerationJobsPerDay: 1,
      stripeAccountNote: "Jake's connected Stripe only",
    },
    create: {
      id: 1,
      ownerName: "Jake Sumner",
      killSwitchPaused: false,
      allowedPurpose: "skill_gap_courses_sales_only",
      maxGenerationJobsPerDay: 1,
      stripeAccountNote: "Jake's connected Stripe only",
    },
  });

  const raw = readFileSync(join(__dirname, "data", "course.json"), "utf8");
  const data = JSON.parse(raw) as SeedCourse;

  const existing = await prisma.course.findUnique({ where: { slug: data.slug } });
  if (existing) {
    await prisma.course.delete({ where: { id: existing.id } });
  }

  const course = await prisma.course.create({
    data: {
      slug: data.slug,
      title: data.title,
      audience: data.audience,
      promise: data.promise,
      category: data.category,
      targetMinutes: data.targetMinutes,
      estimatedMinutes: data.estimatedMinutes,
      generationVersion: 2,
      status: "published",
      qaNotes: "Manually authored v2 seed for MVP. No AI generation used.",
      exerciseCount: data.modules.reduce((n, m) => n + m.lessons.length, 0),
      hasCapstone: true,
      coverLabel: data.coverLabel,
      coverHue: data.coverHue,
      priceCents: 2500,
      outlineJson: JSON.stringify({
        modules: data.modules.map((m) => m.title),
      }),
    },
  });

  for (const mod of data.modules) {
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
      estimatedMinutes: data.capstone.estimatedMinutes,
      briefMarkdown: data.capstone.briefMarkdown,
      rubricChecklistJson: JSON.stringify(data.capstone.rubricChecklist),
    },
  });

  await prisma.quiz.create({
    data: {
      kind: "final",
      passThreshold: data.finalQuiz.passThreshold,
      courseId: course.id,
      questions: {
        create: data.finalQuiz.questions.map((qq, i) => ({
          order: i + 1,
          prompt: qq.prompt,
          choicesJson: JSON.stringify(qq.choices),
          correctIndex: qq.correctIndex,
          explanation: qq.explanation,
        })),
      },
    },
  });

  await prisma.generationJob.create({
    data: {
      skillGapId: "seed-gap-prompt-engineering",
      courseId: course.id,
      stage: "publish",
      status: "succeeded",
      attempts: 1,
      lastOutputJson: JSON.stringify({
        note: "Manually seeded; AI runner deferred",
      }),
    },
  });

  console.log("Seeded OwnerSettings + course:", course.slug);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
