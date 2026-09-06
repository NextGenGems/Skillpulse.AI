import { CourseCard } from "@/components/CourseCard";
import { getPublishedCourses } from "@/lib/course";
import { getOwnerSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const [courses, settings] = await Promise.all([getPublishedCourses(), getOwnerSettings()]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
          Catalog
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Skill-gap micro-courses</h1>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-300">
          Practitioner courses (~75–90 min) with exercises, module quizzes, a capstone project, and a
          certificate. One-time {courses[0] ? `$${(courses[0].priceCents / 100).toFixed(0)}` : "$25"}. Owned
          by {settings.ownerName}.
        </p>
        {settings.killSwitchPaused && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            Sales are currently paused (owner kill switch). Browsing remains available.
          </div>
        )}
      </section>

      {courses.length === 0 ? (
        <p className="text-zinc-500">No published courses yet. Run the seed script.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} salesPaused={settings.killSwitchPaused} />
          ))}
        </div>
      )}
    </div>
  );
}
