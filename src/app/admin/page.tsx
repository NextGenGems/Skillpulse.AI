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

function promoDraftPreview(lastOutputJson: string | null): string | null {
  if (!lastOutputJson) return null;
  try {
    const v = JSON.parse(lastOutputJson) as {
      drafts?: { reddit?: string; x?: string; linkedin?: string };
      note?: string;
    };
    if (v.drafts) {
      return [
        v.note ? `Note: ${v.note}` : null,
        v.drafts.reddit ? `--- Reddit ---\n${v.drafts.reddit}` : null,
        v.drafts.x ? `--- X ---\n${v.drafts.x}` : null,
        v.drafts.linkedin ? `--- LinkedIn ---\n${v.drafts.linkedin}` : null,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    return lastOutputJson.slice(0, 500);
  } catch {
    return lastOutputJson.slice(0, 500);
  }
}

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const [settings, courses, enrollments, skillGaps, promoJobs] = await Promise.all([
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
    prisma.promoJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
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
        initialPromos={promoJobs.map((p) => ({
          id: p.id,
          courseId: p.courseId,
          channel: p.channel,
          status: p.status,
          error: p.error,
          createdAt: p.createdAt.toISOString(),
          draftsPreview: promoDraftPreview(p.lastOutputJson),
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
        Free autonomy: Groq when keyed else templates. Promo drafts in DB; Bluesky auto-post when keyed; other channels
        gated until social tokens. Kill switch pauses enroll + ticks.
      </p>
    </div>
  );
}
