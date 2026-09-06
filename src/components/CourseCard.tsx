import Link from "next/link";
import { Cover } from "./Cover";
import { CourseBadges } from "./Badges";
import { formatPrice } from "@/lib/course";

type Course = {
  slug: string;
  title: string;
  promise: string;
  category: string;
  estimatedMinutes: number;
  exerciseCount: number;
  hasCapstone: boolean;
  coverLabel: string;
  coverHue: number;
  priceCents: number;
};

export function CourseCard({
  course,
  salesPaused,
}: {
  course: Course;
  salesPaused: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <Link href={`/courses/${course.slug}`}>
        <Cover label={course.coverLabel} hue={course.coverHue} title={course.title} className="rounded-none" />
      </Link>
      <div className="space-y-3 p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{course.category}</div>
        <h2 className="text-lg font-semibold leading-snug">
          <Link href={`/courses/${course.slug}`} className="hover:text-violet-700">
            {course.title}
          </Link>
        </h2>
        <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-300">{course.promise}</p>
        <CourseBadges
          minutes={course.estimatedMinutes}
          exerciseCount={course.exerciseCount}
          hasCapstone={course.hasCapstone}
        />
        <div className="flex items-center justify-between pt-1">
          <span className="text-lg font-semibold">{formatPrice(course.priceCents)}</span>
          {salesPaused ? (
            <span className="text-sm text-amber-700 dark:text-amber-400">Sales paused</span>
          ) : (
            <Link
              href={`/courses/${course.slug}`}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
            >
              View course
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
