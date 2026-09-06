import { prisma } from "./prisma";

export function parseJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function parseJsonRecord(s: string): Record<string, number> {
  try {
    const v = JSON.parse(s);
    if (v && typeof v === "object") return v as Record<string, number>;
    return {};
  } catch {
    return {};
  }
}

export async function getEnrollmentByToken(token: string) {
  return prisma.enrollment.findUnique({
    where: { accessToken: token },
    include: {
      progress: true,
      course: { select: { id: true, slug: true, title: true, status: true } },
    },
  });
}

export async function ensureProgress(enrollmentId: string) {
  const existing = await prisma.enrollmentProgress.findUnique({
    where: { enrollmentId },
  });
  if (existing) return existing;
  return prisma.enrollmentProgress.create({
    data: { enrollmentId },
  });
}
