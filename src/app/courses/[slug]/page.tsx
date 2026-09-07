import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover } from "@/components/Cover";
import { CourseBadges } from "@/components/Badges";
import { EnrollButton } from "@/components/EnrollButton";
import { formatPrice, getCourseBySlug } from "@/lib/course";
import { getOwnerSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course || (course.status !== "published" && course.status !== "ready")) {
    return { title: "Course not found" };
  }
  const title = course.title;
  const description = course.promise.slice(0, 160);
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const url = `${base}/courses/${course.slug}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "Skill Flex",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

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

  const lessonCount = course.modules.reduce((n, m) => n + m.lessons.length, 0);
  const moduleCount = course.modules.length;
  const priceLabel = formatPrice(course.priceCents);

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

          <section className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-900/50">
            <h2 className="text-xl font-semibold">What you&apos;ll get</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              <li>
                A focused ~{course.estimatedMinutes}-minute path you can finish in one afternoon —
                {moduleCount} modules, {lessonCount} lessons
              </li>
              <li>
                Teach + do on every lesson
                {course.exerciseCount > 0
                  ? ` (${course.exerciseCount} hands-on exercises)`
                  : " with practical exercises"}
              </li>
              <li>Module quizzes so you know the material stuck (pass ≥75%)</li>
              {course.hasCapstone || course.capstone ? (
                <li>
                  A capstone project
                  {course.capstone?.estimatedMinutes
                    ? ` (~${course.capstone.estimatedMinutes} min)`
                    : ""}{" "}
                  you can reuse at work or in a portfolio
                </li>
              ) : null}
              <li>A Skill Flex certificate when you meet the requirements below — not a participation badge</li>
              <li>
                One-time {priceLabel} purchase with lifetime access to this course — no subscription
              </li>
            </ul>
            <p className="text-xs text-zinc-500">
              Automated micro-course owned by {settings.ownerName}. Honest skill practice — not hype
              or a “sentient” AI tutor.
            </p>
          </section>

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
                Capstone (~{course.capstone.estimatedMinutes} min) + final quiz (pass ≥80%) →
                certificate.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Certificate requirements</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Plain rules — finish the work, prove it, get the certificate:
            </p>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              <li>Complete every lesson (teach + exercise).</li>
              <li>Pass each module quiz with ≥75%.</li>
              <li>Finish the capstone project.</li>
              <li>Score ≥80% on the final quiz.</li>
            </ol>
            <p className="text-xs text-zinc-500">
              Miss a threshold and you can retry quizzes; the certificate unlocks only when all four
              are done.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">FAQ</h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="font-medium text-zinc-900 dark:text-zinc-100">Who is this for?</dt>
                <dd className="mt-1 text-zinc-600 dark:text-zinc-300">
                  {course.audience}. If that sounds like you and you want a practical afternoon on{" "}
                  {course.category.toLowerCase()}, this course is a fit.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-900 dark:text-zinc-100">How long does it take?</dt>
                <dd className="mt-1 text-zinc-600 dark:text-zinc-300">
                  About {course.estimatedMinutes} minutes end-to-end (target {course.targetMinutes}
                  ). Most people finish in one sitting or split across an afternoon.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-900 dark:text-zinc-100">Is it a subscription?</dt>
                <dd className="mt-1 text-zinc-600 dark:text-zinc-300">
                  No. {priceLabel} one-time for this course — lifetime access, no monthly plan. Stripe
                  checkout shows as <code>Skill Flex — {course.title}</code>.
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 lg:sticky lg:top-6">
          <div>
            <div className="text-3xl font-bold">{priceLabel}</div>
            <p className="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              One-time · no subscription
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">Lifetime access to this course.</p>
          </div>
          <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <li className="flex gap-2">
              <span className="text-violet-600" aria-hidden>
                ✓
              </span>
              <span>~{course.estimatedMinutes} min afternoon course</span>
            </li>
            <li className="flex gap-2">
              <span className="text-violet-600" aria-hidden>
                ✓
              </span>
              <span>Exercises on every lesson</span>
            </li>
            <li className="flex gap-2">
              <span className="text-violet-600" aria-hidden>
                ✓
              </span>
              <span>Capstone project</span>
            </li>
            <li className="flex gap-2">
              <span className="text-violet-600" aria-hidden>
                ✓
              </span>
              <span>Certificate when you earn it</span>
            </li>
          </ul>
          <EnrollButton
            slug={course.slug}
            salesPaused={settings.killSwitchPaused}
            priceLabel={priceLabel}
            courseTitle={course.title}
          />
        </aside>
      </div>
    </div>
  );
}
