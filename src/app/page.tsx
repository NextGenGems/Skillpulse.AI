import { CourseCard } from "@/components/CourseCard";
import { getPublishedCourses } from "@/lib/course";
import { getOwnerSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const [courses, settings] = await Promise.all([getPublishedCourses(), getOwnerSettings()]);
  const priceLabel = courses[0] ? `$${(courses[0].priceCents / 100).toFixed(0)}` : "$25";

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
          Emerging skills · one afternoon
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Learn the skills employers need next — in ~75–90 minutes
        </h1>
        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-300">
          Skill Flex micro-courses turn emerging skill gaps into practical afternoon training:
          teach + exercises, a real project, and a certificate. One-time {priceLabel} — no
          subscription.
        </p>
        <ul className="max-w-2xl list-disc space-y-1.5 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
          <li>Built around skills hiring managers and shipping teams are hunting for now</li>
          <li>~75–90 minute path you can finish in an afternoon</li>
          <li>Hands-on exercises, module quizzes, and a capstone project</li>
          <li>Certificate when you complete the course</li>
          <li>One-time {priceLabel} checkout — own the course, no monthly plan</li>
        </ul>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <a
            href="#courses"
            className="inline-flex rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Browse courses
          </a>
          <p className="text-xs text-zinc-500">
            Automated catalog owned by {settings.ownerName} — not a sentient AI product.
          </p>
        </div>
        {settings.killSwitchPaused && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            Sales are currently paused (owner kill switch). Browsing remains available.
          </div>
        )}
      </section>

      <section id="courses" className="scroll-mt-8 space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Courses</h2>
        {courses.length === 0 ? (
          <p className="text-zinc-500">No published courses yet. Run the seed script.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} salesPaused={settings.killSwitchPaused} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
