import Link from "next/link";
import { redirect } from "next/navigation";
import { KillSwitchForm } from "@/components/KillSwitchForm";
import { LogoutButton } from "@/components/LogoutButton";
import { isAdminAuthenticated } from "@/lib/auth";
import { getPublishedCourses } from "@/lib/course";
import { prisma } from "@/lib/prisma";
import { getOwnerSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const [settings, courses, enrollments] = await Promise.all([
    getOwnerSettings(),
    prisma.course.findMany({ orderBy: { title: "asc" } }),
    prisma.enrollment.count({ where: { paidAt: { not: null } } }),
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
        GenerationJob runner is deferred (no AI key required for MVP). Schema is present; jobs no-op when
        killSwitchPaused or AI_API_KEY is unset.
      </p>
    </div>
  );
}

