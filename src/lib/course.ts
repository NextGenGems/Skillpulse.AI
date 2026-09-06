import { prisma } from "./prisma";

export const courseInclude = {
  modules: {
    orderBy: { order: "asc" as const },
    include: {
      lessons: { orderBy: { order: "asc" as const } },
      quiz: {
        include: {
          questions: { orderBy: { order: "asc" as const } },
        },
      },
    },
  },
  capstone: true,
  finalQuiz: {
    include: {
      questions: { orderBy: { order: "asc" as const } },
    },
  },
};

export async function getPublishedCourses() {
  return prisma.course.findMany({
    where: { status: "published" },
    orderBy: { title: "asc" },
  });
}

export async function getCourseBySlug(slug: string) {
  return prisma.course.findUnique({
    where: { slug },
    include: courseInclude,
  });
}

export function parseChoices(choicesJson: string): string[] {
  try {
    const v = JSON.parse(choicesJson);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function parseRubric(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}
