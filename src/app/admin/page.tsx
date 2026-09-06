import Link from "next/link";
import { redirect } from "next/navigation";
import { CatalogAutonomyPanel } from "@/components/CatalogAutonomyPanel";
import { KillSwitchForm } from "@/components/KillSwitchForm";
import { LogoutButton } from "@/components/LogoutButton";
import { isAdminAuthenticated } from "@/lib/auth";
import { getPublishedCourses } from "@/lib/course";
import { isAiApiKeyConfigured } from "@/lib/generation-jobs";
import { prisma } from "@/lib/prisma";
import { getOwnerSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const [settings, courses, enrollments, skillGaps] = await Promise.all([
    getOwnerSettings(),
    prisma.course.findMany({ orderBy: { title: "asc" } }),
    prisma.enrollment.count({ where: { paidAt: { not: null } } }),
    prisma.skillGap.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        generationJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, error: true },
        },
      },
    }),
  ]);

  const published = await getPublishedCourses();

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Admin</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Owner: {settings.ownerName} · Purpose: {settings.allowedPurpose} · Max gen jobs/day:{" "}
            {settings.maxGenerationJobsPerDay}
          </p>
        </div>
        <LogoutButton />
      </div>

      <KillSwitchForm initiallyPaused={settings.killSwitchPaused} />

      <CatalogAutonomyPanel
        killSwitchPaused={settings.killSwitchPaused}
        aiKeySet={isAiApiKeyConfigured()}
        maxGenerationJobsPerDay={settings.maxGenerationJobsPerDay}
        initialGaps={skillGaps.map((g) => ({
          id: g.id,
          title: g.title,
          status: g.status,
          score: g.score,
          category: g.category,
          createdAt: g.createdAt.toISOString(),
          generationJobs: g.generationJobs,
        }))}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Courses</h2>
        <p className="text-sm text-zinc-600">
          {published.length} published · {courses.length} total · {enrollments} paid enrollments
        </p>
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
          {courses.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{c.title}</div>
                <div className="text-zinc-500">
                  {c.status} · ~{c.estimatedMinutes} min · v{c.generationVersion}
                </div>
              </div>
              <Link href={`/courses/${c.slug}`} className="text-violet-700 hover:underline">
                View
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-zinc-500">
        Phase C scaffold: GenerationJob runner is a stub (no AI calls). Jobs no-op when killSwitchPaused
        or AI_API_KEY unset; with key set, tick marks queued jobs failed with stub_no_ai_pipeline.
      </p>
    </div>
  );
}
