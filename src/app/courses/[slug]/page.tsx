import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover } from "@/components/Cover";
import { CourseBadges } from "@/components/Badges";
import { EnrollButton } from "@/components/EnrollButton";
import { formatPrice, getCourseBySlug } from "@/lib/course";
import { getOwnerSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [course, settings] = await Promise.all([getCourseBySlug(slug), getOwnerSettings()]);
  if (!course || (course.status !== "published" && course.status !== "ready")) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <Link href="/" className="text-sm text-violet-700 hover:underline">
        ← Catalog
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Cover label={course.coverLabel} hue={course.coverHue} title={course.title} />
          <CourseBadges
            minutes={course.estimatedMinutes}
            exerciseCount={course.exerciseCount}
            hasCapstone={course.hasCapstone}
          />
          <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
          <p className="text-lg text-zinc-700 dark:text-zinc-200">{course.promise}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Audience</dt>
              <dd>{course.audience}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Category</dt>
              <dd>{course.category}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Estimated time</dt>
              <dd>~{course.estimatedMinutes} minutes (target {course.targetMinutes})</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Version</dt>
              <dd>generation v{course.generationVersion}</dd>
            </div>
          </dl>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Outline</h2>
            <ol className="space-y-4">
              {course.modules.map((m) => (
                <li key={m.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                  <div className="font-medium">
                    Module {m.order}: {m.title}
                  </div>
                  {m.purpose && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{m.purpose}</p>}
                  <ul className="mt-2 list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-300">
                    {m.lessons.map((l) => (
                      <li key={l.id}>
                        {l.title} ({l.estimatedMinutes} min)
                      </li>
                    ))}
                    <li>Module quiz (pass ≥75%)</li>
                  </ul>
                </li>
              ))}
            </ol>
            {course.capstone && (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Capstone (~{course.capstone.estimatedMinutes} min) + final quiz (pass ≥80%) → certificate.
              </p>
            )}
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="text-3xl font-bold">{formatPrice(course.priceCents)}</div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">One-time. Lifetime access for this course.</p>
          <EnrollButton
            slug={course.slug}
            salesPaused={settings.killSwitchPaused}
            priceLabel={formatPrice(course.priceCents)}
          />
        </aside>
      </div>
    </div>
  );
}
